import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdminForUser } from "./outOfOffice.utils";

const mocks = vi.hoisted(() => ({
  getTeamIdsWithPermission: vi.fn(),
  findMembership: vi.fn(),
}));

vi.mock("@calcom/features/membership/services/TeamPermissionService", () => ({
  TeamPermissionService: class {
    getTeamIdsWithPermission = mocks.getTeamIdsWithPermission;
  },
}));

vi.mock("@calcom/prisma", () => ({
  default: {
    membership: { findFirst: mocks.findMembership },
  },
}));

describe("isAdminForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the caller manages no root Team", async () => {
    mocks.getTeamIdsWithPermission.mockResolvedValue([]);

    await expect(isAdminForUser(10, 20)).resolves.toBe(false);
    expect(mocks.findMembership).not.toHaveBeenCalled();
  });

  it("requires the target user to be an accepted member of a managed Team", async () => {
    mocks.getTeamIdsWithPermission.mockResolvedValue([30]);
    mocks.findMembership.mockResolvedValue({ id: 40 });

    await expect(isAdminForUser(10, 20)).resolves.toBe(true);
    expect(mocks.findMembership).toHaveBeenCalledWith({
      where: {
        userId: 20,
        accepted: true,
        teamId: { in: [30] },
      },
      select: { id: true },
    });
  });
});
