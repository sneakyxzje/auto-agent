#!/bin/bash
# Chỉ chạy một lần, khi volume postgres còn rỗng.
#
# POSTGRES_USER do image tạo ra là superuser và có BYPASSRLS — nghĩa là nếu ứng
# dụng dùng chính role đó thì Row-Level Security có bật cũng vô tác dụng. Nên phải
# tách ra hai role riêng, cả hai đều NOSUPERUSER NOBYPASSRLS:
#
#   chatbot_app   chạy toàn bộ nghiệp vụ, mọi truy vấn bị RLS chặn theo tenant
#   chatbot_auth  chỉ dùng cho đăng ký / đăng nhập, vì lúc đó chưa biết tenant nào
#
# Còn POSTGRES_USER giữ lại đúng một việc: chạy migration.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE chatbot_app  LOGIN PASSWORD '${APP_DB_PASSWORD}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  CREATE ROLE chatbot_auth LOGIN PASSWORD '${AUTH_DB_PASSWORD}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO chatbot_app, chatbot_auth;
  GRANT CREATE ON DATABASE "${POSTGRES_DB}" TO chatbot_app, "${POSTGRES_USER}";
  GRANT USAGE ON SCHEMA public TO chatbot_app, chatbot_auth;

  -- Bảng còn chưa tồn tại lúc này, nên cấp quyền cho mọi bảng sẽ được tạo về sau.
  -- chatbot_auth cố ý không có ở đây: nó chỉ được cấp quyền trên đúng hai bảng
  -- users và tenants, khai trong migration.
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatbot_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO chatbot_app;
EOSQL
