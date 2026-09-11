import type { EventTypeRepository } from "@calcom/features/eventtypes/repositories/eventTypeRepository";
import {
  type TeamPermission,
  TeamPermissionService,
} from "@calcom/features/membership/services/TeamPermissionService";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import prisma from "@calcom/prisma";
import { MembershipRole, PeriodType, SchedulingType } from "@calcom/prisma/enums";
import type { CustomInputSchema } from "@calcom/prisma/zod-utils";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import authedProcedure from "../../../procedures/authedProcedure";
import type { TUpdateInputSchema } from "./types";

type EventType = Awaited<ReturnType<EventTypeRepository["findAllByUpId"]>>[number];

export const eventOwnerProcedure = authedProcedure
  .input(
    z
      .object({
        id: z.number().optional(),
        eventTypeId: z.number().optional(),
        users: z.array(z.number()).optional().default([]),
      })
      .refine((data) => data.id !== undefined || data.eventTypeId !== undefined, {
        message: "At least one of 'id' or 'eventTypeId' must be present",
        path: ["id", "eventTypeId"],
      })
  )
  .use(async ({ ctx, input, next }) => {
    const id = input.eventTypeId ?? input.id;
    // Prevent non-owners to update/delete a team event
    const event = await ctx.prisma.eventType.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
          },
        },
        team: {
          select: {
            members: {
              where: {
                accepted: true,
              },
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const isAuthorized = (() => {
      if (event.team) {
        const teamMember = event.team.members.find((member) => member.userId === ctx.user.id);
        const isOwnerOrAdmin = teamMember?.role === "ADMIN" || teamMember?.role === "OWNER";

        return isOwnerOrAdmin;
      }
      return event.userId === ctx.user.id || event.users.find((user) => user.id === ctx.user.id);
    })();

    if (!isAuthorized) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const isAllowed = (() => {
      if (event.team) {
        const allTeamMembers = event.team.members.map((member) => member.userId);
        return input.users.every((userId: number) => allTeamMembers.includes(userId));
      }
      return input.users.every((userId: number) => userId === ctx.user.id);
    })();

    if (!isAllowed) {
      console.warn(
        `User ${ctx.user.id} attempted to an create an event for users ${input.users.join(", ")}.`
      );
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next();
  });

/**
 * Creates an event admin procedure with configurable permissions
 * @param permission - The specific permission required (e.g., "eventType.manage", "eventType.update")
 * @param fallbackRoles - Roles to check when PBAC is disabled (defaults to ["ADMIN", "OWNER"])
 * @returns A procedure that checks the specified permission
 */
export const createEventPbacProcedure = (
  permission: TeamPermission,
  fallbackRoles: MembershipRole[] = ["ADMIN", "OWNER"]
) => {
  return authedProcedure
    .input(
      z
        .object({
          id: z.number().optional(),
          eventTypeId: z.number().optional(),
          teamId: z.number().nullable().optional(),
          schedulingType: z.nativeEnum(SchedulingType).nullable().optional(),
          hidden: z.boolean().optional(),
          users: z.array(z.number()).optional(),
          hosts: z.array(z.object({ userId: z.number() }).passthrough()).optional(),
        })
        .refine((data) => data.id !== undefined || data.eventTypeId !== undefined, {
          message: "At least one of 'id' or 'eventTypeId' must be present",
          path: ["id", "eventTypeId"],
        })
    )
    .use(async ({ ctx, input, next }) => {
      const id = input.eventTypeId ?? input.id;

      const event = await ctx.prisma.eventType.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          teamId: true,
          schedulingType: true,
          hidden: true,
          hosts: {
            select: {
              userId: true,
              scheduleId: true,
            },
          },
          users: {
            select: {
              id: true,
            },
          },
          team: {
            select: {
              members: {
                where: {
                  accepted: true,
                },
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const effectiveTeamId = input.teamId === undefined ? event.teamId : input.teamId;
      const isTeamTransition = input.teamId !== undefined && input.teamId !== event.teamId;
      const permissionCheckService = new TeamPermissionService(ctx.prisma);

      if (event.teamId && input.teamId === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team events cannot be converted into personal events",
        });
      }

      // Check if user has permission to access/modify this event
      if (!event.teamId) {
        // Personal event - must be owner or assigned user
        if (event.userId !== ctx.user.id && !event.users.find((user) => user.id === ctx.user.id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Permission required: ${permission}`,
          });
        }
      } else {
        // Team event - check PBAC/fallback permissions
        const hasPermission = await permissionCheckService.checkPermission({
          userId: ctx.user.id,
          teamId: event.teamId,
          permission,
          fallbackRoles,
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Permission required: ${permission}`,
          });
        }
      }

      if (isTeamTransition) {
        const teamIdsToAuthorize = [event.teamId, effectiveTeamId].filter(
          (teamId): teamId is number => teamId !== null
        );
        const hasTransitionPermission = await Promise.all(
          teamIdsToAuthorize.map((teamId) =>
            permissionCheckService.checkPermission({
              userId: ctx.user.id,
              teamId,
              permission: "eventType.update",
              fallbackRoles: [MembershipRole.ADMIN, MembershipRole.OWNER],
            })
          )
        );

        if (hasTransitionPermission.some((hasPermission) => !hasPermission)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Team owner or administrator access is required to move this event",
          });
        }
      }

      // Validate that assigned users are allowed
      if (input.users && input.users.length > 0) {
        const isAllowed = (() => {
          if (event.team) {
            const allTeamMembers = event.team.members.map((member) => member.userId);
            return input.users?.every((userId: number) => allTeamMembers.includes(userId)) ?? true;
          }
          return input.users?.every((userId: number) => userId === ctx.user.id) ?? true;
        })();

        if (!isAllowed) {
          console.warn(
            `User ${ctx.user.id} attempted to assign event ${event.id} to users ${input.users.join(", ")}.`
          );
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot assign event to users outside of team membership",
          });
        }
      }

      const effectiveHosts = input.hosts ?? event.hosts ?? [];
      const effectiveUserIds = input.users ?? event.users.map((user) => user.id);
      if (effectiveTeamId && (input.hosts !== undefined || input.users !== undefined || isTeamTransition)) {
        const assignedUserIds = Array.from(
          new Set([...effectiveHosts.map((host) => host.userId), ...effectiveUserIds])
        );
        const scheduledHosts = effectiveHosts.flatMap((host) =>
          typeof host.scheduleId === "number" ? [{ userId: host.userId, scheduleId: host.scheduleId }] : []
        );
        const [memberships, schedules] = await Promise.all([
          ctx.prisma.membership.findMany({
            where: {
              teamId: effectiveTeamId,
              userId: { in: assignedUserIds },
              accepted: true,
              team: { parentId: null, isOrganization: false },
            },
            select: { userId: true },
          }),
          scheduledHosts.length > 0
            ? ctx.prisma.schedule.findMany({
                where: {
                  OR: scheduledHosts.map((host) => ({ id: host.scheduleId, userId: host.userId })),
                },
                select: { id: true, userId: true },
              })
            : Promise.resolve([]),
        ]);
        const acceptedTeamMemberIds = new Set(memberships.map((membership) => membership.userId));
        const validScheduleKeys = new Set(schedules.map((schedule) => `${schedule.userId}:${schedule.id}`));
        const allHostsAreAcceptedMembers = effectiveHosts.every((host) =>
          acceptedTeamMemberIds.has(host.userId)
        );
        const allUsersAreAcceptedMembers = effectiveUserIds.every((userId) =>
          acceptedTeamMemberIds.has(userId)
        );
        const allSchedulesBelongToHosts = scheduledHosts.every((host) =>
          validScheduleKeys.has(`${host.userId}:${host.scheduleId}`)
        );

        if (!allHostsAreAcceptedMembers || !allUsersAreAcceptedMembers) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot assign hosts outside of accepted team membership",
          });
        }
        if (!allSchedulesBelongToHosts) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Each host schedule must belong to that host",
          });
        }
      }

      const effectiveSchedulingType = input.schedulingType ?? event.schedulingType;
      const effectiveHidden = input.hidden ?? event.hidden;
      const effectiveHostCount = effectiveHosts.length;
      if (
        effectiveTeamId &&
        effectiveSchedulingType === SchedulingType.ROUND_ROBIN &&
        !effectiveHidden &&
        effectiveHostCount === 0
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active round-robin Team event must have at least one host",
        });
      }

      return next();
    });
};

export function isPeriodType(keyInput: string): keyInput is PeriodType {
  return Object.keys(PeriodType).includes(keyInput);
}

export function handlePeriodType(periodType: string | undefined): PeriodType | undefined {
  if (typeof periodType !== "string") return undefined;
  const passedPeriodType = periodType.toUpperCase();
  if (!isPeriodType(passedPeriodType)) return undefined;
  return PeriodType[passedPeriodType];
}

export function handleCustomInputs(customInputs: CustomInputSchema[], eventTypeId: number) {
  const cInputsIdsToDeleteOrUpdated = customInputs.filter((input) => !input.hasToBeCreated);
  const cInputsIdsToDelete = cInputsIdsToDeleteOrUpdated.map((e) => e.id);
  const cInputsToCreate = customInputs
    .filter((input) => input.hasToBeCreated)
    .map((input) => ({
      type: input.type,
      label: input.label,
      required: input.required,
      placeholder: input.placeholder,
      options: input.options || undefined,
    }));
  const cInputsToUpdate = cInputsIdsToDeleteOrUpdated.map((input) => ({
    data: {
      type: input.type,
      label: input.label,
      required: input.required,
      placeholder: input.placeholder,
      options: input.options || undefined,
    },
    where: {
      id: input.id,
    },
  }));

  return {
    deleteMany: {
      eventTypeId,
      NOT: {
        id: { in: cInputsIdsToDelete },
      },
    },
    createMany: {
      data: cInputsToCreate,
    },
    update: cInputsToUpdate,
  };
}

export function ensureUniqueBookingFields(fields: TUpdateInputSchema["bookingFields"]) {
  if (!fields) {
    return;
  }

  fields.reduce(
    (discoveredFields, field) => {
      if (discoveredFields[field.name]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Duplicate booking field name: ${field.name}`,
        });
      }

      discoveredFields[field.name] = true;

      return discoveredFields;
    },
    {} as Record<string, true>
  );
}

export function ensureEmailOrPhoneNumberIsPresent(fields: TUpdateInputSchema["bookingFields"]) {
  if (!fields || fields.length === 0) {
    return;
  }

  const attendeePhoneNumberField = fields.find((field) => field.name === "attendeePhoneNumber");

  const emailField = fields.find((field) => field.name === "email");

  if (emailField?.hidden && attendeePhoneNumberField?.hidden) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "booking_fields_email_and_phone_both_hidden",
    });
  }
  if (!emailField?.required && !attendeePhoneNumberField?.required) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "booking_fields_email_or_phone_required",
    });
  }
  if (emailField?.hidden && !attendeePhoneNumberField?.required) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "booking_fields_phone_required_when_email_hidden",
    });
  }
  if (attendeePhoneNumberField?.hidden && !emailField?.required) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "booking_fields_email_required_when_phone_hidden",
    });
  }
}

export const mapEventType = async (eventType: EventType) => ({
  ...eventType,
  safeDescription: eventType?.description ? markdownToSafeHTML(eventType.description) : undefined,
  users: await Promise.all(
    (eventType?.hosts?.length ? eventType.hosts.map((host) => host.user) : eventType.users).map(async (u) =>
      new UserRepository(prisma).enrichUserWithItsProfile({
        user: u,
      })
    )
  ),
  metadata: eventType.metadata ? EventTypeMetaDataSchema.parse(eventType.metadata) : null,
  children: await Promise.all(
    (eventType.children || []).map(async (c) => ({
      ...c,
      users: await Promise.all(
        c.users.map(
          async (u) =>
            await new UserRepository(prisma).enrichUserWithItsProfile({
              user: u,
            })
        )
      ),
    }))
  ),
});
