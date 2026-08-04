import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from '@chatbot/contracts';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { ZodBody } from '../http/zod-body.pipe';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, readCookie, setAuthCookies } from './cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Token đi vào cookie httpOnly chứ không nằm trong phần thân phản hồi. Trả token
   * ra body thì JavaScript đọc được, và chỉ cần một lỗ XSS là mất sạch.
   *
   * Dùng `@Res()` nên phải tự gọi `reply.send()`, NestJS không tự gửi nữa.
   */
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
    const tokens = await this.authService.login(input);
    setAuthCookies(reply, this.isProduction, tokens);
    reply.send({ ok: true });
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
