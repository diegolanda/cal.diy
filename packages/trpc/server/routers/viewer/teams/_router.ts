import { TeamService } from "@calcom/features/teams/services/TeamService";
import { MembershipRole } from "@calcom/prisma/enums";
import { z } from "zod";
import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";

const teamIdSchema = z.number().int().positive();
const nameSchema = z.string().trim().min(1).max(100);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const bioSchema = z.string().trim().max(1000).nullable();

export const teamsRouter = router({
  list: authedProcedure.query(({ ctx }) => {
    return new TeamService(ctx.prisma).listForUser(ctx.user.id);
  }),

  create: authedProcedure
    .input(z.object({ name: nameSchema, slug: slugSchema, bio: bioSchema.optional() }))
    .mutation(({ ctx, input }) => {
      return new TeamService(ctx.prisma).create({
        actor: { id: ctx.user.id, role: ctx.user.role },
        ...input,
      });
    }),

  update: authedProcedure
    .input(
      z
        .object({
          teamId: teamIdSchema,
          name: nameSchema.optional(),
          slug: slugSchema.optional(),
          bio: bioSchema.optional(),
        })
        .refine(({ name, slug, bio }) => name !== undefined || slug !== undefined || bio !== undefined, {
          message: "Provide at least one Team field to update",
        })
    )
    .mutation(({ ctx, input }) => {
      return new TeamService(ctx.prisma).update({ actorId: ctx.user.id, ...input });
    }),

  addMember: authedProcedure
    .input(
      z.object({
        teamId: teamIdSchema,
        email: z.string().trim().email().toLowerCase(),
        role: z.enum([MembershipRole.MEMBER, MembershipRole.ADMIN]),
      })
    )
    .mutation(({ ctx, input }) => {
      return new TeamService(ctx.prisma).addMember({ actorId: ctx.user.id, ...input });
    }),

  removeMember: authedProcedure
    .input(z.object({ teamId: teamIdSchema, membershipId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      return new TeamService(ctx.prisma).removeMember({ actorId: ctx.user.id, ...input });
    }),
});
