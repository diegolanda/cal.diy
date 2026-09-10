import { MembershipRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import authedProcedure from "./authedProcedure";

type PermissionString = string;

/**
 * Creates a procedure that checks team-level PBAC permissions.
 * The teamId is expected to come from input.teamId.
 *
 * @param permission - The specific permission required (e.g., "team.read", "team.update")
 * @param fallbackRoles - Roles to check when PBAC is disabled (defaults to ["ADMIN", "OWNER"])
 * @returns A procedure that checks the specified permission for the team
 */
function createTeamPbacProcedure(
  permission: PermissionString,
  fallbackRoles: MembershipRole[] = [MembershipRole.ADMIN, MembershipRole.OWNER]
): ReturnType<typeof authedProcedure.input> {
  return authedProcedure
    .input(
      z.object({
        teamId: z.number(),
      })
    )
    .use(async ({ ctx, input, next }) => {
      const membership = await ctx.prisma.membership.findFirst({
        where: {
          teamId: input.teamId,
          userId: ctx.user.id,
          accepted: true,
          role: {
            in: fallbackRoles,
          },
          team: {
            isOrganization: false,
            parentId: null,
          },
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Permission required: ${permission}`,
        });
      }

      return next();
    });
}

/**
 * Rejects organization permissions because Cal.diy does not support Organizations.
 *
 * @param permission - The requested organization permission
 * @param _fallbackRoles - Preserves compatibility with callers from the original PBAC API
 * @returns A procedure that fails closed for organization requests
 */
function createOrgPbacProcedure(
  permission: PermissionString,
  _fallbackRoles: MembershipRole[] = [MembershipRole.ADMIN, MembershipRole.OWNER]
): ReturnType<typeof authedProcedure.use> {
  return authedProcedure.use(async () => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Organization permission is not supported: ${permission}`,
    });
  });
}

export { createTeamPbacProcedure, createOrgPbacProcedure };
