import { Module } from '@nestjs/common';
import { PublishModule } from '../publish/publish.module';
import { IngestService } from './ingest.service';
import { IngestWorker } from './ingest.worker';

@Module({
  imports: [PublishModule],
  providers: [IngestService, IngestWorker],
  exports: [IngestService],
})
export class IngestModule {}
