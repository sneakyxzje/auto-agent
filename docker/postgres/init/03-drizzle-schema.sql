-- Chạy bằng POSTGRES_USER (chủ sở hữu CSDL) nên schema thuộc về role đó. Không
-- ghi AUTHORIZATION cứng: role `postgres` không tồn tại khi POSTGRES_USER mang
-- tên khác, và cả khối init sẽ đổ theo.
CREATE SCHEMA IF NOT EXISTS drizzle;
GRANT CREATE ON SCHEMA drizzle TO chatbot_app;
