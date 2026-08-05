CREATE TYPE "public"."ingest_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"retrieval_top_k" integer,
	"gate_top_k" integer,
	"gate_chunk_chars" integer,
	"min_retrieval_score" numeric(8, 6),
	"context_turns" integer,
	"escalation_sla_hours" integer,
	"rate_limit_employee_per_hour" integer,
	"rate_limit_external_per_hour" integer,
	"model_big" varchar(128),
	"model_small" varchar(128),
	"prompt_rewrite" text,
	"prompt_gate" text,
	"prompt_answer" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_settings_tenant_key" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ingest_status" "ingest_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ingest_error" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "chunk_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_settings" ADD CONSTRAINT "chat_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;