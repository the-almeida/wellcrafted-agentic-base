# Deployment (Vercel + Supabase)

Production runs on **Vercel** (Next.js) and **Supabase cloud** (Postgres + Auth). Nothing in this repo deploys or migrates on its own: CI (`.github/workflows/ci.yml`) only lints and tests. Deploys come from the Vercel GitHub integration, and migrations are applied by hand with the Supabase CLI.

The first time, follow the setup steps in order, starting at section 2. After that, [Every release](#every-release) is the only part you repeat.

## 1. Services overview

> Reference only, nothing to execute here. This table maps the services the app depends on in production and what breaks without each one. The setup steps start in [section 2](#2-supabase-project).

| Service                                 | Prod status          | Without it                                                                                                                                |
| --------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase (Postgres + Auth)              | Required             | App does not boot (env validation fails)                                                                                                  |
| Custom SMTP (e.g. Resend)               | Required in practice | Supabase's built-in mailer only reaches your own team's addresses and has a tiny hourly cap. Sign-up and OTP sign-in break for real users |
| Redis (Vercel Marketplace, "Vercel KV") | Required in practice | Rate limiting falls back to per-instance memory. Serverless runs many instances, so limits are not enforced. The app stays up either way  |
| Sentry                                  | Recommended          | No error reporting. App works                                                                                                             |
| PostHog                                 | Optional             | `track()` is a no-op                                                                                                                      |
| Google / Facebook OAuth                 | Optional             | That provider's sign-in button is hidden. Email sign-in still works                                                                       |

## 2. Supabase project

1. Create a project at https://supabase.com/dashboard. Pick the region closest to your Vercel functions region.
2. Link and push migrations from your machine:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push
   ```

   `db push` applies every file in `supabase/migrations/` (Drizzle-generated and hand-authored, one ordered sequence, see ADR-0003).

3. Check that the account-deletion purge job exists. The migration enables `pg_cron` and schedules it: Dashboard → Integrations → Cron should list `purge-expired-account-deletions`.

## 3. SMTP (required for real users)

Supabase's default mailer is meant for testing only: it sends only to members of your Supabase org and caps sends at a handful per hour. Configure a provider before inviting any real user.

**Recommended: [Resend](https://resend.com).** Its free tier (3,000 emails/month, 100/day when this was written; check current limits) is enough for an early-stage product, and Supabase has a native integration.

1. Create a Resend account and **verify your sending domain** (add the DNS records it gives you). Unverified domains can only send to your own address.
2. Create an API key with "Sending access".
3. Choose one:
   - **Integration:** Resend dashboard → Integrations → Supabase. It fills the SMTP settings for you.
   - **Manual:** Supabase Dashboard → Authentication → Emails → SMTP Settings:

     | Field        | Value                             |
     | ------------ | --------------------------------- |
     | Host         | `smtp.resend.com`                 |
     | Port         | `465`                             |
     | Username     | `resend`                          |
     | Password     | the Resend API key                |
     | Sender email | `no-reply@<your-verified-domain>` |
     | Sender name  | your product name                 |

4. Delivery is tested end to end in [section 6](#6-supabase-auth-configuration), once the app is deployed.

Alternatives if Resend does not fit: Brevo (daily free quota), Postmark (strong deliverability, small free quota), AWS SES (cheapest at volume, starts in a sandbox). All of them work through the same SMTP settings screen.

## 4. Vercel project

1. Import the GitHub repo in Vercel. The framework preset (Next.js) and the default build command work as is. `pnpm build` first runs `pnpm check:oauth-providers`, which asks the Supabase project which sign-in providers are enabled and fails the build if they disagree with the app env (see [section 7](#7-oauth-providers-optional)). So the Supabase variables must be available at build time, and the project must be reachable from Vercel's build.
2. Set the environment variables before the first deploy, either on the import screen or in Settings → Environment Variables. Without the required ones the app fails env validation. Scope them per environment (Production / Preview / Development):

| Variable                                                    | Required           | Where to get it                                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                       | Yes                | `https://<your-domain>`                                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`                                  | Yes                | Supabase → Project Settings → API                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                             | Yes                | Supabase → API Keys (anon / publishable key)                                                                                                                                                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Yes                | Supabase → API Keys (`service_role` / secret key). Server-only, never give it a `NEXT_PUBLIC_` prefix                                                                                                                                                   |
| `DATABASE_URL`                                              | Yes                | Supabase → Connect → **Transaction pooler** string (port `6543`). See [why](#why-the-transaction-pooler)                                                                                                                                                |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN`                     | In practice        | Injected automatically when you connect the Redis store (section 5). Without it, rate limiting is in-memory per instance, so each Vercel instance counts separately and limits on sign-in, sign-up and webhooks are not enforced. The app keeps working |
| `NEXT_PUBLIC_SENTRY_DSN`                                    | Recommended        | Sentry → Project Settings → Client Keys                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`      | Optional           | PostHog → Project Settings                                                                                                                                                                                                                              |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`     | Only with Google   | Same values as in Supabase. Shows the Google button (section 7)                                                                                                                                                                                         |
| `FACEBOOK_OAUTH_CLIENT_ID` / `FACEBOOK_OAUTH_CLIENT_SECRET` | Only with Facebook | Same values as in Supabase. Shows the Facebook button and verifies data-deletion callbacks (section 7)                                                                                                                                                  |
| `LOG_LEVEL`                                                 | No                 | Defaults to `info`                                                                                                                                                                                                                                      |
| `ACCOUNT_DELETION_GRACE_DAYS`                               | No                 | Defaults to `30`                                                                                                                                                                                                                                        |

#### Why the transaction pooler

- **Serverless opens many connections.** Each Vercel instance opens its own, and a traffic spike can hit Postgres's limit. The pooler shares a few real connections across all instances.
- **Direct connection doesn't work from Vercel.** It's IPv6-only, and Vercel doesn't support IPv6.
- **`prepare: false` is required in this mode**, and `src/shared/db/client.ts` already sets it.

#### Preview deployments

If Preview uses the same Supabase variables as Production, every PR preview reads and writes production data. Give Preview its own values pointing at a separate Supabase project (staging), or use Supabase Branching.

## 5. Redis for rate limiting

This needs the Vercel project from section 4. In the project, go to Storage → Marketplace → pick a Redis provider (Upstash) → connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project automatically, so you do not set them by hand. Env changes only apply to new deployments: redeploy (Deployments → ⋯ → Redeploy) after connecting the store. If the log shows `[rate-limit] in-memory rate limiting active` in production, the store is not connected.

On the first deploy with the store connected, sign in once and confirm it succeeds. The limiter counts with one Lua script (`EVAL`). CI runs it against a real Redis behind `serverless-redis-http`, which speaks the Upstash REST API, but never against a real Upstash database.

Rate limiting never blocks access to the app:

- **Store not connected:** the in-memory fallback is used, and everything works without real protection.
- **Store connected but unreachable** (provider outage, revoked token): the limiter fails open. Requests go through without being counted until Redis is back, so sign-in and sign-up keep working, unprotected against brute force during the outage.

## 6. Supabase Auth configuration

**Why this is a step:** `supabase db push` only applies SQL. The auth settings in `supabase/config.toml` configure the **local** stack and never reach the cloud project, so a new project starts with Supabase's defaults, which do not match what the app expects. This needs the app URL from section 4 and working SMTP from section 3.

All settings are in Supabase Dashboard → Authentication.

1. **URL Configuration.** Set Site URL to `https://<your-domain>`. Add `https://<your-domain>/**` to Redirect URLs, plus `https://*-<vercel-team-slug>.vercel.app/**` if preview deployments should be able to sign in.
   _If skipped:_ Supabase only redirects to allow-listed URLs, so email links and OAuth returns go to `localhost:3000` or fail.
2. **Email templates.** Paste `supabase/templates/confirmation.html` into _Confirm signup_ and `supabase/templates/magic_link.html` into _Magic Link_.
   _If skipped:_ sign-up and sign-in ask for a 6-digit code (`{{ .Token }}`), but the default templates only contain a link, so users get an email with no code to type.
3. **Confirm email** (Sign In / Providers → Email). Turn it **off**, matching local (`enable_confirmations = false`). The cloud default is on.
   _If skipped:_ password sign-up creates the user without a session, so the redirect to `/dashboard` bounces back to `/sign-in` with no explanation.
   _Trade-off:_ password sign-up accepts unverified emails. OTP sign-up is unaffected, since entering the code verifies the email.
4. **Anonymous sign-ins** (Sign In / Providers → "Allow anonymous sign-ins"). Turn it **on**, matching the app's default (anonymous mode, "Continue without an account"). To leave anonymous mode out, set `ANONYMOUS_SIGN_INS_ENABLED=false` in Vercel and keep this off.
   _If skipped:_ the build fails (`pnpm check:oauth-providers` compares both). Supabase limits anonymous sign-ins to 30 per hour per IP; the limit is per visitor because the sign-in runs in the browser.
5. **Rate limits.** Raise "emails sent per hour" (30 by default with custom SMTP) to fit expected traffic.
   _If skipped:_ every sign-up or sign-in email after the 30th in an hour fails.
6. **Smoke test.** On the production URL, create an account with a real address, receive the code, and finish sign-up. Then sign out and sign in with an emailed code. This validates SMTP, templates, and URL configuration together.

## 7. OAuth providers (optional)

Each provider redirects to **Supabase**, and Supabase then redirects to the app's `/auth/callback`, which must be covered by the Redirect URLs from section 6.

| Where                                                            | What to register                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| Google Cloud Console → Credentials → Authorized redirect URI     | `https://<project-ref>.supabase.co/auth/v1/callback`    |
| Facebook Developers → Facebook Login → Valid OAuth Redirect URIs | `https://<project-ref>.supabase.co/auth/v1/callback`    |
| Facebook Developers → Settings → Data Deletion Request URL       | `https://<your-domain>/api/auth/facebook/data-deletion` |
| Supabase → Authentication → Providers → Google / Facebook        | Enable, then paste the client ID and secret             |

Each provider's credentials go in **two places**, with the same values:

- **Supabase dashboard** (table above): Supabase Auth uses them to run the OAuth flow.
- **Vercel env** (`GOOGLE_OAUTH_*` / `FACEBOOK_OAUTH_*`, section 4): the app uses them to decide which sign-in buttons to show. The Facebook secret also verifies data-deletion callbacks, so with Facebook active it is required: the build fails without it, and if it goes missing after the build the endpoint answers `503 facebook_data_deletion_not_configured` and reports to the logs and Sentry. With neither Facebook variable set, the endpoint answers 404. To turn Facebook sign-in off later, remove only the client id and keep the secret, so existing Facebook users can still request deletion through Facebook.

Set only one side and the build fails, naming the provider (see [docs/conventions.md → OAuth providers](./conventions.md#oauth-providers)). The check runs at build time only: a provider changed in the Supabase dashboard after a deploy goes unnoticed until the next build, so change providers through a deploy.

Then run the manual OAuth smoke in [docs/dod.md → Release checklist (auth)](./dod.md#release-checklist-auth).

## 8. Observability

- **Logs:** Pino writes JSON to stdout, so they show up in Vercel → Logs. Correlate with `requestId`.
- **Sentry:** setting `NEXT_PUBLIC_SENTRY_DSN` turns on error capture **on the server only**. Known gaps: the browser SDK is never initialized (`sentry.client.config.ts` is not loaded because there is no `instrumentation-client.ts` and no `withSentryConfig`), so client errors are not reported; and source maps are not uploaded, so `SENTRY_AUTH_TOKEN` is unused and stack traces show minified code.
- **PostHog:** setting the key turns on the events declared in `src/shared/observability/analytics/`. There is no autocapture.

## Every release

1. If the PR adds files to `supabase/migrations/`, run `pnpm exec supabase db push` **before** merging, so the code never runs against an older schema. Keep migrations backward-compatible with the code that is already deployed.
2. Merge to `main`, and Vercel deploys.
3. If auth changed, run the release checklist in [docs/dod.md](./dod.md#release-checklist-auth).
