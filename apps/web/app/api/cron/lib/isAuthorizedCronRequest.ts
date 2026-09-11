import process from "node:process";
import type { NextRequest } from "next/server";

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const providedCredential =
    request.headers.get("authorization") || request.nextUrl.searchParams.get("apiKey");
  const cronApiKey = process.env.CRON_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (cronApiKey && providedCredential === cronApiKey) return true;
  return Boolean(cronSecret && providedCredential === `Bearer ${cronSecret}`);
}
