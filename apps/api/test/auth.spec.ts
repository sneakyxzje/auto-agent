import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeSeeder,
  createTestApp,
  request,
  seedDepartment,
  type TestApp,
  uniqueEmail,
} from './harness';

const PASSWORD = 'matkhau-kiem-thu-123';

describe('auth', () => {
  let harness: TestApp;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    harness = await createTestApp();
    app = harness.app;
  });

  afterAll(async () => {
    await harness.close();
    await closeSeeder();
  });

  const register = async (email: string) =>
    request(app, {
      method: 'POST',
      path: '/auth/register',
      payload: { displayName: 'Kiem Thu', email, password: PASSWORD },
    });

  it('trả lời giống hệt nhau khi sai mật khẩu và khi email không tồn tại', async () => {
    const email = uniqueEmail();
    await register(email);

    const wrongPassword = await request(app, {
      method: 'POST',
      path: '/auth/login',
      payload: { email, password: 'mat-khau-sai-hoan-toan' },
    });

    const unknownEmail = await request(app, {
      method: 'POST',
      path: '/auth/login',
      payload: { email: uniqueEmail(), password: PASSWORD },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('huỷ mọi phiên khi refresh token đã xoay bị dùng lại', async () => {
    const email = uniqueEmail();
    const registered = await register(email);
    const firstToken = registered.cookies.rt;
    expect(firstToken).toBeDefined();

    const rotated = await request(app, {
      method: 'POST',
      path: '/auth/refresh',
      cookies: { rt: firstToken as string },
    });
    expect(rotated.status).toBe(200);

    const secondToken = rotated.cookies.rt as string;

    const reuse = await request(app, {
      method: 'POST',
      path: '/auth/refresh',
      cookies: { rt: firstToken as string },
    });
    expect(reuse.status).toBe(401);

    const victim = await request(app, {
      method: 'POST',
      path: '/auth/refresh',
      cookies: { rt: secondToken },
    });
    expect(victim.status).toBe(401);
  });

  it('trả 403 chứ không phải danh sách rỗng khi tài khoản chưa có công ty', async () => {
    const registered = await register(uniqueEmail());

    const response = await request(app, {
      method: 'GET',
      path: '/departments',
      cookies: { at: registered.cookies.at as string },
    });

    expect(response.status).toBe(403);
  });

  it('không cho công ty này thấy phòng ban của công ty khác', async () => {
    const buildCompany = async (companyName: string) => {
      const registered = await register(uniqueEmail());
      const created = await request(app, {
        method: 'POST',
        path: '/tenants',
        payload: { companyName },
        cookies: { at: registered.cookies.at as string },
      });

      const tenantId = (created.body as { tenant: { id: string } }).tenant.id;
      await seedDepartment(tenantId, `Nhan su ${companyName}`, 'hr');

      return created.cookies.at as string;
    };

    const tokenA = await buildCompany('Kiem Thu A');
    const tokenB = await buildCompany('Kiem Thu B');

    const seenByA = await request(app, {
      method: 'GET',
      path: '/departments',
      cookies: { at: tokenA },
    });
    const seenByB = await request(app, {
      method: 'GET',
      path: '/departments',
      cookies: { at: tokenB },
    });

    expect(seenByA.status).toBe(200);
    expect(seenByB.status).toBe(200);

    const idsA = (seenByA.body as unknown as { id: string }[]).map((d) => d.id);
    const idsB = (seenByB.body as unknown as { id: string }[]).map((d) => d.id);

    expect(idsA.filter((id) => idsB.includes(id))).toHaveLength(0);
  });
});
