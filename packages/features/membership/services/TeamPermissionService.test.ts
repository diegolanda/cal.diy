import { MembershipRole } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamPermissionService } from "./TeamPermissionService";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@calcom/prisma", () => ({
  default: {
    membership: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}));

describe("TeamPermissionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an accepted root team admin to create event types", async () => {
    mocks.findFirst.mockResolvedValue({ id: 1 });

    const result = await new TeamPermissionService().checkPermission({
      userId: 10,
      teamId: 20,
      permission: "eventType.create",
    });

    expect(result).toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 10,
        teamId: 20,
        accepted: true,
        role: { in: [MembershipRole.ADMIN, MembershipRole.OWNER] },
        team: { parentId: null, isOrganization: false },
      },
      select: { id: true },
    });
  });

  it("denies event type creation without a matching membership", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      new TeamPermissionService().checkPermission({
        userId: 10,
        teamId: 20,
        permission: "eventType.create",
        fallbackRoles: [MembershipRole.MEMBER],
      })
    ).resolves.toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("allows members to read team event types", async () => {
    mocks.findFirst.mockResolvedValue({ id: 1 });

    await new TeamPermissionService().checkPermission({
      userId: 10,
      teamId: 20,
      permission: "eventType.read",
      fallbackRoles: [MembershipRole.MEMBER],
    });

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { in: [MembershipRole.MEMBER] } }) })
    );
  });

  it("does not allow members to read or modify team webhooks", async () => {
    mocks.findFirst.mockResolvedValue({ id: 1 });
    const service = new TeamPermissionService();

    await expect(
      service.checkPermission({
        userId: 10,
        teamId: 20,
        permission: "webhook.read",
        fallbackRoles: [MembershipRole.MEMBER],
      })
    ).resolves.toBe(false);

    await expect(
      service.checkPermission({
        userId: 10,
        teamId: 20,
        permission: "webhook.update",
        fallbackRoles: [MembershipRole.MEMBER],
      })
    ).resolves.toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("allows only owners and administrators to update teams", async () => {
    mocks.findFirst.mockResolvedValue({ id: 1 });
    const service = new TeamPermissionService();

    await expect(
      service.checkPermission({
        userId: 10,
        teamId: 20,
        permission: "team.update",
        fallbackRoles: [MembershipRole.ADMIN],
      })
    ).resolves.toBe(true);
    await expect(
      service.checkPermission({
        userId: 10,
        teamId: 20,
        permission: "team.update",
        fallbackRoles: [MembershipRole.MEMBER],
      })
    ).resolves.toBe(false);
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns only root non-organization team ids", async () => {
    mocks.findMany.mockResolvedValue([{ teamId: 20 }, { teamId: 30 }]);

    const result = await new TeamPermissionService().getTeamIdsWithPermission({
      userId: 10,
      permission: "booking.read",
    });

    expect(result).toEqual([20, 30]);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        userId: 10,
        accepted: true,
        role: { in: [MembershipRole.ADMIN, MembershipRole.OWNER] },
        team: { parentId: null, isOrganization: false },
      },
      select: { teamId: true },
    });
  });

  it("fails closed for organization-scoped team lookup", async () => {
    await expect(
      new TeamPermissionService().getTeamIdsWithPermission({
        userId: 10,
        permission: "booking.read",
        orgId: 99,
      })
    ).resolves.toEqual([]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
