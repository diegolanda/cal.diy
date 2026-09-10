import { getGoogleWorkspaceAuthConfig } from "@calcom/features/auth/lib/googleWorkspaceAuth";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { Prisma, type PrismaClient } from "@calcom/prisma/client";
import { IdentityProvider, MembershipRole, UserPermissionRole } from "@calcom/prisma/enums";

const managedTeamSelect = {
  id: true,
  name: true,
  slug: true,
  bio: true,
  members: {
    where: { accepted: true },
    select: {
      id: true,
      userId: true,
      role: true,
      accepted: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  },
} satisfies Prisma.TeamSelect;

const userTeamMembershipSelect = {
  id: true,
  role: true,
  accepted: true,
  team: { select: managedTeamSelect },
} satisfies Prisma.MembershipSelect;

const memberSelect = managedTeamSelect.members.select;
const managementRoles = [MembershipRole.OWNER, MembershipRole.ADMIN];

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type ManagedTeam = Prisma.TeamGetPayload<{ select: typeof managedTeamSelect }>;
export type UserTeamMembership = Prisma.MembershipGetPayload<{
  select: typeof userTeamMembershipSelect;
}>;
export type ManagedMembership = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

export class TeamService {
  constructor(private readonly prisma: PrismaClient) {}

  async listForUser(userId: number): Promise<UserTeamMembership[]> {
    return this.prisma.membership.findMany({
      where: {
        userId,
        accepted: true,
        team: { isOrganization: false, parentId: null },
      },
      select: userTeamMembershipSelect,
      orderBy: { team: { name: "asc" } },
    });
  }

  async create({
    actor,
    name,
    slug,
    bio,
  }: {
    actor: { id: number; role: UserPermissionRole };
    name: string;
    slug: string;
    bio?: string | null;
  }): Promise<ManagedTeam> {
    if (actor.role !== UserPermissionRole.ADMIN) {
      throw new ErrorWithCode(ErrorCode.Forbidden, "Only system administrators can create Teams");
    }

    return this.runSerializable(async (transaction) => {
      await this.ensureRootSlugAvailable(transaction, slug);

      return transaction.team.create({
        data: {
          name,
          slug,
          bio,
          parentId: null,
          isOrganization: false,
          members: {
            create: { userId: actor.id, accepted: true, role: MembershipRole.OWNER },
          },
        },
        select: managedTeamSelect,
      });
    });
  }

  async update({
    actorId,
    teamId,
    name,
    slug,
    bio,
  }: {
    actorId: number;
    teamId: number;
    name?: string;
    slug?: string;
    bio?: string | null;
  }): Promise<ManagedTeam> {
    return this.runSerializable(async (transaction) => {
      await this.assertCanManage(transaction, actorId, teamId);
      if (slug) await this.ensureRootSlugAvailable(transaction, slug, teamId);

      return transaction.team.update({
        where: { id: teamId },
        data: { name, slug, bio },
        select: managedTeamSelect,
      });
    });
  }

  async addMember({
    actorId,
    teamId,
    email,
    role,
  }: {
    actorId: number;
    teamId: number;
    email: string;
    role: typeof MembershipRole.MEMBER | typeof MembershipRole.ADMIN;
  }): Promise<ManagedMembership> {
    return this.runSerializable(async (transaction) => {
      await this.assertCanManage(transaction, actorId, teamId);
      const user = await transaction.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, emailVerified: true, identityProvider: true },
      });
      const workspace = getGoogleWorkspaceAuthConfig();
      const emailParts = user?.email.trim().toLowerCase().split("@");
      const isEligible =
        user?.identityProvider === IdentityProvider.GOOGLE &&
        Boolean(user.emailVerified) &&
        emailParts?.length === 2 &&
        emailParts[1] === workspace.domain;

      if (!user || !isEligible) {
        throw new ErrorWithCode(ErrorCode.NotFound, "No eligible Workspace user has that email");
      }

      const existingMembership = await transaction.membership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId } },
        select: { id: true },
      });
      if (existingMembership) {
        throw new ErrorWithCode(ErrorCode.BadRequest, "The user is already a Team member");
      }

      return transaction.membership.create({
        data: { teamId, userId: user.id, accepted: true, role },
        select: memberSelect,
      });
    });
  }

  async removeMember({
    actorId,
    teamId,
    membershipId,
  }: {
    actorId: number;
    teamId: number;
    membershipId: number;
  }): Promise<{ id: number }> {
    return this.runSerializable(async (transaction) => {
      const actorRole = await this.assertCanManage(transaction, actorId, teamId);
      const membership = await transaction.membership.findFirst({
        where: {
          id: membershipId,
          teamId,
          team: { isOrganization: false, parentId: null },
        },
        select: { id: true, accepted: true, role: true },
      });
      if (!membership) {
        throw new ErrorWithCode(ErrorCode.NotFound, "Team membership not found");
      }

      if (membership.accepted && membership.role === MembershipRole.OWNER) {
        if (actorRole !== MembershipRole.OWNER) {
          throw new ErrorWithCode(ErrorCode.Forbidden, "Only a Team owner can remove another owner");
        }
        const ownerCount = await transaction.membership.count({
          where: { teamId, accepted: true, role: MembershipRole.OWNER },
        });
        if (ownerCount <= 1) {
          throw new ErrorWithCode(ErrorCode.Forbidden, "The final Team owner cannot be removed");
        }
      }

      return transaction.membership.delete({
        where: { id: membership.id },
        select: { id: true },
      });
    });
  }

  async updateMemberRole({
    actorId,
    teamId,
    membershipId,
    role,
  }: {
    actorId: number;
    teamId: number;
    membershipId: number;
    role: MembershipRole;
  }): Promise<ManagedMembership> {
    return this.runSerializable(async (transaction) => {
      const actorRole = await this.assertCanManage(transaction, actorId, teamId);
      const membership = await transaction.membership.findFirst({
        where: {
          id: membershipId,
          teamId,
          accepted: true,
          team: { isOrganization: false, parentId: null },
        },
        select: { id: true, role: true },
      });
      if (!membership) {
        throw new ErrorWithCode(ErrorCode.NotFound, "Team membership not found");
      }

      const changesOwnership = membership.role === MembershipRole.OWNER || role === MembershipRole.OWNER;
      if (changesOwnership && actorRole !== MembershipRole.OWNER) {
        throw new ErrorWithCode(ErrorCode.Forbidden, "Only a Team owner can change owner roles");
      }
      if (membership.role === MembershipRole.OWNER && role !== MembershipRole.OWNER) {
        const ownerCount = await transaction.membership.count({
          where: { teamId, accepted: true, role: MembershipRole.OWNER },
        });
        if (ownerCount <= 1) {
          throw new ErrorWithCode(ErrorCode.Forbidden, "The final Team owner cannot be demoted");
        }
      }

      return transaction.membership.update({
        where: { id: membership.id },
        data: { role },
        select: memberSelect,
      });
    });
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: "Serializable" });
      } catch (error) {
        const isConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034");
        if (isConflict && error.code === "P2034" && attempt === 0) continue;
        if (isConflict) {
          throw new ErrorWithCode(ErrorCode.BadRequest, "The Team changed; refresh and try again");
        }
        throw error;
      }
    }

    throw new ErrorWithCode(ErrorCode.BadRequest, "The Team changed; refresh and try again");
  }

  private async assertCanManage(
    client: DatabaseClient,
    userId: number,
    teamId: number
  ): Promise<MembershipRole> {
    const membership = await client.membership.findFirst({
      where: {
        userId,
        teamId,
        accepted: true,
        role: { in: managementRoles },
        team: { isOrganization: false, parentId: null },
      },
      select: { role: true },
    });
    if (!membership) {
      throw new ErrorWithCode(ErrorCode.Forbidden, "Team owner or administrator access is required");
    }
    return membership.role;
  }

  private async ensureRootSlugAvailable(
    client: DatabaseClient,
    slug: string,
    ignoredTeamId?: number
  ): Promise<void> {
    const existingTeam = await client.team.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        parentId: null,
        isOrganization: false,
        ...(ignoredTeamId && { id: { not: ignoredTeamId } }),
      },
      select: { id: true },
    });
    if (existingTeam) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "A Team with this slug already exists");
    }
  }
}
