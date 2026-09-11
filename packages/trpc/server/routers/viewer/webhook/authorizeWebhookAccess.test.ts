import { UserPermissionRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeWebhookAccess } from "./authorizeWebhookAccess";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  findEventType: vi.fn(),
  findWebhook: vi.fn(),
}));

vi.mock("@calcom/features/membership/services/TeamPermissionService", () => ({
  TeamPermissionService: class {
    checkPermission = mocks.checkPermission;
  },
}));

vi.mock("@calcom/prisma", () => ({
  prisma: {
    eventType: { findUnique: mocks.findEventType },
    webhook: { findUnique: mocks.findWebhook },
  },
}));

const user = { id: 10, role: UserPermissionRole.USER };

describe("authorizeWebhookAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an authorized owner or administrator to read a Team webhook", async () => {
    mocks.findWebhook.mockResolvedValue({
      id: "webhook-1",
      userId: null,
      teamId: 20,
      eventTypeId: null,
      platform: false,
    });
    mocks.checkPermission.mockResolvedValue(true);

    await expect(
      authorizeWebhookAccess({ user, input: { id: "webhook-1" }, permission: "webhook.read" })
    ).resolves.toBeUndefined();
    expect(mocks.checkPermission).toHaveBeenCalledWith({
      userId: 10,
      teamId: 20,
      permission: "webhook.read",
    });
  });

  it("denies a member who cannot update a Team webhook", async () => {
    mocks.findWebhook.mockResolvedValue({
      id: "webhook-1",
      userId: null,
      teamId: 20,
      eventTypeId: null,
      platform: false,
    });
    mocks.checkPermission.mockResolvedValue(false);

    const result = authorizeWebhookAccess({
      user,
      input: { id: "webhook-1" },
      permission: "webhook.update",
    });

    await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an authorized administrator to delete a Team webhook", async () => {
    mocks.findWebhook.mockResolvedValue({
      id: "webhook-1",
      userId: 99,
      teamId: 20,
      eventTypeId: null,
      platform: false,
    });
    mocks.checkPermission.mockResolvedValue(true);

    await expect(
      authorizeWebhookAccess({ user, input: { id: "webhook-1" }, permission: "webhook.delete" })
    ).resolves.toBeUndefined();
    expect(mocks.checkPermission).toHaveBeenCalledWith({
      userId: 10,
      teamId: 20,
      permission: "webhook.delete",
    });
  });

  it("denies access to another user's personal webhook", async () => {
    mocks.findWebhook.mockResolvedValue({
      id: "webhook-1",
      userId: 99,
      teamId: null,
      eventTypeId: null,
      platform: false,
    });

    await expect(
      authorizeWebhookAccess({ user, input: { id: "webhook-1" }, permission: "webhook.read" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  it("checks Team create permission for a Team event type", async () => {
    mocks.findEventType.mockResolvedValue({ id: 30, userId: null, teamId: 20 });
    mocks.checkPermission.mockResolvedValue(true);

    await expect(
      authorizeWebhookAccess({
        user,
        input: { eventTypeId: 30, teamId: 20 },
        permission: "webhook.create",
      })
    ).resolves.toBeUndefined();
    expect(mocks.checkPermission).toHaveBeenCalledWith({
      userId: 10,
      teamId: 20,
      permission: "webhook.create",
    });
  });

  it("denies a spoofed Team id for an event type", async () => {
    mocks.findEventType.mockResolvedValue({ id: 30, userId: null, teamId: 20 });

    await expect(
      authorizeWebhookAccess({
        user,
        input: { eventTypeId: 30, teamId: 99 },
        permission: "webhook.create",
      })
    ).rejects.toBeInstanceOf(TRPCError);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  it("allows only system administrators to access platform webhooks", async () => {
    mocks.findWebhook.mockResolvedValue({
      id: "platform-webhook",
      userId: null,
      teamId: null,
      eventTypeId: null,
      platform: true,
    });

    await expect(
      authorizeWebhookAccess({
        user,
        input: { id: "platform-webhook" },
        permission: "webhook.read",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      authorizeWebhookAccess({
        user: { id: 11, role: UserPermissionRole.ADMIN },
        input: { id: "platform-webhook" },
        permission: "webhook.read",
      })
    ).resolves.toBeUndefined();
  });
});
