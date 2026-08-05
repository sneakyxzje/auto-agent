import fastifyCookie from '@fastify/cookie';
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

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
};
