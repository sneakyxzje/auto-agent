import {
  type CreateInvitationInput,
  type CreateTenantInput,
  createInvitationSchema,
  createTenantSchema,
  type Invitation,
  type JoinTenantInput,
  joinTenantSchema,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
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
import { type AccessTokenClaims, TokenService } from '../auth/token.service';
import { ZodBody } from '../http/zod-body.pipe';
import { InvitationService } from './invitation.service';
import { type OnboardingResult, TenantService } from './tenant.service';

@Controller()
@UseGuards(JwtGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly invitationService: InvitationService,
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
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @Body(new ZodBody(createInvitationSchema)) input: CreateInvitationInput,
  ): Promise<Invitation> {
    return this.invitationService.create(input);
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
