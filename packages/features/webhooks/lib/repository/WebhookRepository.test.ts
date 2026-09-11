import type { IEventTypesRepository } from "@calcom/features/eventtypes/eventtypes.repository.interface";
import type { IUsersRepository } from "@calcom/features/users/users.repository.interface";
import type { PrismaClient } from "@calcom/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookRepository } from "./WebhookRepository";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
}));

vi.mock("@calcom/features/membership/services/TeamPermissionService", () => ({
  TeamPermissionService: class {
    checkPermission = mocks.checkPermission;
  },
}));

const webhook = {
  id: "team-webhook",
  subscriberUrl: "https://example.com/webhook",
  payloadTemplate: null,
  appId: null,
  secret: "team-secret",
  active: true,
  eventTriggers: [],
  eventTypeId: null,
  teamId: 20,
  userId: null,
  time: null,
  timeUnit: null,
  version: "2021-10-20",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  platform: false,
  platformOAuthClientId: null,
};

describe("WebhookRepository team permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not return a team webhook when read permission is denied", async () => {
    mocks.checkPermission.mockResolvedValue(false);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 10,
          username: "member",
          name: "Member",
          avatarUrl: null,
          webhooks: [],
          teams: [
            {
              role: "MEMBER",
              team: {
                id: 20,
                name: "Recruitment",
                slug: "recruitment",
                logoUrl: null,
                webhooks: [webhook],
              },
            },
          ],
        }),
      },
    } as unknown as PrismaClient;
    const repository = new WebhookRepository(
      prisma,
      {} as unknown as IEventTypesRepository,
      {} as unknown as IUsersRepository
    );

    const result = await repository.getFilteredWebhooksForUser({ userId: 10 });

    expect(result.webhookGroups).toEqual([]);
    expect(result.profiles).toEqual([
      expect.objectContaining({ teamId: null, canModify: true, canDelete: true }),
    ]);
    expect(mocks.checkPermission).toHaveBeenCalledWith({
      userId: 10,
      teamId: 20,
      permission: "webhook.read",
      fallbackRoles: ["ADMIN", "OWNER"],
    });
  });
});
