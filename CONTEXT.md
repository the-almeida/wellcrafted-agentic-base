# Domain Glossary

This file holds the project's shared vocabulary. Terms here are canonical — code, conversations, and tests must use them consistently.

`/wc-grill` updates this file inline as terms are resolved.

## Glossary

**account deletion request** — A row in `account_deletion_requests` representing a user's pending or completed request to delete their account. Created by self-serve action or Facebook data-deletion callback. Status is derived from timestamp columns, not a separate enum.

**grace period** — The window between when an account deletion is requested and when the purge runs. Default 30 days, env-configurable. During this period the account is soft-deleted: the `auth.users` row still exists, but the user is gated to a pending-deletion interstitial on sign-in.

**pending deletion** — State of an account that has an active (non-cancelled, non-completed) deletion request. On sign-in, users in this state are redirected to `/account/pending-deletion` where they can cancel or sign out.

**access level** — What a signed-in caller may do given their account state. **full** (the default) admits only active accounts; **grace-period** also admits accounts pending deletion, for the flows that must keep working during the grace period (the pending-deletion page, cancelling or re-requesting deletion). Independent of role: an admin pending deletion is refused full access too. Anonymous mode will add a level.

**purge** — The terminal step of a deletion request: delete from `auth.users`, allowing `ON DELETE CASCADE` foreign keys to drop owned data. Runs on a `pg_cron` schedule reading `account_deletion_requests` where `scheduled_for < now()`.

**confirmation code** — Random 16-byte URL-safe token stored on each `account_deletion_requests` row. Used as the public handle for Facebook's status URL (`/data-deletion/status?code=…`). Distinct from the row UUID so internal IDs are not exposed.

**Data Protection Officer (DPO)** — The role defined by GDPR Art. 37 and LGPD Art. 41 (LGPD calls it "Encarregado" but accepts the DPO title). The contact responsible for handling data subject requests and privacy inquiries. Surfaced in the Privacy Policy via `{{DPO_NAME}}` / `{{DPO_EMAIL}}` placeholders.

**rights request channel** — The mailto link published in the Privacy Policy through which users exercise LGPD Art. 18 / GDPR Art. 15–22 rights (access, correction, deletion, portability, revocation). Self-serve account deletion is the in-app shortcut; the channel is the catch-all for everything else.

**rate limit** — A cap on how many times one subject (an email, an IP, a user) may call a public endpoint within a fixed window. It is defense against abuse, not authorization: when the backing store is unavailable the limit fails open (the call proceeds) and the failure is reported loudly to logs and Sentry. Distinct from Supabase Auth's own built-in limits, which apply only to Supabase endpoints.

**active OAuth provider** — An OAuth provider (Google, Facebook) whose client id is set in the app's environment. Only active providers get a button on the sign-in and sign-up pages. The provider must also be enabled in Supabase (dashboard in production, `supabase/config.toml` locally); the app checks that the two agree before a deploy. The client id is public, so having it in the app's environment exposes nothing.

**verified email** — The person proved control of the account's email address, by entering an emailed code or by signing in with an OAuth provider. Recorded as `email_verified_at` on the account; the first verification is kept. Distinct from Supabase's "confirmed" email (`email_confirmed_at`), which Supabase sets at password sign-up while Confirm email is off, so an account created with a password starts unverified. Future features (for example a banner inviting the person to verify) read this, not Supabase's flag. It proves control of the email, not sole ownership of the account: with Confirm email off, someone else may have created the account with a password first (see "Pre-account takeover" in docs/conventions.md).

**evasive test** — A test containing steps or assertions that exist only to bypass a failing path (filling a field the code under test does not read, swallowing an expected exception with a generic catch, asserting absence of an element that was never going to render, sleeping instead of waiting on a real signal) rather than letting the failure surface the underlying bug. Detected by `@wc-test-auditor`, which runs from `/wc-tdd` after each GREEN. Findings are either resolved by editing the test or overridden inline with `// @wc-test-auditor-allow: <heuristic-id> — <reason>`. Distinct from "flaky test" (nondeterminism) and "brittle test" (over-coupled to implementation).
