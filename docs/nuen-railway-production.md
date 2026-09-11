# Nuen Railway production runbook

This runbook defines the small production deployment for Nuen. It uses one web service and one PostgreSQL service.

## Services and domains

Create these services in one Railway project and environment:

- `web`: Build the repository root with `Dockerfile`. Expose it through `cal.nuen.io` on port `3000`.
- `Postgres`: Use Railway PostgreSQL. Keep it on Railway's private network without a public domain.

Start with one `web` replica. The database is the shared source of truth, so a second replica can be added later
without changing the application architecture. Keep at least one previous successful deployment available for rollback.

Set the `web` health check path to `/api/health`. A healthy response is HTTP 200 with `{"status":"ok"}`. A database failure returns HTTP 503 without an error message or connection detail.
Set `RAILWAY_HEALTHCHECK_TIMEOUT_SEC=600` on the `web` service so database migrations can finish before Railway stops the deployment.

Use separate Railway environments for staging and production. Give each environment separate Google, email, and encryption credentials.

## Required web variables

Set these variables on the `web` service. Store generated values and provider credentials as sealed Railway variables.

| Variable | Production value or source |
| --- | --- |
| `DATABASE_URL` | Reference `Postgres.DATABASE_URL`. |
| `DATABASE_DIRECT_URL` | Use the same private database URL while no pooler is present. |
| `DATABASE_HOST` | `${{Postgres.PGHOST}}:${{Postgres.PGPORT}}`. The startup check requires both values. |
| `PORT` | `3000` |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://cal.nuen.io` |
| `NEXTAUTH_URL` | `https://cal.nuen.io` |
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
| `EMAIL_FROM` | A verified address such as `calendar@nuen.io`. |
| `EMAIL_FROM_NAME` | `Nuen` |
| `CRON_SECRET` | Generate a separate random secret for scheduled endpoint calls. |
| `RAILWAY_HEALTHCHECK_TIMEOUT_SEC` | `600`. Allow startup migrations to finish before the deployment health check times out. |
| `CALCOM_TELEMETRY_DISABLED` | `1` |

The Google OAuth client must allow both redirect URIs:

```text
https://cal.nuen.io/api/auth/callback/google
https://cal.nuen.io/api/integrations/googlecalendar/callback
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
| `NEXT_PUBLIC_SUPPORT_MAIL_ADDRESS` | A monitored `@nuen.io` support address. |
| `NEXT_PUBLIC_EMBED_LIB_URL` | `https://cal.nuen.io/embed/embed.js` |
| `EMAIL_FROM_NAME` | `Nuen` |

These values change product names, support links, email sender names, and the embed origin. Logo files, icons, colors, and typography require the separate Nuen interface changes.

## Scheduled work

The base booking flow does not need a separate long-running worker. Add a scheduler when delayed tasks or reminders are enabled.

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

Configure these controls on the PostgreSQL service:

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
7. Download and restore one backup into an isolated staging database each month:

   ```sh
   openssl enc -d -aes-256-cbc -pbkdf2 -in cal.dump.enc -out cal.dump -pass env:BACKUP_ENCRYPTION_PASSWORD
   pg_restore --clean --if-exists --no-owner --dbname="$STAGING_DATABASE_URL" cal.dump
   ```

8. Record the restore duration and the restored booking count.

Before each production schema deployment, create a manual volume backup. Do not wipe the PostgreSQL volume because that action also removes its volume backups.

Add an external uptime monitor for `https://cal.nuen.io/api/health`; Railway's deployment health check does not continuously monitor the running service.

Removing an address from `GOOGLE_WORKSPACE_ADMIN_EMAILS` does not demote an existing administrator or invalidate sessions. During offboarding, demote or lock the database user, revoke their Google OAuth grant, remove Team memberships, and invalidate active sessions before removing the address from the variable.

## Initial Nuen setup

Perform this once in staging, repeat it in production, and record the Team and event URLs:

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

Complete these checks in staging before production traffic starts:

1. Confirm that `/api/health` returns HTTP 200.
2. Confirm that a stopped or unreachable staging database makes `/api/health` return HTTP 503.
3. Sign in with all three Nuen Workspace accounts.
4. Confirm that a non-`nuen.io` account cannot enter the dashboard.
5. Create, reschedule, and cancel a personal booking.
6. Create a round-robin Team booking and confirm its Google Calendar event and Google Meet link.
7. Confirm that an external attendee can use public and embedded booking pages without a Nuen account.
8. Confirm that transactional email passes SPF, DKIM, and DMARC checks.
9. Run one backup restore drill and save the result outside Railway.

See the Railway documentation for [health checks](https://docs.railway.com/deployments/healthchecks), [cron jobs](https://docs.railway.com/cron-jobs), [variables](https://docs.railway.com/variables), and [PostgreSQL recovery](https://docs.railway.com/guides/postgres-backups-restores).
