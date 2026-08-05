import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationService } from './invitation.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService, InvitationService],
})
export class TenantModule {}
