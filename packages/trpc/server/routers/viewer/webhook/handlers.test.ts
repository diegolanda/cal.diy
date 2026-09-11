import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteHandler } from "./delete.handler";
import { ZGetInputSchema } from "./get.schema";
import { listHandler } from "./list.handler";

const mocks = vi.hoisted(() => ({
  deleteWebhook: vi.fn(),
  findWebhook: vi.fn(),
  listWebhooks: vi.fn(),
  updateTriggers: vi.fn(),
}));

vi.mock("@calcom/features/di/webhooks/containers/webhook", () => ({
  getWebhookFeature: () => ({ repository: { listWebhooks: mocks.listWebhooks } }),
}));

vi.mock("@calcom/features/webhooks/lib/scheduleTrigger", () => ({
  updateTriggerForExistingBookings: mocks.updateTriggers,
}));

vi.mock("@calcom/prisma", () => ({
  prisma: {
    webhook: {
      findFirst: mocks.findWebhook,
      delete: mocks.deleteWebhook,
    },
  },
}));

const user = { id: 10, role: "USER" } as NonNullable<TrpcSessionUser>;

describe("webhook handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the authorized Team scope to listWebhooks", async () => {
    mocks.listWebhooks.mockResolvedValue([]);

    await listHandler({ ctx: { user }, input: { teamId: 20 } });

    expect(mocks.listWebhooks).toHaveBeenCalledWith({
      userId: 10,
      appId: undefined,
      eventTypeId: undefined,
      teamId: 20,
      eventTriggers: undefined,
    });
  });

  it("deletes a Team webhook after the router authorizes the caller", async () => {
    const webhook = { id: "webhook-1", eventTriggers: [], teamId: 20, userId: 99 };
    mocks.findWebhook.mockResolvedValue(webhook);
    mocks.deleteWebhook.mockResolvedValue(webhook);

    await deleteHandler({ ctx: { user }, input: { id: "webhook-1", teamId: 20 } });

    expect(mocks.findWebhook).toHaveBeenCalledWith({ where: { id: "webhook-1" } });
    expect(mocks.deleteWebhook).toHaveBeenCalledWith({ where: { id: "webhook-1" } });
  });
});

describe("ZGetInputSchema", () => {
  it("requires a webhook identifier", () => {
    expect(ZGetInputSchema.safeParse({})).toMatchObject({ success: false });
    expect(ZGetInputSchema.safeParse({ teamId: 20 })).toMatchObject({ success: false });
  });

  it("accepts either supported webhook identifier", () => {
    expect(ZGetInputSchema.safeParse({ id: "webhook-1" })).toMatchObject({ success: true });
    expect(ZGetInputSchema.safeParse({ webhookId: "webhook-1" })).toMatchObject({ success: true });
  });
});
