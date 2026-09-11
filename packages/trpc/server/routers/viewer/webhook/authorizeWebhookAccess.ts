import {
  type TeamPermission,
  TeamPermissionService,
} from "@calcom/features/membership/services/TeamPermissionService";
import { prisma } from "@calcom/prisma";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";

export type WebhookPermission = Extract<TeamPermission, `webhook.${string}`>;

type WebhookScopeInput = {
  id?: string;
  webhookId?: string;
  eventTypeId?: number;
  teamId?: number;
};

type WebhookViewer = {
  id: number;
  role?: UserPermissionRole;
};

const authorizeTeam = async ({
  userId,
  teamId,
  permission,
}: {
  userId: number;
  teamId: number;
  permission: WebhookPermission;
}) => {
  const hasPermission = await new TeamPermissionService(prisma).checkPermission({
    userId,
    teamId,
    permission,
  });

  if (!hasPermission) throw new TRPCError({ code: "FORBIDDEN" });
};

const authorizeEventType = async ({
  userId,
  eventTypeId,
  expectedTeamId,
  permission,
}: {
  userId: number;
  eventTypeId: number;
  expectedTeamId?: number;
  permission: WebhookPermission;
}) => {
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: { id: true, userId: true, teamId: true },
  });

  if (!eventType) throw new TRPCError({ code: "NOT_FOUND" });
  if (expectedTeamId !== undefined && eventType.teamId !== expectedTeamId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (eventType.teamId) {
    await authorizeTeam({ userId, teamId: eventType.teamId, permission });
    return;
  }

  if (eventType.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
};

export const authorizeWebhookAccess = async ({
  user,
  input,
  permission,
}: {
  user: WebhookViewer;
  input?: WebhookScopeInput;
  permission: WebhookPermission;
}) => {
  if (!input) return;

  const lookupId = input.id || input.webhookId;
  if (!lookupId) {
    if (input.eventTypeId) {
      await authorizeEventType({
        userId: user.id,
        eventTypeId: input.eventTypeId,
        expectedTeamId: input.teamId,
        permission,
      });
      return;
    }

    if (input.teamId) {
      await authorizeTeam({ userId: user.id, teamId: input.teamId, permission });
    }
    return;
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id: lookupId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      eventTypeId: true,
      platform: true,
    },
  });

  if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });
  if (input.eventTypeId !== undefined && input.eventTypeId !== webhook.eventTypeId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (input.teamId !== undefined && input.teamId !== webhook.teamId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (webhook.platform) {
    if (user.role !== UserPermissionRole.ADMIN) throw new TRPCError({ code: "FORBIDDEN" });
    return;
  }

  if (webhook.eventTypeId) {
    await authorizeEventType({
      userId: user.id,
      eventTypeId: webhook.eventTypeId,
      expectedTeamId: webhook.teamId ?? undefined,
      permission,
    });
    return;
  }

  if (webhook.teamId) {
    await authorizeTeam({ userId: user.id, teamId: webhook.teamId, permission });
    return;
  }

  if (webhook.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
};
