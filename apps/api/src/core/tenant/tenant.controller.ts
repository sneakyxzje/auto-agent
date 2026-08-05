import {
  type CreateInvitationInput,
  type CreateTenantInput,
  createInvitationSchema,
  createTenantSchema,
  type Invitation,
  type JoinTenantInput,
  joinTenantSchema,
  type Member,
  type UpdateMemberRoleInput,
  updateMemberRoleSchema,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { setAccessTokenCookie } from '../auth/cookies';
import { CurrentUser } from '../auth/current-user';
import { JwtGuard } from '../auth/jwt.guard';
import { RequireRole, RolesGuard } from '../auth/roles.guard';
import { type AccessTokenClaims, TokenService } from '../auth/token.service';
import { ZodBody } from '../http/zod-body.pipe';
import { InvitationService } from './invitation.service';
import { MemberService } from './member.service';
import { type OnboardingResult, TenantService } from './tenant.service';

@Controller()
@UseGuards(JwtGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly invitationService: InvitationService,
    private readonly memberService: MemberService,
    private readonly tokenService: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(createTenantSchema)) input: CreateTenantInput,
    @CurrentUser() user: AccessTokenClaims,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.tenantService.createForUser(user.userId, input);
    await this.replyWithFreshToken(reply, result);
  }

  @Post('tenants/join')
  @HttpCode(HttpStatus.OK)
  async join(
    @Body(new ZodBody(joinTenantSchema)) input: JoinTenantInput,
    @CurrentUser() user: AccessTokenClaims,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.tenantService.joinWithInvite(user.userId, input);
    await this.replyWithFreshToken(reply, result);
  }

  @Post('invitations')
  @RequireRole('admin')
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @Body(new ZodBody(createInvitationSchema)) input: CreateInvitationInput,
  ): Promise<Invitation> {
    return this.invitationService.create(input);
  }

  @Get('members')
  @RequireRole('admin')
  async listMembers(): Promise<Member[]> {
    return this.memberService.list();
  }

  @Patch('members/:id/role')
  @RequireRole('admin')
  async setMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateMemberRoleSchema)) input: UpdateMemberRoleInput,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<Member> {
    return this.memberService.setRole(id, input.role, user.userId);
  }

  private readonly replyWithFreshToken = async (
    reply: FastifyReply,
    result: OnboardingResult,
  ): Promise<void> => {
    const accessToken = await this.tokenService.issueAccessToken(result.claims);
    setAccessTokenCookie(
      reply,
      this.env.NODE_ENV === 'production',
      accessToken,
    );
    reply.send({ tenant: result.tenant });
  };
}
