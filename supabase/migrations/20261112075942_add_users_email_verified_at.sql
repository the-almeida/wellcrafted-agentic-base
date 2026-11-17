-- When the person proved control of the email (code or OAuth); set by the
-- app. Existing rows stay NULL ("not known to be verified"). A fork with real
-- data can mark OAuth users from auth.identities WHERE provider <> 'email'.
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;
