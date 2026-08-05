import type { CurrentUser as CurrentUserPayload } from '@chatbot/contracts';
import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  Get,
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
import { RateLimiter } from '../../redis/rate-limiter.service';
import { ZodBody } from '../http/zod-body.pipe';
import { AuthService } from './auth.service';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  readCookie,
  setAuthCookies,
} from './cookies';
import { CurrentUser } from './current-user';
import { JwtGuard } from './jwt.guard';
import type { AccessTokenClaims } from './token.service';

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_ATTEMPTS_PER_EMAIL = 8;
const LOGIN_ATTEMPTS_PER_IP = 40;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodBody(registerSchema)) input: RegisterInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const tokens = await this.authService.register(input);
    setAuthCookies(reply, this.isProduction, tokens);
    reply.code(HttpStatus.CREATED).send({ ok: true });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodBody(loginSchema)) input: LoginInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const email = input.email.toLowerCase();

    await this.rateLimiter.consume({
      key: `login:ip:${reply.request.ip}`,
      limit: LOGIN_ATTEMPTS_PER_IP,
      windowSeconds: LOGIN_WINDOW_SECONDS,
    });
    await this.rateLimiter.consume({
      key: `login:email:${email}`,
      limit: LOGIN_ATTEMPTS_PER_EMAIL,
      windowSeconds: LOGIN_WINDOW_SECONDS,
    });

    const tokens = await this.authService.login(input);
    await this.rateLimiter.reset(`login:email:${email}`);

    setAuthCookies(reply, this.isProduction, tokens);
    reply.send({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CurrentUserPayload> {
    return this.authService.getCurrentUser(user.userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Res() reply: FastifyReply): Promise<void> {
    const refreshToken = readCookie(reply.request, REFRESH_TOKEN_COOKIE);

    if (refreshToken === undefined) {
      clearAuthCookies(reply);
      reply.code(HttpStatus.UNAUTHORIZED).send({ message: 'Chưa đăng nhập' });
      return;
    }

    try {
      const tokens = await this.authService.refresh(refreshToken);
      setAuthCookies(reply, this.isProduction, tokens);
      reply.send({ ok: true });
    } catch {
      clearAuthCookies(reply);
      reply
        .code(HttpStatus.UNAUTHORIZED)
        .send({ message: 'Phiên đăng nhập không còn hiệu lực' });
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res() reply: FastifyReply): Promise<void> {
    const refreshToken = readCookie(reply.request, REFRESH_TOKEN_COOKIE);
    if (refreshToken !== undefined) await this.authService.logout(refreshToken);

    clearAuthCookies(reply);
    reply.send({ ok: true });
  }

  private get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
