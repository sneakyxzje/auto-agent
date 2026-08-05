import { Global, Module } from '@nestjs/common';
import { ObjectStorage } from './object-storage.service';

@Global()
@Module({
  providers: [ObjectStorage],
  exports: [ObjectStorage],
})
export class StorageModule {}
