import { Module } from '@nestjs/common';
import { AuthModule } from '../core/auth/auth.module';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { ImageCleanupWorker } from './image-cleanup.worker';

@Module({
  imports: [AuthModule],
  controllers: [ImageController],
  providers: [ImageService, ImageCleanupWorker],
  exports: [ImageService],
})
export class ImageModule {}
