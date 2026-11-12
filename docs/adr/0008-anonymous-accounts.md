# 0008. Anonymous Accounts in the Base Template

Date: 2026-11-12
Status: Accepted.

## Context

The first project built on this template should be usable without signing up: people try the app first and keep an account later, if ever. Supabase Auth has native anonymous sign-ins (`signInAnonymously()`), which create a real `auth.users` row with `is_anonymous = true` and a normal session. Without the app knowing about them, an anonymous session would pass `requireUser` as a full account, or fail as "no record".

## Decision

- **On by default**, behind `ANONYMOUS_SIGN_INS_ENABLED` (unset or `true` on, `false` off). The build check compares it with Supabase's `external.anonymous_users` and fails when they differ, like the OAuth providers.
- **The browser signs in**, never a server action: Supabase limits anonymous sign-ins per caller IP, and from the server every visitor would share the server's IPs. The nickname goes in the sign-in metadata; the database trigger copies it and draws the discriminator. The database checks on `public.users` are the real validation; the form's `NicknameSchema` mirrors them and a test runs the same cases against both.
- **One `User` shape** with `isAnonymous`, a nullable `email` and `name`, and a **public profile** (`nickname` + `discriminator`, unique case-insensitively), stored as columns of `public.users`.
- **Fail-closed access.** `requireUser()` refuses anonymous accounts (`PermanentAccountRequiredError`); callers opt in with `requireUser({ allow: ['anonymous'] })`. Policies refuse every write from an anonymous account except its own nickname (`examplePolicy` shows the pattern, checked before ownership). `requireUser({ allow })` replaces the `access` levels of item 6: `'pending-deletion'` is the former `'grace-period'`, and both allowances combine.
- **Keeping the account** adds an email and password with `updateUser({ email, password })`: same id, same profile, effective at once and unverified, because Confirm email stays off (simple entry matters more than verified emails for this template). The first proof of that email later replaces the password and ends other sessions (see `docs/conventions.md`, "Auth: accepted trade-offs").
- **Retention** is the same as any account: kept until the person asks for deletion; anonymous accounts can request it too.
- Deferred: keeping an account through OAuth (`linkIdentity()` needs `enable_manual_linking`, which the build check cannot see, and a real provider to test); phone/SMS; captcha.

## Alternatives considered

- **A separate access level per state (`access: 'anonymous'`).** Rejected: an anonymous account pending deletion needs both exceptions, and single levels would multiply.
- **Anonymous accounts pass by default and only policies refuse writes.** Rejected: every forgotten policy check would be a hole; opting in per page fails closed.
- **A `profiles` table.** Rejected for now: one row per user already exists and the RLS story stays the same; split it when profiles grow.
- **Confirm email on, with verified email changes.** Closes the takeover and enumeration trade-offs, but adds a code step to sign-up and to keeping an account. Rejected by the owner for this template: few, known users, and entry must stay simple.

## Consequences

- A new fork's first build fails until anonymous sign-ins are enabled in the Supabase dashboard or `ANONYMOUS_SIGN_INS_ENABLED=false`; the message names both.
- Anonymous accounts accumulate forever unless deleted; one whose session is lost cannot be reached again.
- Any new page or action must decide whether anonymous accounts may use it; the default refuses them.
