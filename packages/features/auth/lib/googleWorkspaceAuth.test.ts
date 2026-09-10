import { describe, expect, it } from "vitest";
import {
  getGoogleWorkspaceAuthConfig,
  isGoogleWorkspaceAdminEmail,
  isGoogleWorkspaceAuthProviderAllowed,
  isGoogleWorkspaceSignInAllowed,
} from "./googleWorkspaceAuth";

const enabledEnvironment = {
  GOOGLE_WORKSPACE_AUTH_ENABLED: "true",
  GOOGLE_WORKSPACE_AUTH_DOMAIN: "nuen.io",
  GOOGLE_WORKSPACE_ADMIN_EMAILS: "owner@nuen.io",
};

describe("Google Workspace auth policy", () => {
  it("uses the Nuen domain when restricted auth is enabled without a configured domain", () => {
    expect(getGoogleWorkspaceAuthConfig({ GOOGLE_WORKSPACE_AUTH_ENABLED: "true" })).toEqual({
      enabled: true,
      domain: "nuen.io",
      adminEmails: [],
    });
  });

  it("normalizes a configured domain", () => {
    expect(
      getGoogleWorkspaceAuthConfig({
        GOOGLE_WORKSPACE_AUTH_ENABLED: "true",
        GOOGLE_WORKSPACE_AUTH_DOMAIN: " @NUEN.IO ",
      })
    ).toEqual({ enabled: true, domain: "nuen.io", adminEmails: [] });
  });

  it("keeps existing providers available when restricted auth is disabled", () => {
    expect(isGoogleWorkspaceAuthProviderAllowed("credentials", {})).toBe(true);
    expect(isGoogleWorkspaceAuthProviderAllowed("email", {})).toBe(true);
  });

  it("allows only the Google provider when restricted auth is enabled", () => {
    expect(isGoogleWorkspaceAuthProviderAllowed("google", enabledEnvironment)).toBe(true);
    expect(isGoogleWorkspaceAuthProviderAllowed("credentials", enabledEnvironment)).toBe(false);
    expect(isGoogleWorkspaceAuthProviderAllowed("email", enabledEnvironment)).toBe(false);
    expect(isGoogleWorkspaceAuthProviderAllowed("azure-ad", enabledEnvironment)).toBe(false);
  });

  it("allows a verified Google account on the exact configured domain", () => {
    expect(
      isGoogleWorkspaceSignInAllowed({
        provider: "google",
        email: "Person@NUEN.IO",
        emailVerified: true,
        hostedDomain: "NUEN.IO",
        environment: enabledEnvironment,
      })
    ).toBe(true);
  });

  it.each([
    ["a subdomain", "person@staff.nuen.io"],
    ["a suffix attack", "person@nuen.io.example.com"],
    ["a different domain", "person@example.com"],
    ["an invalid email", "nuen.io"],
  ])("rejects %s", (_case, email) => {
    expect(
      isGoogleWorkspaceSignInAllowed({
        provider: "google",
        email,
        emailVerified: true,
        hostedDomain: "nuen.io",
        environment: enabledEnvironment,
      })
    ).toBe(false);
  });

  it("rejects an unverified Google account", () => {
    expect(
      isGoogleWorkspaceSignInAllowed({
        provider: "google",
        email: "person@nuen.io",
        emailVerified: false,
        hostedDomain: "nuen.io",
        environment: enabledEnvironment,
      })
    ).toBe(false);
  });

  it("rejects a verified account from another provider", () => {
    expect(
      isGoogleWorkspaceSignInAllowed({
        provider: "azure-ad",
        email: "person@nuen.io",
        emailVerified: true,
        hostedDomain: "nuen.io",
        environment: enabledEnvironment,
      })
    ).toBe(false);
  });

  it("rejects a Google account without the configured Workspace tenancy claim", () => {
    expect(
      isGoogleWorkspaceSignInAllowed({
        provider: "google",
        email: "person@nuen.io",
        emailVerified: true,
        hostedDomain: undefined,
        environment: enabledEnvironment,
      })
    ).toBe(false);
  });

  it("recognizes only configured administrators on the allowed domain", () => {
    expect(isGoogleWorkspaceAdminEmail("OWNER@NUEN.IO", enabledEnvironment)).toBe(true);
    expect(isGoogleWorkspaceAdminEmail("person@nuen.io", enabledEnvironment)).toBe(false);
    expect(
      isGoogleWorkspaceAdminEmail("owner@example.com", {
        ...enabledEnvironment,
        GOOGLE_WORKSPACE_ADMIN_EMAILS: "owner@example.com",
      })
    ).toBe(false);
  });
});
