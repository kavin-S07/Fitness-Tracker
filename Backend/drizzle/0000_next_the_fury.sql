CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password" text NOT NULL,
	"age" integer,
	"gender" varchar(10),
	"weight" double precision,
	"height" double precision,
	"goal" varchar(20),
	"gym_status" boolean DEFAULT false,
	"activity_level" integer DEFAULT 5,
	"bmr" double precision,
	"daily_calories" double precision,
	"daily_protein" double precision,
	"maintenance_calories" double precision,
	"target_weight" double precision,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"food_name" varchar(200) NOT NULL,
	"calories" double precision NOT NULL,
	"protein" double precision NOT NULL,
	"carbs" double precision DEFAULT 0,
	"fats" double precision DEFAULT 0,
	"quantity" double precision DEFAULT 1,
	"unit" varchar(20) DEFAULT 'g',
	"meal_type" varchar(20),
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"exercise_name" varchar(150) NOT NULL,
	"image_url" text,
	"target_muscle" varchar(200),
	"equipment" varchar(200),
	"difficulty" varchar(20),
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"exercise_id" uuid,
	"sets" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight" double precision NOT NULL,
	"workout_date" date DEFAULT CURRENT_DATE NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weight_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"weight" double precision NOT NULL,
	"log_date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "weight_logs_user_id_log_date_unique" UNIQUE("user_id","log_date")
);
--> statement-breakpoint
CREATE TABLE "daily_calorie_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"target_calories" integer DEFAULT 0 NOT NULL,
	"consumed_calories" numeric(8, 2) DEFAULT '0' NOT NULL,
	"remaining_calories" numeric(8, 2) DEFAULT '0' NOT NULL,
	"actual_deficit" numeric(8, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "daily_calorie_tracking_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "weight_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"old_weight" numeric(5, 2) NOT NULL,
	"new_weight" numeric(5, 2) NOT NULL,
	"weekly_calories" integer DEFAULT 0 NOT NULL,
	"weight_change" numeric(5, 2) DEFAULT '0' NOT NULL,
	"goal" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_calorie_tracking" ADD CONSTRAINT "daily_calorie_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_foods_user_date" ON "foods" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_exercise_type" ON "exercise" USING btree ("exercise_type");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_user_date" ON "workout_logs" USING btree ("user_id","workout_date");--> statement-breakpoint
CREATE INDEX "idx_weight_logs_user_date" ON "weight_logs" USING btree ("user_id","log_date");