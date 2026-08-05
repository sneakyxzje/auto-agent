-- Bảng mới thì mặc định KHÔNG có policy nào, và không policy nghĩa là role nghiệp
-- vụ đọc được hết mọi khách hàng. Mọi bảng mang tenant_id đều phải khai ở đây,
-- cùng khuôn với 0001_rls.sql.

ALTER TABLE "chat_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_settings_app_isolation" ON "chat_settings" TO chatbot_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
