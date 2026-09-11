import { updateTriggerForExistingBookings } from "@calcom/features/webhooks/lib/scheduleTrigger";
import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import type { TDeleteInputSchema } from "./delete.schema";

type DeleteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteInputSchema;
};

export const deleteHandler = async ({ ctx: _ctx, input }: DeleteOptions) => {
  const { id } = input;

  const webhookToDelete = await prisma.webhook.findFirst({
    where: { id },
  });

  if (webhookToDelete) {
    await prisma.webhook.delete({
      where: {
        id: webhookToDelete.id,
      },
    });

    await updateTriggerForExistingBookings(webhookToDelete, webhookToDelete.eventTriggers, []);
  }

  return {
    id,
  };
};
