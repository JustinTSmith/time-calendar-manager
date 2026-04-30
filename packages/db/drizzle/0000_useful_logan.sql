CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "calendar_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"sync_cursor" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"calendar_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider_calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"color" varchar(20),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"title" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"recurrence_rule" text,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reminders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_time_block" boolean DEFAULT false NOT NULL,
	"task_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" varchar(20),
	"is_inbox" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"list_id" uuid,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"title" text NOT NULL,
	"due_date" timestamp with time zone,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"status" varchar(50) DEFAULT 'inbox' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"scheduled_event_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sets" ADD CONSTRAINT "calendar_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_account_id_calendar_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_lists" ADD CONSTRAINT "task_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_task_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."task_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_scheduled_event_id_events_id_fk" FOREIGN KEY ("scheduled_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_accounts_user_id_idx" ON "calendar_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_sets_user_id_idx" ON "calendar_sets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendars_account_id_idx" ON "calendars" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_account_provider_calendar_idx" ON "calendars" USING btree ("account_id","provider_calendar_id");--> statement-breakpoint
CREATE INDEX "events_calendar_id_idx" ON "events" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "events_user_id_start_at_end_at_idx" ON "events" USING btree ("user_id","start_at","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_calendar_provider_event_idx" ON "events" USING btree ("calendar_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "task_lists_user_id_idx" ON "task_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_id_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_id_due_date_idx" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_list_id_idx" ON "tasks" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_scheduled_event_id_idx" ON "tasks" USING btree ("scheduled_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");
