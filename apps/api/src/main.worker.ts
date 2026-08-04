import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/**
 * Tiến trình chạy job nền: ingest tài liệu, trích xuất ảnh, lọc PII, gửi webhook,
 * quét SLA, dọn ảnh hết hạn. Dùng chung image và AppModule với `main.ts`.
 */

const KEEP_ALIVE_INTERVAL_MS = 60_000;

// Chưa có consumer BullMQ nên không handle nào giữ event loop, mà một Promise
// chưa resolve thì không tính. Thiếu timer này tiến trình thoát ngay khi pg pool
// đóng idle client (~10s) rồi bị restart liên tục.
// Bỏ đi khi có worker BullMQ đầu tiên — kết nối Redis của nó tự giữ event loop.
const waitForShutdownSignal = (): Promise<NodeJS.Signals> =>
  new Promise((resolve) => {
    const keepAlive = setInterval(() => {}, KEEP_ALIVE_INTERVAL_MS);

    const handle = (signal: NodeJS.Signals): void => {
      clearInterval(keepAlive);
      resolve(signal);
    };

    process.once('SIGTERM', handle);
    process.once('SIGINT', handle);
  });

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const logger = new Logger('Worker');

  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
  });
  logger.log(`Worker sẵn sàng (${env.NODE_ENV}) — chưa đăng ký job nào`);

  const signal = await waitForShutdownSignal();
  logger.log(`Nhận ${signal}, đang đóng kết nối...`);
  await app.close();
};

bootstrap().catch((error: unknown) => {
  new Logger('Worker').error('Khởi động thất bại', error);
  process.exit(1);
});
