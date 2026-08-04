import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

// Thứ tự có ý nghĩa: loadEnvFile không ghi đè biến đã có, nên file nạp trước thắng.
const ENV_FILE_NAMES = ['.env.local', '.env'] as const;

const findWorkspaceRoot = (startDirectory: string): string | null => {
  let directory = startDirectory;

  while (true) {
    if (existsSync(join(directory, WORKSPACE_MARKER))) return directory;

    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};

/**
 * Nạp `.env.local` rồi `.env` ở gốc monorepo. Biến môi trường thật đè lên cả hai,
 * nên trong Docker hàm này là no-op (compose đã cấp biến, và hai file đó không
 * vào image). Tìm ngược lên thay vì dùng `--env-file` để không phụ thuộc cwd.
 */
export const loadDotEnvFile = (startDirectory: string = __dirname): void => {
  const root = findWorkspaceRoot(startDirectory);
  if (root === null) return;

  for (const name of ENV_FILE_NAMES) {
    const file = join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
};

// Chỉ hạ tầng ở đây. Ngưỡng nghiệp vụ (top_k, SLA, rate limit, prompt...) nằm
// trong bảng config runtime vì phải đổi được lúc chạy, không deploy lại.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),

  // Ba role khác nhau cho ba mức quyền, đừng dùng lẫn. Xem drizzle/0001_rls.sql.
  DATABASE_URL: z.string().min(1),
  DATABASE_AUTH_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải dài tối thiểu 32 ký tự'),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),

  LLM_BASE_URL: z.string().min(1),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL_BIG: z.string().default(''),
  LLM_MODEL_SMALL: z.string().default(''),
  LLM_MODEL_VISION: z.string().default(''),

  EMBEDDING_BASE_URL: z.string().min(1),
  EMBEDDING_API_KEY: z.string().default(''),
  EMBEDDING_MODEL: z.string().min(1),
  // Phải khớp hằng số cùng tên trong db/schema/chunk.ts.
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),

  WEBHOOK_SECRET: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

const formatIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');

let cached: Env | null = null;

export const loadEnv = (): Env => {
  if (cached !== null) return cached;

  loadDotEnvFile();

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Biến môi trường không hợp lệ:\n${formatIssues(parsed.error)}`);
  }

  cached = parsed.data;
  return cached;
};
