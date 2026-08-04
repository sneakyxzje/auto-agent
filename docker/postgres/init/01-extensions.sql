-- Chỉ chạy một lần, khi volume postgres còn rỗng.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() không IMMUTABLE nên không dùng thẳng trong index hay generated column
-- được. Chỉ cần wrapper này nếu bạn để Postgres tự sinh chunks.content_norm; mặc
-- định giá trị đó tính ở tầng ứng dụng lúc ingest.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  AS $$ SELECT unaccent('unaccent', $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
