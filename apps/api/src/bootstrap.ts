import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { RequestMethod, VersioningType } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const createAdapter = (): FastifyAdapter =>
  new FastifyAdapter({
    bodyLimit: MAX_UPLOAD_BYTES,
    trustProxy: true,
  });

export const configureApp = async (
  app: NestFastifyApplication,
): Promise<void> => {
  await app.register(fastifyCookie);

  // Một file mỗi lần: tài liệu nào cũng cần tiêu đề và phòng ban riêng, gửi chùm
  // thì không gắn được metadata cho từng file.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
};
