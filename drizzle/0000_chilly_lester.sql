CREATE TABLE "card_cell" (
	"participation_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"square_id" uuid,
	CONSTRAINT "card_cell_participation_id_position_pk" PRIMARY KEY("participation_id","position"),
	CONSTRAINT "card_square_unique" UNIQUE("participation_id","square_id"),
	CONSTRAINT "card_position_valid" CHECK ("card_cell"."position" between 0 and 24),
	CONSTRAINT "card_free_center" CHECK (("card_cell"."position" = 12) = ("card_cell"."square_id" is null))
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"claimant_participation_id" uuid NOT NULL,
	"confirmer_participation_id" uuid NOT NULL,
	"square_id" uuid NOT NULL,
	"code_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_code_unique" UNIQUE("code_id"),
	CONSTRAINT "claim_square_unique" UNIQUE("event_id","claimant_participation_id","square_id"),
	CONSTRAINT "claim_confirmer_unique" UNIQUE("event_id","claimant_participation_id","confirmer_participation_id"),
	CONSTRAINT "claim_request_unique" UNIQUE("event_id","claimant_participation_id","request_id"),
	CONSTRAINT "claim_no_self" CHECK ("claim"."claimant_participation_id" <> "claim"."confirmer_participation_id")
);
--> statement-breakpoint
CREATE TABLE "code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"owner_participation_id" uuid NOT NULL,
	"token_digest" "bytea" NOT NULL,
	"token_ciphertext" "bytea" NOT NULL,
	"ordinal" smallint NOT NULL,
	"redeemed_claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "code_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "code_owner_ordinal_unique" UNIQUE("event_id","owner_participation_id","ordinal"),
	CONSTRAINT "code_event_owner_unique" UNIQUE("event_id","owner_participation_id","id"),
	CONSTRAINT "code_ordinal_valid" CHECK ("code"."ordinal" between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "event_host" (
	"event_id" uuid NOT NULL,
	"auth_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_host_event_id_auth_user_id_pk" PRIMARY KEY("event_id","auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"rules_version" integer NOT NULL,
	"card_version" text NOT NULL,
	"code_allowance" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_status_valid" CHECK ("event"."status" in ('draft','open','closed')),
	CONSTRAINT "event_allowance_valid" CHECK ("event"."code_allowance" between 1 and 24),
	CONSTRAINT "event_window_valid" CHECK ("event"."closes_at" is null or "event"."opens_at" is null or "event"."closes_at" > "event"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "host_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_auth_user_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"token_digest" "bytea" NOT NULL,
	"participation_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"recruitment_consent" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participation_user_event_unique" UNIQUE("event_id","auth_user_id"),
	CONSTRAINT "participation_event_id_unique" UNIQUE("event_id","id"),
	CONSTRAINT "participation_name_valid" CHECK (length("participation"."display_name") between 1 and 80),
	CONSTRAINT "participation_consent_valid" CHECK ("participation"."recruitment_consent" = ("participation"."consent_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"participation_id" uuid NOT NULL,
	"bucket_key" text NOT NULL,
	"tokens" integer NOT NULL,
	"refilled_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_bucket_participation_id_bucket_key_pk" PRIMARY KEY("participation_id","bucket_key"),
	CONSTRAINT "rate_tokens_nonnegative" CHECK ("rate_limit_bucket"."tokens" >= 0)
);
--> statement-breakpoint
CREATE TABLE "skill_selection" (
	"participation_id" uuid NOT NULL,
	"skill_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_selection_participation_id_skill_key_pk" PRIMARY KEY("participation_id","skill_key")
);
--> statement-breakpoint
CREATE TABLE "square" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_version" text NOT NULL,
	"square_key" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"skill_key" text,
	CONSTRAINT "square_version_key_unique" UNIQUE("card_version","square_key")
);
--> statement-breakpoint
ALTER TABLE "card_cell" ADD CONSTRAINT "card_cell_participation_id_participation_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_cell" ADD CONSTRAINT "card_cell_square_id_square_id_fk" FOREIGN KEY ("square_id") REFERENCES "public"."square"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_square_id_square_id_fk" FOREIGN KEY ("square_id") REFERENCES "public"."square"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_event_id_claimant_participation_id_participation_event_id_id_fk" FOREIGN KEY ("event_id","claimant_participation_id") REFERENCES "public"."participation"("event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_event_id_confirmer_participation_id_participation_event_id_id_fk" FOREIGN KEY ("event_id","confirmer_participation_id") REFERENCES "public"."participation"("event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_event_id_confirmer_participation_id_code_id_code_event_id_owner_participation_id_id_fk" FOREIGN KEY ("event_id","confirmer_participation_id","code_id") REFERENCES "public"."code"("event_id","owner_participation_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_claimant_participation_id_square_id_card_cell_participation_id_square_id_fk" FOREIGN KEY ("claimant_participation_id","square_id") REFERENCES "public"."card_cell"("participation_id","square_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code" ADD CONSTRAINT "code_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code" ADD CONSTRAINT "code_redeemed_claim_id_claim_id_fk" FOREIGN KEY ("redeemed_claim_id") REFERENCES "public"."claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code" ADD CONSTRAINT "code_event_id_owner_participation_id_participation_event_id_id_fk" FOREIGN KEY ("event_id","owner_participation_id") REFERENCES "public"."participation"("event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_host" ADD CONSTRAINT "event_host_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_audit_event" ADD CONSTRAINT "host_audit_event_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_event_id_participation_id_participation_event_id_id_fk" FOREIGN KEY ("event_id","participation_id") REFERENCES "public"."participation"("event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_bucket" ADD CONSTRAINT "rate_limit_bucket_participation_id_participation_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_selection" ADD CONSTRAINT "skill_selection_participation_id_participation_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_event_claimant_index" ON "claim" USING btree ("event_id","claimant_participation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_participation_unique" ON "invitation" USING btree ("participation_id") WHERE "invitation"."participation_id" is not null;--> statement-breakpoint
CREATE INDEX "rate_expiry_index" ON "rate_limit_bucket" USING btree ("expires_at");