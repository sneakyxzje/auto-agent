import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { Logger, RequestMethod, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

// Giữ khớp với client_max_body_size của nginx.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: MAX_UPLOAD_BYTES }),
  );

  // Fastify không tự đọc cookie, phải đăng ký plugin thì `request.cookies` mới có.
  await app.register(fastifyCookie);

  // Dạng chuỗi `exclude: ['health']` không có tác dụng, phải khai đủ path + method.
  // Vế còn lại là VERSION_NEUTRAL trên controller, thiếu nó route vẫn dính /v1.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`API sẵn sàng — http://0.0.0.0:${env.API_PORT} (${env.NODE_ENV})`);
};

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('Khởi động thất bại', error);
  process.exit(1);
});
