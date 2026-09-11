import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  cleanupMock,
  processQueueMock,
}: { cleanupMock: ReturnType<typeof vi.fn>; processQueueMock: ReturnType<typeof vi.fn> } = vi.hoisted(() => ({
  cleanupMock: vi.fn(),
  processQueueMock: vi.fn(),
}));

vi.mock("..", () => ({
  default: { cleanup: cleanupMock },
}));

vi.mock("../task-processor", () => ({
  TaskProcessor: class {
    processQueue = processQueueMock;
  },
}));

import { GET as cleanup } from "./cleanup";
import { GET as processCron, POST as processCronPost } from "./cron";

const createRequest = (authorization?: string): NextRequest => {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  return new NextRequest("http://localhost/api/tasks/cron", { headers });
};

describe("task API authentication", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ["cron GET", processCron, processQueueMock],
    ["cron POST", processCronPost, processQueueMock],
    ["cleanup", cleanup, cleanupMock],
  ])("rejects %s when CRON_SECRET is unset", async (_name, handler, action) => {
    vi.stubEnv("CRON_SECRET", undefined);

    const response = await handler(createRequest("Bearer undefined"));

    expect(response.status).toBe(401);
    expect(action).not.toHaveBeenCalled();
  });

  it.each([
    ["cron GET", processCron, processQueueMock],
    ["cron POST", processCronPost, processQueueMock],
    ["cleanup", cleanup, cleanupMock],
  ])("accepts %s with the configured secret", async (_name, handler, action) => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await handler(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    expect(action).toHaveBeenCalledOnce();
  });
});
