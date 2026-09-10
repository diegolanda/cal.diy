import { ErrorCode } from "@calcom/lib/errorCodes";
import { Prisma, type PrismaClient } from "@calcom/prisma/client";
import { IdentityProvider, MembershipRole, UserPermissionRole } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamService } from "./TeamService";

describe("TeamService", () => {
  const membershipFindMany = vi.fn();
  const membershipFindFirst = vi.fn();
  const membershipFindUnique = vi.fn();
  const membershipCreate = vi.fn();
  const membershipDelete = vi.fn();
  const membershipUpdate = vi.fn();
  const membershipCount = vi.fn();
  const teamFindFirst = vi.fn();
  const teamCreate = vi.fn();
  const teamUpdate = vi.fn();
  const userFindFirst = vi.fn();
  const transaction = vi.fn();
  let prisma: PrismaClient;
  let service: TeamService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_WORKSPACE_AUTH_DOMAIN", "nuen.io");
    prisma = {
      membership: {
        findMany: membershipFindMany,
        findFirst: membershipFindFirst,
        findUnique: membershipFindUnique,
        create: membershipCreate,
        delete: membershipDelete,
        update: membershipUpdate,
        count: membershipCount,
      },
      team: { findFirst: teamFindFirst, create: teamCreate, update: teamUpdate },
      user: { findFirst: userFindFirst },
      $transaction: transaction,
    } as unknown as PrismaClient;
    transaction.mockImplementation((callback: (transaction: PrismaClient) => Promise<unknown>) =>
      callback(prisma)
    );
    service = new TeamService(prisma);
  });

  it("lists only the caller's accepted root Teams", async () => {
    membershipFindMany.mockResolvedValue([]);

    await expect(service.listForUser(7)).resolves.toEqual([]);

    expect(membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, accepted: true, team: { isOrganization: false, parentId: null } },
      })
    );
  });

  it("allows only a system administrator to create a root Team", async () => {
    await expect(
      service.create({ actor: { id: 7, role: UserPermissionRole.USER }, name: "HR", slug: "hr" })
    ).rejects.toMatchObject({ code: ErrorCode.Forbidden });

    teamFindFirst.mockResolvedValue(null);
    teamCreate.mockResolvedValue({ id: 42 });
    await service.create({ actor: { id: 7, role: UserPermissionRole.ADMIN }, name: "HR", slug: "hr" });
    expect(teamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: null,
          isOrganization: false,
          members: { create: { userId: 7, accepted: true, role: MembershipRole.OWNER } },
        }),
      })
    );
  });

  it("updates only a root Team managed by the caller", async () => {
    membershipFindFirst.mockResolvedValueOnce(null);
    await expect(service.update({ actorId: 7, teamId: 42, name: "People" })).rejects.toMatchObject({
      code: ErrorCode.Forbidden,
    });

    membershipFindFirst.mockResolvedValueOnce({ id: 1 });
    teamUpdate.mockResolvedValue({ id: 42 });
    await service.update({ actorId: 7, teamId: 42, name: "People" });
    expect(teamUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "People" } }));
  });

  it("adds an existing verified Workspace user as an accepted member", async () => {
    membershipFindFirst.mockResolvedValue({ id: 1 });
    userFindFirst.mockResolvedValue({
      id: 9,
      email: "person@nuen.io",
      emailVerified: new Date(),
      identityProvider: IdentityProvider.GOOGLE,
    });
    membershipFindUnique.mockResolvedValue(null);
    membershipCreate.mockResolvedValue({ id: 2 });

    await service.addMember({ actorId: 7, teamId: 42, email: "person@nuen.io", role: MembershipRole.MEMBER });

    expect(membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { teamId: 42, userId: 9, accepted: true, role: MembershipRole.MEMBER },
      })
    );
  });

  it("does not add an existing user outside the exact Workspace domain", async () => {
    membershipFindFirst.mockResolvedValue({ id: 1 });
    userFindFirst.mockResolvedValue({
      id: 9,
      email: "person@staff.nuen.io",
      emailVerified: new Date(),
      identityProvider: IdentityProvider.GOOGLE,
    });

    await expect(
      service.addMember({ actorId: 7, teamId: 42, email: "person@staff.nuen.io", role: MembershipRole.ADMIN })
    ).rejects.toMatchObject({ code: ErrorCode.NotFound });
    expect(membershipCreate).not.toHaveBeenCalled();
  });

  it("never removes the final accepted owner", async () => {
    membershipFindFirst.mockResolvedValueOnce({ role: MembershipRole.OWNER }).mockResolvedValueOnce({
      id: 2,
      accepted: true,
      role: MembershipRole.OWNER,
    });
    membershipCount.mockResolvedValue(1);

    await expect(service.removeMember({ actorId: 7, teamId: 42, membershipId: 2 })).rejects.toMatchObject({
      code: ErrorCode.Forbidden,
    });
    expect(membershipDelete).not.toHaveBeenCalled();
  });

  it("removes a membership when an accepted owner remains", async () => {
    membershipFindFirst.mockResolvedValueOnce({ role: MembershipRole.OWNER }).mockResolvedValueOnce({
      id: 2,
      accepted: true,
      role: MembershipRole.OWNER,
    });
    membershipCount.mockResolvedValue(2);
    membershipDelete.mockResolvedValue({ id: 2 });

    await expect(service.removeMember({ actorId: 7, teamId: 42, membershipId: 2 })).resolves.toEqual({
      id: 2,
    });
    expect(membershipDelete).toHaveBeenCalledWith({ where: { id: 2 }, select: { id: true } });
  });

  it("allows an owner to transfer ownership before being demoted", async () => {
    membershipFindFirst
      .mockResolvedValueOnce({ role: MembershipRole.OWNER })
      .mockResolvedValueOnce({ id: 2, role: MembershipRole.ADMIN });
    membershipUpdate.mockResolvedValue({ id: 2, role: MembershipRole.OWNER });

    await service.updateMemberRole({
      actorId: 7,
      teamId: 42,
      membershipId: 2,
      role: MembershipRole.OWNER,
    });

    expect(membershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2 }, data: { role: MembershipRole.OWNER } })
    );
  });

  it("prevents an administrator from changing owner roles", async () => {
    membershipFindFirst
      .mockResolvedValueOnce({ role: MembershipRole.ADMIN })
      .mockResolvedValueOnce({ id: 2, role: MembershipRole.MEMBER });

    await expect(
      service.updateMemberRole({
        actorId: 7,
        teamId: 42,
        membershipId: 2,
        role: MembershipRole.OWNER,
      })
    ).rejects.toMatchObject({ code: ErrorCode.Forbidden });
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it("prevents the final owner from being demoted", async () => {
    membershipFindFirst
      .mockResolvedValueOnce({ role: MembershipRole.OWNER })
      .mockResolvedValueOnce({ id: 2, role: MembershipRole.OWNER });
    membershipCount.mockResolvedValue(1);

    await expect(
      service.updateMemberRole({
        actorId: 7,
        teamId: 42,
        membershipId: 2,
        role: MembershipRole.ADMIN,
      })
    ).rejects.toMatchObject({ code: ErrorCode.Forbidden });
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it("retries one serialization conflict", async () => {
    transaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
          code: "P2034",
          clientVersion: "test",
        })
      )
      .mockImplementationOnce((callback: (transaction: PrismaClient) => Promise<unknown>) => callback(prisma));
    teamFindFirst.mockResolvedValue(null);
    teamCreate.mockResolvedValue({ id: 42 });

    await expect(
      service.create({ actor: { id: 7, role: UserPermissionRole.ADMIN }, name: "HR", slug: "hr" })
    ).resolves.toEqual({ id: 42 });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
