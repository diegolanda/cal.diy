import type { PrismaClient } from "@calcom/prisma";
import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";

export const TEAM_PERMISSIONS = [
  "booking.read",
  "booking.readTeamBookings",
  "booking.readOrgBookings",
  "eventType.create",
  "eventType.read",
  "eventType.update",
  "eventType.delete",
  "team.read",
  "webhook.create",
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export const TEAM_PERMISSION_ROLE_POLICY: Record<TeamPermission, readonly MembershipRole[]> = {
  "booking.read": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "booking.readTeamBookings": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "booking.readOrgBookings": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "eventType.create": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "eventType.read": [MembershipRole.MEMBER, MembershipRole.ADMIN, MembershipRole.OWNER],
  "eventType.update": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "eventType.delete": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "team.read": [MembershipRole.ADMIN, MembershipRole.OWNER],
  "webhook.create": [MembershipRole.ADMIN, MembershipRole.OWNER],
};

export const isTeamPermission = (permission: string): permission is TeamPermission =>
  TEAM_PERMISSIONS.some((candidate) => candidate === permission);

type PermissionInput = {
  userId: number;
  permission: TeamPermission;
  fallbackRoles?: readonly MembershipRole[];
};

type CheckPermissionInput = PermissionInput & { teamId: number };
type GetTeamIdsInput = PermissionInput & { orgId?: number };

export class TeamPermissionService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  private getAllowedRoles(
    permission: TeamPermission,
    fallbackRoles?: readonly MembershipRole[]
  ): MembershipRole[] {
    const policyRoles = TEAM_PERMISSION_ROLE_POLICY[permission];
    if (!fallbackRoles) return [...policyRoles];
    return policyRoles.filter((role) => fallbackRoles.includes(role));
  }

  async checkPermission({
    userId,
    teamId,
    permission,
    fallbackRoles,
  }: CheckPermissionInput): Promise<boolean> {
    const allowedRoles = this.getAllowedRoles(permission, fallbackRoles);
    if (allowedRoles.length === 0) return false;

    const membership = await this.prismaClient.membership.findFirst({
      where: {
        userId,
        teamId,
        accepted: true,
        role: { in: allowedRoles },
        team: { parentId: null, isOrganization: false },
      },
      select: { id: true },
    });

    return membership !== null;
  }

  async getTeamIdsWithPermission({
    userId,
    permission,
    fallbackRoles,
    orgId,
  }: GetTeamIdsInput): Promise<number[]> {
    if (orgId !== undefined) return [];

    const allowedRoles = this.getAllowedRoles(permission, fallbackRoles);
    if (allowedRoles.length === 0) return [];

    const memberships = await this.prismaClient.membership.findMany({
      where: {
        userId,
        accepted: true,
        role: { in: allowedRoles },
        team: { parentId: null, isOrganization: false },
      },
      select: { teamId: true },
    });

    return memberships.map(({ teamId }) => teamId);
  }
}
