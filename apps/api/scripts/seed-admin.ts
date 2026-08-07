import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loadEnv } from '../src/config/env';
import { hashPassword } from '../src/core/auth/password';
import { toSlug } from '../src/core/auth/slug';
import * as schema from '../src/db/schema';
import { tenants } from '../src/db/schema/tenant';
import { users } from '../src/db/schema/user';

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      name: { type: 'string' },
      company: { type: 'string' },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const password = values.password;

  if (email === undefined || password === undefined) {
    throw new Error(
      'Thieu tham so. Vi du: pnpm --filter @chatbot/api seed:admin --email admin@congty.vn --password matkhau --name "Quan tri" --company "Ten cong ty"',
    );
  }

  const displayName = values.name ?? email.split('@')[0] ?? 'Quản trị viên';
  const companyName = values.company ?? 'Auto Agent';

  const env = loadEnv();
  const pool = new Pool({
    connectionString: env.DATABASE_MIGRATION_URL,
    max: 1,
  });
  const db = drizzle(pool, { schema });

  try {
    const ready = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass('public.users') IS NOT NULL AS ok`,
    );

    if (ready.rows[0]?.ok !== true) {
      throw new Error(
        'Chua co bang trong CSDL. Chay `pnpm --filter @chatbot/api db:migrate` truoc.',
      );
    }

    const slug = toSlug(companyName) || 'cong-ty';
    const existingTenant = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    const tenant =
      existingTenant[0] ??
      (
        await db
          .insert(tenants)
          .values({ name: companyName, slug })
          .returning({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      )[0];

    if (tenant === undefined) throw new Error('Khong tao duoc cong ty');

    const passwordHash = await hashPassword(password);
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser[0] === undefined) {
      await db.insert(users).values({
        tenantId: tenant.id,
        email,
        passwordHash,
        displayName,
        isExternal: false,
        role: 'admin',
        status: 'active',
      });

      console.log(`Da tao tai khoan admin: ${email}`);
    } else {
      await db
        .update(users)
        .set({
          tenantId: tenant.id,
          passwordHash,
          displayName,
          isExternal: false,
          role: 'admin',
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.email, email));

      console.log(
        `Tai khoan da ton tai, da dat lai mat khau va quyen: ${email}`,
      );
    }

    console.log(`Cong ty: ${tenant.name} (slug: ${tenant.slug})`);
    console.log(
      'Dang nhap tai /login roi tao phong ban truoc khi tai tai lieu.',
    );
  } finally {
    await pool.end();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
