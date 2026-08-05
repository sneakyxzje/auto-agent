ALTER TABLE "documents" ADD COLUMN "file_name" varchar(512);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "file_mime_type" varchar(128);