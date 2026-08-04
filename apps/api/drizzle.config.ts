import { defineConfig } from 'drizzle-kit';
import { loadDotEnvFile } from './src/config/env';

// `generate` không cần CSDL, nhưng `migrate` và `studio` thì có.
loadDotEnvFile(__dirname);

// Sửa schema xong nhớ chạy `pnpm db:generate` và commit file SQL sinh ra —
// container api chạy migration trước khi start nên thiếu là nó không lên được.
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migration cần quyền DDL nên dùng role chủ sở hữu, không phải role nghiệp vụ.
    url: process.env.DATABASE_MIGRATION_URL ?? '',
  },
  strict: true,
  verbose: true,
});
