import { afterEach, describe, expect, it, vi } from "vitest";

describe("serverConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the default secure Resend SMTP port", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_SERVER_PORT", "");

    const { serverConfig } = await import("./serverConfig");

    expect(serverConfig.transport).toMatchObject({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
    });
  });

  it("uses the configured secure Resend SMTP port", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_SERVER_PORT", "2465");

    const { serverConfig } = await import("./serverConfig");

    expect(serverConfig.transport).toMatchObject({
      host: "smtp.resend.com",
      port: 2465,
      secure: true,
    });
  });

  it("ignores an invalid Resend SMTP port", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_SERVER_PORT", "invalid");

    const { serverConfig } = await import("./serverConfig");

    expect(serverConfig.transport).toMatchObject({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
    });
  });
});
