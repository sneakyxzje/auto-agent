-- Cô lập dữ liệu giữa các khách hàng ở tầng CSDL.
--
-- Từ sau migration này, dù code có quên `WHERE tenant_id` thì Postgres vẫn không
-- trả về dữ liệu của khách khác. Mỗi transaction khai báo mình đang phục vụ ai
-- bằng `set_config('app.tenant_id', ..., true)`, các policy dưới đây đọc giá trị đó.
--
-- Chưa khai thì phép so sánh ra NULL và không dòng nào lọt qua. Quên khai là thấy
-- rỗng chứ không phải thấy hết — hỏng theo hướng an toàn, đây mới là điểm mấu chốt.
--
-- NULLIF là bắt buộc, không phải cho đẹp: hết transaction, `set_config(..., true)`
-- trả biến về CHUỖI RỖNG chứ không phải NULL. Thiếu NULLIF thì lần sau connection
-- đó được dùng lại, `''::uuid` ném lỗi ngay giữa production.
--
-- FORCE để chính chủ sở hữu bảng cũng bị chặn. Riêng superuser thì Postgres luôn
-- cho qua, nên ứng dụng bắt buộc chạy bằng role thường (xem docker/postgres/init).

GRANT SELECT, INSERT, UPDATE ON "users" TO chatbot_auth;--> statement-breakpoint
GRANT SELECT, INSERT ON "tenants" TO chatbot_auth;--> statement-breakpoint

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenants_app_isolation" ON "tenants" TO chatbot_app
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenants_auth_access" ON "tenants" TO chatbot_auth
  USING (true) WITH CHECK (true);--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_app_isolation" ON "users" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "users_auth_access" ON "users" TO chatbot_auth
  USING (true) WITH CHECK (true);--> statement-breakpoint

ALTER TABLE "department_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "department_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "department_memberships_app_isolation" ON "department_memberships" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "departments_app_isolation" ON "departments" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "documents_app_isolation" ON "documents" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chunks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chunks_app_isolation" ON "chunks" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "conversations_app_isolation" ON "conversations" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "messages_app_isolation" ON "messages" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "message_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_ratings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "message_ratings_app_isolation" ON "message_ratings" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "message_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_attachments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "message_attachments_app_isolation" ON "message_attachments" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "image_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "image_assets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "image_assets_app_isolation" ON "image_assets" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "escalation_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escalation_tickets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "escalation_tickets_app_isolation" ON "escalation_tickets" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "knowledge_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_candidates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "knowledge_candidates_app_isolation" ON "knowledge_candidates" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
