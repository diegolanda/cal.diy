import type { PrismaClient } from "@calcom/prisma";
import { describe, expect, it, vi } from "vitest";
import { getPublicEvent } from "./getPublicEvent";

const createPrismaMock = () => {
  const findFirst = vi.fn().mockResolvedValue(null);
  const prisma = {
    eventType: {
      findFirst,
    },
  } as unknown as PrismaClient;

  return { findFirst, prisma };
};

describe("getPublicEvent visibility", () => {
  it("excludes archived Team events from public lookup", async () => {
    const { findFirst, prisma } = createPrismaMock();

    await getPublicEvent("recruitment", "intro-call", true, null, prisma, false);

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        hidden: false,
        slug: "intro-call",
      },
    });
  });

  it("preserves direct lookup for hidden personal events", async () => {
    const { findFirst, prisma } = createPrismaMock();

    await getPublicEvent("diego", "intro-call", false, null, prisma, false);

    expect(findFirst.mock.calls[0]?.[0]?.where).not.toHaveProperty("hidden");
  });
});
