import type { PrismaClient } from "@calcom/prisma";
import { MembershipRole, UserPermissionRole } from "@calcom/prisma/enums";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type authedProcedure from "./authedProcedure";
import { createOrgPbacProcedure, createTeamPbacProcedure } from "./pbacProcedures";

type AuthorizationMiddleware = ReturnType<typeof authedProcedure.input>["_def"]["middlewares"][number];

const getAuthorizationMiddleware = (
  procedure: ReturnType<typeof authedProcedure.input>
): AuthorizationMiddleware => {
  return procedure._def.middlewares[procedure._def.middlewares.length - 1];
};

describe("createTeamPbacProcedure", () => {
  const findMembership = vi.fn();
  const next = vi.fn().mockResolvedValue({});
  const prisma = {
    membership: {
      findFirst: findMembership,
    },
  } as unknown as PrismaClient;

  const runMiddleware = ({
    role = UserPermissionRole.USER,
    fallbackRoles,
  }: {
    role?: UserPermissionRole;
    fallbackRoles?: MembershipRole[];
  } = {}): Promise<unknown> => {
    const procedure = createTeamPbacProcedure("team.update", fallbackRoles);
    const middleware = getAuthorizationMiddleware(procedure);

    return middleware({
      ctx: {
        user: { id: 7, role },
        prisma,
      },
      input: { teamId: 42 },
      next,
      path: "team.update",
      type: "mutation",
      getRawInput: async () => ({}),
      meta: undefined,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an accepted Team owner through a restricted select query", async () => {
    findMembership.mockResolvedValue({ id: 1 });

    await expect(runMiddleware()).resolves.toEqual({});

    expect(findMembership).toHaveBeenCalledWith({
      where: {
        teamId: 42,
        userId: 7,
        accepted: true,
        role: {
          in: [MembershipRole.ADMIN, MembershipRole.OWNER],
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
    expect(next).toHaveBeenCalledOnce();
  });

  it("denies a user without an accepted membership in an allowed role", async () => {
    findMembership.mockResolvedValue(null);

    await expect(runMiddleware()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
      message: "Permission required: team.update",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not give a system administrator implicit Team access", async () => {
    findMembership.mockResolvedValue(null);

    await expect(runMiddleware({ role: UserPermissionRole.ADMIN })).rejects.toMatchObject<Partial<TRPCError>>(
      {
        code: "FORBIDDEN",
        message: "Permission required: team.update",
      }
    );
    expect(findMembership).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an accepted member when the procedure grants read access", async () => {
    findMembership.mockResolvedValue({ id: 1 });

    await expect(runMiddleware({ fallbackRoles: [MembershipRole.MEMBER] })).resolves.toEqual({});

    expect(findMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: [MembershipRole.MEMBER] },
        }),
      })
    );
  });
});

describe("createOrgPbacProcedure", () => {
  it("denies organization permissions because Organizations are unsupported", async () => {
    const procedure = createOrgPbacProcedure("organization.update");
    const middleware = getAuthorizationMiddleware(procedure);
    const next = vi.fn();

    await expect(
      middleware({
        ctx: {
          user: { id: 7, role: UserPermissionRole.ADMIN, organizationId: 11 },
        },
        input: undefined,
        next,
        path: "organization.update",
        type: "mutation",
        getRawInput: async () => ({}),
        meta: undefined,
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
      message: "Organization permission is not supported: organization.update",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
