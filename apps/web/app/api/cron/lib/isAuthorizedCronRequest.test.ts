import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "./isAuthorizedCronRequest";

function createRequest({ authorization, apiKey }: { authorization?: string; apiKey?: string }): NextRequest {
  const url = new URL("http://localhost/api/cron/example");
  if (apiKey) url.searchParams.set("apiKey", apiKey);

  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);

  return new NextRequest(url, { headers });
}

describe("isAuthorizedCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    undefined,
    "Bearer undefined",
    "undefined",
  ])("rejects %s when both cron secrets are unset", (authorization) => {
    vi.stubEnv("CRON_API_KEY", undefined);
    vi.stubEnv("CRON_SECRET", undefined);

    expect(isAuthorizedCronRequest(createRequest({ authorization }))).toBe(false);
  });

  it("accepts a configured CRON_API_KEY from the authorization header", () => {
    vi.stubEnv("CRON_API_KEY", "test-api-key");
    vi.stubEnv("CRON_SECRET", undefined);

    expect(isAuthorizedCronRequest(createRequest({ authorization: "test-api-key" }))).toBe(true);
  });

  it("accepts a configured CRON_API_KEY from the query string", () => {
    vi.stubEnv("CRON_API_KEY", "test-api-key");
    vi.stubEnv("CRON_SECRET", undefined);

    expect(isAuthorizedCronRequest(createRequest({ apiKey: "test-api-key" }))).toBe(true);
  });

  it("accepts a configured CRON_SECRET as a Bearer token", () => {
    vi.stubEnv("CRON_API_KEY", undefined);
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    expect(isAuthorizedCronRequest(createRequest({ authorization: "Bearer test-cron-secret" }))).toBe(true);
  });
});
