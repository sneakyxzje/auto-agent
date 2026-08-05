import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp, createAdapter } from './bootstrap';
import { loadEnv } from './config/env';

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createAdapter(),
  );

  await configureApp(app);
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`API sẵn sàng — http://0.0.0.0:${env.API_PORT} (${env.NODE_ENV})`);
};

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('Khởi động thất bại', error);
  process.exit(1);
});
