CREATE TYPE "public"."account_deletion_source" AS ENUM('user', 'facebook');--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"source" "account_deletion_source" NOT NULL,
	"confirmation_code" text NOT NULL,
	CONSTRAINT "account_deletion_requests_confirmation_code_unique" UNIQUE("confirmation_code")
);
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_active_user_idx" ON "account_deletion_requests" USING btree ("user_id") WHERE "account_deletion_requests"."cancelled_at" IS NULL AND "account_deletion_requests"."completed_at" IS NULL;