import { TeamPermissionService } from "@calcom/features/membership/services/TeamPermissionService";
import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";

export const isAdminForUser = async (adminUserId: number, memberUserId: number) => {
  const permissionCheckService = new TeamPermissionService(prisma);
  const adminTeamIds = await permissionCheckService.getTeamIdsWithPermission({
    userId: adminUserId,
    permission: "team.update",
    fallbackRoles: [MembershipRole.ADMIN, MembershipRole.OWNER],
  });

  if (adminTeamIds.length === 0) {
    return false;
  }

  const member = await prisma.membership.findFirst({
    where: {
      userId: memberUserId,
      accepted: true,
      teamId: {
        in: adminTeamIds,
      },
    },
    select: {
      id: true,
    },
  });

  return !!member?.id;
};
