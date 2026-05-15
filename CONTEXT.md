# Domain Glossary

This file holds the project's shared vocabulary. Terms here are canonical — code, conversations, and tests must use them consistently.

`/grill` updates this file inline as terms are resolved.

## Glossary

**account deletion request** — A row in `account_deletion_requests` representing a user's pending or completed request to delete their account. Created by self-serve action or Facebook data-deletion callback. Status is derived from timestamp columns, not a separate enum.

**grace period** — The window between when an account deletion is requested and when the purge runs. Default 30 days, env-configurable. During this period the account is soft-deleted: the `auth.users` row still exists, but the user is gated to a pending-deletion interstitial on sign-in.

**pending deletion** — State of an account that has an active (non-cancelled, non-completed) deletion request. On sign-in, users in this state are redirected to `/account/pending-deletion` where they can cancel or sign out.

**purge** — The terminal step of a deletion request: delete from `auth.users`, allowing `ON DELETE CASCADE` foreign keys to drop owned data. Runs on a `pg_cron` schedule reading `account_deletion_requests` where `scheduled_for < now()`.

**confirmation code** — Random 16-byte URL-safe token stored on each `account_deletion_requests` row. Used as the public handle for Facebook's status URL (`/data-deletion/status?code=…`). Distinct from the row UUID so internal IDs are not exposed.

**Data Protection Officer (DPO)** — The role defined by GDPR Art. 37 and LGPD Art. 41 (LGPD calls it "Encarregado" but accepts the DPO title). The contact responsible for handling data subject requests and privacy inquiries. Surfaced in the Privacy Policy via `{{DPO_NAME}}` / `{{DPO_EMAIL}}` placeholders.

**rights request channel** — The mailto link published in the Privacy Policy through which users exercise LGPD Art. 18 / GDPR Art. 15–22 rights (access, correction, deletion, portability, revocation). Self-serve account deletion is the in-app shortcut; the channel is the catch-all for everything else.
