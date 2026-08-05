import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Chứng minh rằng dữ liệu giữa các khách hàng thật sự bị cô lập ở tầng CSDL.
 *
 * Đây không phải kiểm tra một lần cho vui: nó phải chạy trong CI mãi mãi. Một
 * policy bị xóa nhầm, một bảng mới quên bật RLS, một service dùng nhầm role —
 * tất cả đều lọt qua code review dễ dàng và chỉ bị bắt ở đây.
 *
 * Chạy: pnpm --filter @chatbot/api verify:isolation
 */

const findWorkspaceRoot = (start) => {
  let directory = start;
  while (true) {
    if (existsSync(join(directory, 'pnpm-workspace.yaml'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};

const root = findWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url)));
for (const name of ['.env.local', '.env']) {
  const file = join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}

const owner = new pg.Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 2,
});
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const results = [];
const check = (label, passed, detail = '') =>
  results.push({ label, passed, detail });

/** Mô phỏng đúng những gì withTenant() làm lúc chạy thật. */
const asTenant = async (tenantId, run) => {
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    if (tenantId !== null) {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
    }
    return await run(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
};

const seed = async () => {
  const { rows } = await owner.query(`
    WITH a AS (INSERT INTO tenants (name, slug) VALUES ('Kiem thu A', 'kiem-thu-a') RETURNING id),
         b AS (INSERT INTO tenants (name, slug) VALUES ('Kiem thu B', 'kiem-thu-b') RETURNING id)
    SELECT (SELECT id FROM a) AS a_id, (SELECT id FROM b) AS b_id
  `);
  const { a_id: tenantA, b_id: tenantB } = rows[0];

  await owner.query(
    "INSERT INTO departments (tenant_id, name, slug) VALUES ($1, 'Nhan su A', 'hr'), ($2, 'Nhan su B', 'hr')",
    [tenantA, tenantB],
  );
  return { tenantA, tenantB };
};

const cleanup = async (tenantA, tenantB) => {
  await owner.query('DELETE FROM departments WHERE tenant_id IN ($1, $2)', [
    tenantA,
    tenantB,
  ]);
  await owner.query('DELETE FROM tenants WHERE id IN ($1, $2)', [
    tenantA,
    tenantB,
  ]);
};

const run = async () => {
  const { tenantA, tenantB } = await seed();

  try {
    const seenByA = await asTenant(tenantA, (c) =>
      c.query('SELECT tenant_id, name FROM departments').then((r) => r.rows),
    );
    check(
      'Ngu canh A chi thay du lieu cua A',
      seenByA.length === 1 && seenByA[0].tenant_id === tenantA,
      `thay ${seenByA.length} dong`,
    );

    const withoutContext = await asTenant(null, (c) =>
      c.query('SELECT * FROM departments').then((r) => r.rows),
    );
    check(
      'Quen dat ngu canh thi tra ve RONG, khong phai thay het',
      withoutContext.length === 0,
      `thay ${withoutContext.length} dong`,
    );

    const stolen = await asTenant(tenantA, (c) =>
      c
        .query('SELECT * FROM departments WHERE tenant_id = $1', [tenantB])
        .then((r) => r.rows),
    );
    check('Co tinh DOC du lieu khach khac: bi chan', stolen.length === 0);

    const writeBlocked = await asTenant(tenantA, async (c) => {
      try {
        await c.query(
          "INSERT INTO departments (tenant_id, name, slug) VALUES ($1, 'Gia mao', 'gia-mao')",
          [tenantB],
        );
        return false;
      } catch {
        return true;
      }
    });
    check('Co tinh GHI sang khach khac: bi chan', writeBlocked);

    const authPool = new pg.Pool({
      connectionString: process.env.DATABASE_AUTH_URL,
      max: 1,
    });
    let authReadsUsers = true;
    let authBlockedElsewhere = false;
    try {
      await authPool.query('SELECT count(*) FROM users');
    } catch {
      authReadsUsers = false;
    }
    try {
      await authPool.query('SELECT count(*) FROM departments');
    } catch {
      authBlockedElsewhere = true;
    }
    await authPool.end();

    check('Role auth doc duoc users, phuc vu dang nhap', authReadsUsers);
    check('Role auth khong cham duoc bang nghiep vu', authBlockedElsewhere);
  } finally {
    await cleanup(tenantA, tenantB);
  }
};

await run();
await owner.end();
await app.end();

for (const { label, passed, detail } of results) {
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`,
  );
}

const failed = results.filter((r) => !r.passed).length;
console.log(
  failed === 0
    ? `\n${results.length}/${results.length} dat.`
    : `\n${failed} muc THAT BAI.`,
);
process.exit(failed === 0 ? 0 : 1);
