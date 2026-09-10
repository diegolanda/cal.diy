import process from "node:process";

const DEFAULT_GOOGLE_WORKSPACE_DOMAIN = "nuen.io";

type Environment = Readonly<Record<string, string | undefined>>;

const isEmailOnDomain = (email: string, domain: string): boolean => {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1] === domain;
};

export type GoogleWorkspaceAuthConfig = {
  enabled: boolean;
  domain: string;
  adminEmails: string[];
};

export const getGoogleWorkspaceAuthConfig = (
  environment: Environment = process.env
): GoogleWorkspaceAuthConfig => {
  const domain = (environment.GOOGLE_WORKSPACE_AUTH_DOMAIN || DEFAULT_GOOGLE_WORKSPACE_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  const adminEmails = (environment.GOOGLE_WORKSPACE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => isEmailOnDomain(email, domain));

  return {
    enabled: environment.GOOGLE_WORKSPACE_AUTH_ENABLED === "true",
    domain,
    adminEmails,
  };
};

export const isGoogleWorkspaceAuthProviderAllowed = (
  provider: string | undefined,
  environment: Environment = process.env
): boolean => !getGoogleWorkspaceAuthConfig(environment).enabled || provider === "google";

export const isGoogleWorkspaceSignInAllowed = ({
  provider,
  email,
  emailVerified,
  hostedDomain,
  environment = process.env,
}: {
  provider: string | undefined;
  email: string | null | undefined;
  emailVerified: boolean;
  hostedDomain: string | null | undefined;
  environment?: Environment;
}): boolean => {
  const config = getGoogleWorkspaceAuthConfig(environment);
  if (!config.enabled) return true;
  if (provider !== "google" || !email || !emailVerified) return false;
  if (hostedDomain?.trim().toLowerCase() !== config.domain) return false;

  return isEmailOnDomain(email, config.domain);
};

export const isGoogleWorkspaceAdminEmail = (
  email: string | null | undefined,
  environment: Environment = process.env
): boolean => {
  if (!email) return false;

  const config = getGoogleWorkspaceAuthConfig(environment);
  return config.enabled && config.adminEmails.includes(email.trim().toLowerCase());
};
