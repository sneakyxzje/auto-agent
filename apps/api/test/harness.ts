import 'reflect-metadata';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp, createAdapter } from '../src/bootstrap';
import { loadEnv } from '../src/config/env';

export type TestApp = {
  app: NestFastifyApplication;
  close: () => Promise<void>;
};

export const createTestApp = async (): Promise<TestApp> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createAdapter(),
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, close: () => app.close() };
};

export type Response = {
  status: number;
  body: Record<string, unknown>;
  cookies: Record<string, string>;
};

const readCookies = (raw: string[]): Record<string, string> =>
  Object.fromEntries(
    raw.map((line) => {
      const [pair] = line.split(';');
      const [name, ...value] = (pair ?? '').split('=');
      return [name ?? '', value.join('=')];
    }),
  );

export const request = async (
  app: NestFastifyApplication,
  options: {
    method: 'GET' | 'POST';
    path: string;
    payload?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  },
): Promise<Response> => {
  const result = await app.inject({
    method: options.method,
    url: `/api/v1${options.path}`,
    payload: options.payload as object | undefined,
    cookies: options.cookies,
    headers: options.headers,
  });

  const raw = result.headers['set-cookie'];
  const setCookie = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

  return {
    status: result.statusCode,
    body: result.body.length > 0 ? JSON.parse(result.body) : {},
    cookies: readCookies(setCookie),
  };
};

let counter = 0;

export const uniqueEmail = (): string => {
  counter += 1;
  return `test-${process.pid}-${counter}@vitest.local`;
};

const ownerPool = new pg.Pool({
  connectionString: loadEnv().DATABASE_MIGRATION_URL,
  max: 2,
});

export const seedDepartment = async (
  tenantId: string,
  name: string,
  slug: string,
): Promise<string> => {
  const { rows } = await ownerPool.query<{ id: string }>(
    'INSERT INTO departments (tenant_id, name, slug) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, name, slug],
  );

  const row = rows[0];
  if (row === undefined) throw new Error('Không tạo được phòng ban');
  return row.id;
};

export const closeSeeder = (): Promise<void> => ownerPool.end();
