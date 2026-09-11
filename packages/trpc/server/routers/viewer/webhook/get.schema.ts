import type { z } from "zod";
import { webhookIdAndEventTypeIdSchema } from "./types";

export const ZGetInputSchema = webhookIdAndEventTypeIdSchema.refine(
  ({ id, webhookId }) => Boolean(id || webhookId),
  { message: "A webhook id is required" }
);

export type TGetInputSchema = z.infer<typeof ZGetInputSchema>;
