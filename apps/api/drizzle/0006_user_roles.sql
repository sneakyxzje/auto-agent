-- Ba vai trò trong phạm vi một công ty, thay cho cờ boolean `is_tenant_admin`.
--
-- Viết tay thay vì để drizzle-kit sinh, vì bước chuyển dữ liệu mới là phần quan
-- trọng: drop cột trước khi chép giá trị sang là mất sạch danh sách admin, và
-- không có đường khôi phục ngoài việc sửa tay trong CSDL.

CREATE TYPE "user_role" AS ENUM ('user', 'manager', 'admin');--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'user';--> statement-breakpoint
UPDATE "users" SET "role" = 'admin' WHERE "is_tenant_admin" = true;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_tenant_admin";--> statement-breakpoint

ALTER TABLE "invitations" ADD COLUMN "grants_role" "user_role" NOT NULL DEFAULT 'user';--> statement-breakpoint
UPDATE "invitations" SET "grants_role" = 'admin' WHERE "grants_tenant_admin" = true;--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "grants_tenant_admin";
