import { MembershipRole } from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkInvalidAppCredentials } from "./checkForInvalidAppCredentials";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getAppFromSlug: vi.fn(),
  getTeamIdsWithPermission: vi.fn(),
  permissionClient: vi.fn(),
}));

vi.mock("@calcom/app-store/utils", () => ({
  getAppFromSlug: mocks.getAppFromSlug,
}));

vi.mock("@calcom/features/membership/services/TeamPermissionService", () => ({
  TeamPermissionService: class {
    constructor(prismaClient: unknown) {
      mocks.permissionClient(prismaClient);
    }

    getTeamIdsWithPermission = mocks.getTeamIdsWithPermission;
  },
}));

vi.mock("@calcom/prisma", () => ({
  prisma: {
    credential: { findMany: mocks.findMany },
  },
}));

describe("checkInvalidAppCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes invalid credentials for teams that the user can update", async () => {
    mocks.getTeamIdsWithPermission.mockResolvedValue([20]);
    mocks.findMany.mockResolvedValue([{ appId: "google-calendar" }]);
    mocks.getAppFromSlug.mockResolvedValue({ name: "Google Calendar" });

    const result = await checkInvalidAppCredentials({
      ctx: { user: { id: 10 } as NonNullable<TrpcSessionUser> },
    });

    expect(mocks.getTeamIdsWithPermission).toHaveBeenCalledWith({
      userId: 10,
      permission: "team.update",
      fallbackRoles: [MembershipRole.ADMIN, MembershipRole.OWNER],
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 10 }, { teamId: { in: [20] } }],
        invalid: true,
      },
      select: { appId: true },
    });
    expect(result).toEqual([{ slug: "google-calendar", name: "Google Calendar" }]);
  });
});
