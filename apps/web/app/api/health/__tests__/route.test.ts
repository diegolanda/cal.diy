import { prisma } from "@calcom/prisma";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "../route";

vi.mock("@calcom/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("reports availability when PostgreSQL responds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  test("reports unavailability without exposing the database error", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error("password authentication failed for secret-user")
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });
});
