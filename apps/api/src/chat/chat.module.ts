import { Module } from '@nestjs/common';
import { AuthModule } from '../core/auth/auth.module';
import { EscalationModule } from '../escalation/escalation.module';
import { ImageModule } from '../image/image.module';
import { SearchModule } from '../knowledge/search/search.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSettingsService } from './chat-settings.service';
import { ConversationService } from './conversation.service';
import { GateService } from './gate.service';
import { RewriteService } from './rewrite.service';

@Module({
  imports: [AuthModule, SearchModule, EscalationModule, ImageModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatSettingsService,
    ConversationService,
    GateService,
    RewriteService,
  ],
})
export class ChatModule {}
