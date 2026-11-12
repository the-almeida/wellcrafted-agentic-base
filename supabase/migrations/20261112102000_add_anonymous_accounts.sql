ALTER TABLE "users" DROP CONSTRAINT "users_name_not_blank";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discriminator" smallint;--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_handle_idx" ON "users" USING btree (lower("nickname"),"discriminator");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unless_anonymous" CHECK ("users"."email" IS NOT NULL OR "users"."is_anonymous");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_named_somehow" CHECK ("users"."name" IS NOT NULL OR "users"."nickname" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_anonymous_has_profile" CHECK (NOT "users"."is_anonymous" OR "users"."nickname" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_anonymous_not_admin" CHECK (NOT "users"."is_anonymous" OR "users"."role" = 'user');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_profile_complete" CHECK (("users"."nickname" IS NULL) = ("users"."discriminator" IS NULL));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_discriminator_range" CHECK ("users"."discriminator" BETWEEN 1 AND 9999);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_nickname_format" CHECK ("users"."nickname" ~ '^[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ _.-]{0,22}[A-Za-z0-9À-ÖØ-öø-ÿ]$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_name_not_blank" CHECK ("users"."name" IS NULL OR btrim("users"."name") <> '');