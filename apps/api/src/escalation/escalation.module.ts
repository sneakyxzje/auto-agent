import { Module } from '@nestjs/common';
import { ChatSettingsService } from '../chat/chat-settings.service';
import { AuthModule } from '../core/auth/auth.module';
import { PublishModule } from '../knowledge/publish/publish.module';
import { CurationService } from './curation.service';
import { EscalationController } from './escalation.controller';
import { EscalationService } from './escalation.service';

@Module({
  imports: [AuthModule, PublishModule],
  controllers: [EscalationController],
  providers: [EscalationService, CurationService, ChatSettingsService],
  exports: [EscalationService],
})
export class EscalationModule {}
