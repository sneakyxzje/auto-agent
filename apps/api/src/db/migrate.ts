import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';

// Chạy migration rồi thoát. Container api gọi file này trước khi start.
const run = async (): Promise<void> => {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, max: 1 });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: `${__dirname}/../../drizzle`,
    });
    console.log('Migration hoàn tất.');
  } finally {
    await pool.end();
  }
};

run().catch((error: unknown) => {
  console.error('Migration thất bại:', error);
  process.exit(1);
});
