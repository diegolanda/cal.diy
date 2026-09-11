import authedProcedure from "../../../procedures/authedProcedure";
import { authorizeWebhookAccess, type WebhookPermission } from "./authorizeWebhookAccess";
import { webhookIdAndEventTypeIdSchema } from "./types";

export const createWebhookProcedure = (permission: WebhookPermission = "webhook.read") => {
  return authedProcedure.input(webhookIdAndEventTypeIdSchema.optional()).use(async ({ ctx, input, next }) => {
    await authorizeWebhookAccess({ user: ctx.user, input, permission });

    return next();
  });
};

export const webhookProcedure = createWebhookProcedure();
