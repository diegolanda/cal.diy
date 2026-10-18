# Nuen Railway production runbook

This runbook defines the small production deployment for Nuen. It requires one web service and one PostgreSQL service.

## Services and domains

Create these services in one Railway project and environment:

- `web`: Build the repository root with `Dockerfile`. Add the `cal.nuen.io` custom domain. Set `PORT=3000` on the service and use target port 3000 for the custom domain.
- `Postgres`: Use Railway PostgreSQL. Keep it on Railway's private network without a public domain.

Start with one `web` replica. The database is the shared source of truth, so a second replica can be added later
without changing the application architecture. Keep at least one previous successful deployment available for rollback.

The Docker image starts the generated Next.js standalone server directly after URL replacement, migrations, and app-store seeding.
It keeps the server in `apps/web/server.js`, beside the existing `public` and `.next/static` directories.
This avoids persistent Yarn and Turbo launcher processes. Runtime dependencies remain available for startup tasks.

Set the `web` health check path to `/api/health`. A healthy response is HTTP 200 with `{"status":"ok"}`. A database failure returns HTTP 503 without an error message or connection detail.
Set `RAILWAY_HEALTHCHECK_TIMEOUT_SEC=600` on the `web` service so database migrations can finish before Railway stops the deployment.

Use one Railway environment named `production`. Validate the deployment before you route public traffic to it.

Paste `deploy/railway-production.env.example` into the `web` service Raw Editor. Replace every
`REPLACE_WITH_*` value before you deploy. Seal the three generated secrets, the Google OAuth JSON, and the
Resend API key after you save them.

The Docker build uses fixed, non-secret placeholders for server-only values. Railway supplies the real database
and secret variables only to the running container. Do not add these server-only variables as Docker build arguments.

## Required web variables

Set these variables on the `web` service. Store generated values and provider credentials as sealed Railway variables.

| Variable | Production value or source |
| --- | --- |
| `DATABASE_URL` | Reference `Postgres.DATABASE_URL`. |
| `DATABASE_DIRECT_URL` | Use the same private database URL while no pooler is present. |
| `DATABASE_HOST` | `${{Postgres.PGHOST}}:${{Postgres.PGPORT}}`. The startup check requires both values. |
| `PORT` | `3000`. The Docker image, Railway health check, and custom domain must use the same port. |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://cal.nuen.io` |
| `NEXTAUTH_URL` | `https://cal.nuen.io` |
| `NEXT_PUBLIC_WEBSITE_URL` | `https://cal.nuen.io`; Cal booking URLs use this value. The Nuen landing page links to explicit booking URLs. |
| `NEXTAUTH_SECRET` | Generate a unique secret with `openssl rand -base64 32`. |
| `CALENDSO_ENCRYPTION_KEY` | Generate the required 32-character value with `openssl rand -base64 24`. |
| `GOOGLE_LOGIN_ENABLED` | `true` |
| `GOOGLE_API_CREDENTIALS` | The Google OAuth web-client JSON for the Nuen Workspace project. |
| `GOOGLE_WORKSPACE_AUTH_ENABLED` | `true` |
| `GOOGLE_WORKSPACE_AUTH_DOMAIN` | `nuen.io` |
| `GOOGLE_WORKSPACE_ADMIN_EMAILS` | Comma-separated Nuen system administrators; set before their first sign-in. |
| `NEXT_PUBLIC_DISABLE_SIGNUP` | `true` |
| `ORGANIZATIONS_ENABLED` | `false`; Nuen uses root Teams, not the commercial Organizations layer. |
| `RESEND_API_KEY` | A restricted Resend API key for the verified Nuen sending domain. |
| `EMAIL_SERVER_PORT` | `2465`; Railway can reach Resend on this secure alternative SMTP port. |
| `EMAIL_FROM` | A verified address such as `calendar@nuen.io`. |
| `EMAIL_FROM_NAME` | `Nuen` |
| `CRON_SECRET` | Generate a separate random secret for scheduled endpoint calls. |
| `RAILWAY_HEALTHCHECK_TIMEOUT_SEC` | `600`. Allow startup migrations to finish before the deployment health check times out. |
| `CALCOM_TELEMETRY_DISABLED` | `1` |
| `CSP_POLICY` | `non-strict`; this is the supported production CSP mode. Do not use `strict`. |

The Google OAuth client must allow both redirect URIs. Keep the Calendar callback first in the
`redirect_uris` array because the Calendar integration uses the first value:

```text
https://cal.nuen.io/api/integrations/googlecalendar/callback
https://cal.nuen.io/api/auth/callback/google
```

Configure the Google Cloud OAuth consent screen as an Internal Workspace app. Enable the Google Calendar
API and grant `calendar.events` and `calendar.readonly`. Google sign-in requests these scopes and creates the
initial Calendar and Meet records. Each user must still confirm the selected and destination calendars.
Add `https://cal.nuen.io` as an authorized JavaScript origin.

The application access policy must also enforce the exact `nuen.io` email domain on the server. Google OAuth configuration alone is not an application authorization control.

Enforce two-step verification for the three users in Google Workspace. Restricted mode relies on Google's second factor because Google-created Cal.diy accounts do not have local passwords.

## Nuen branding variables

Set these variables before the Docker build. Railway rebuilds the image when a service variable changes.

| Variable | Production value |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Nuen Calendar` |
| `NEXT_PUBLIC_COMPANY_NAME` | `Nuen` |
| `NEXT_PUBLIC_WEBSITE_URL` | `https://cal.nuen.io` |
| `NEXT_PUBLIC_SUPPORT_MAIL_ADDRESS` | A monitored `@nuen.io` support address. |
| `NEXT_PUBLIC_EMBED_LIB_URL` | `https://cal.nuen.io/embed/embed.js` |
| `NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL` | `https://www.nuen.io/privacy` |
| `NEXT_PUBLIC_WEBSITE_TERMS_URL` | The published Nuen terms URL. Do not leave the placeholder in production. |
| `NEXT_PUBLIC_LICENSE_CONSENT` | `agree` |
| `EMAIL_FROM_NAME` | `Nuen` |

These values change product names, support links, email sender names, and the embed origin. This branch also includes the Nuen logo, browser icons, colors, and typography defaults.

## Values you must supply

Replace these placeholders before the first deployment:

| Placeholder | Required value |
| --- | --- |
| `REPLACE_WITH_MONITORED_SUPPORT_ADDRESS@nuen.io` | A monitored support mailbox. |
| `REPLACE_WITH_NUEN_TERMS_URL` | The published Nuen terms URL. The website currently provides `/privacy` but no `/terms` route. |
| `REPLACE_WITH_GOOGLE_CLIENT_ID` | The client ID from the Internal Google Workspace OAuth web client. |
| `REPLACE_WITH_GOOGLE_CLIENT_SECRET` | The client secret from the same OAuth client. |
| `REPLACE_WITH_ADMIN_ADDRESS@nuen.io` | One or more comma-separated Nuen administrator addresses. |
| `REPLACE_WITH_RESEND_API_KEY` | A restricted key for the verified Nuen sending domain. |
| `REPLACE_WITH_VERIFIED_SENDER@nuen.io` | The verified transactional sender address. |

Generate the three remaining values once:

```sh
openssl rand -base64 32 # NEXTAUTH_SECRET
openssl rand -base64 24 # CALENDSO_ENCRYPTION_KEY: exactly 32 characters
openssl rand -hex 32    # CRON_SECRET
```

Store each output as a separate sealed Railway variable. Keep a secure recovery copy of
`CALENDSO_ENCRYPTION_KEY`. Changing that key after users connect calendars makes the stored credentials unreadable.

## Scheduled work

The base booking flow does not need a separate long-running worker. The `task-cron` service is optional. Add it when delayed tasks or reminders are enabled.

Call this authenticated endpoint:

| Schedule | Endpoint | Purpose |
| --- | --- | --- |
| Every five minutes | `/api/tasks/cron` | Process queued tasks. |

Send `Authorization: Bearer <CRON_SECRET>` on every call. Do not put the secret in the URL. The current cleanup endpoint does not delete records and must not be scheduled until its repository implementation is completed.

Railway cron jobs run a service command and exit; they do not make authenticated HTTP requests automatically. Create a source-linked copy of the `web` service named `task-cron`, or publish the image and use it for both services. Railway does not share another service's private build artifact automatically. Use this configuration:

- Variables: `CRON_SECRET=${{web.CRON_SECRET}}` and `WEB_PRIVATE_URL=http://${{web.RAILWAY_PRIVATE_DOMAIN}}:${{web.PORT}}`.
- Cron schedule: `*/5 * * * *`.
- Start command: `/bin/sh -c 'wget -qO- --header="Authorization: Bearer ${CRON_SECRET}" "${WEB_PRIVATE_URL}/api/tasks/cron"'`.

The command exits after each request. Railway skips a scheduled invocation when the previous run is still active. Railway cron jobs cannot run more often than every five minutes, so queued work can be delayed by that amount. Railway cron schedules use UTC.

Do not enable the calendar-subscription or delegation cron routes for this initial deployment. The three-user Google OAuth setup does not use domain-wide delegation or calendar caching.

## Backups and recovery

Configure these controls on the PostgreSQL service. The external backup job is optional until its storage provider is configured:

1. Enable daily and weekly Railway volume backups.
2. Enable point-in-time recovery, wait for its first base backup, and record the displayed restore window. If the selected plan does not provide it, record that exception and the accepted recovery-point objective before launch.
3. Run a weekly backup job outside the web service with read-only access to the private production database and write-only access to a Nuen object-storage prefix.
4. Give that job `DATABASE_URL`, `BACKUP_ENCRYPTION_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and `BACKUP_S3_URI` through its secret store.
5. Create and upload the encrypted backup:

   ```sh
   pg_dump "$DATABASE_URL" --format=custom --file=cal.dump
   openssl enc -aes-256-cbc -salt -pbkdf2 -in cal.dump -out cal.dump.enc -pass env:BACKUP_ENCRYPTION_PASSWORD
   aws s3 cp cal.dump.enc "$BACKUP_S3_URI/weekly/cal-$(date -u +%Y-%m-%d).dump.enc"
   ```

6. Apply an object-storage lifecycle that retains 4 weekly and 12 monthly backups.
7. Download and restore one backup into a temporary, isolated PostgreSQL service each month:

   ```sh
   openssl enc -d -aes-256-cbc -pbkdf2 -in cal.dump.enc -out cal.dump -pass env:BACKUP_ENCRYPTION_PASSWORD
   pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" cal.dump
   ```

8. Record the restore duration and the restored booking count.

Before each production schema deployment, create a manual volume backup. Do not wipe the PostgreSQL volume because that action also removes its volume backups.

Add an external uptime monitor for `https://cal.nuen.io/api/health`; Railway's deployment health check does not continuously monitor the running service.

Removing an address from `GOOGLE_WORKSPACE_ADMIN_EMAILS` does not demote an existing administrator or invalidate sessions. During offboarding, demote or lock the database user, revoke their Google OAuth grant, remove Team memberships, and invalidate active sessions before removing the address from the variable.

## Initial Nuen setup

Perform this once in production before you route public traffic to it. Record the Team and event URLs:

1. Have each of the three users sign in with their verified `@nuen.io` Google account so the local user exists.
2. Have a configured system administrator create the `Recruitment`, `Billing`, and `HR` root Teams.
3. Add the appropriate existing Workspace users to each Team. Give routine schedulers `MEMBER`; give Team maintainers `ADMIN`.
4. In each user's **Settings > My Account > Calendars** page, confirm Google Calendar is connected. Select the calendars used for conflict checks and the destination calendar.
5. Confirm Google Meet is available and make it the location for event types that need a video call.
6. Have a Team owner or administrator create the round-robin event, then add the participating Team members as hosts and confirm each host has usable availability.
7. Configure and rebuild the Nuen website with these public variables:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_CAL_ORIGIN` | `https://cal.nuen.io` |
   | `NEXT_PUBLIC_CAL_HIRING_URL` | `https://cal.nuen.io/team/recruitment/hiring-call` |
   | `NEXT_PUBLIC_CAL_RECRUITER_URL` | `https://cal.nuen.io/team/recruitment/recruiter-intro` |

   The Nuen website validates both booking URLs against `NEXT_PUBLIC_CAL_ORIGIN`, adds `/embed` only inside
   its iframe, and uses the same origin in its Content Security Policy.

## Release checks

Complete these checks in production before you route public traffic to it:

1. Confirm that `/api/health` returns HTTP 200.
2. During the initial maintenance window, confirm that an unreachable database makes `/api/health` return HTTP 503.
3. Sign in with all three Nuen Workspace accounts.
4. Confirm that a non-`nuen.io` account cannot enter the dashboard.
5. Create, reschedule, and cancel a personal booking.
6. Create a round-robin Team booking and confirm its Google Calendar event and Google Meet link.
7. Confirm that an external attendee can use public and embedded booking pages without a Nuen account.
8. Confirm that transactional email passes SPF, DKIM, and DMARC checks.
9. Run one backup restore drill and save the result outside Railway.

See the Railway documentation for [health checks](https://docs.railway.com/deployments/healthchecks), [cron jobs](https://docs.railway.com/cron-jobs), [variables](https://docs.railway.com/variables), and [PostgreSQL recovery](https://docs.railway.com/guides/postgres-backups-restores).
