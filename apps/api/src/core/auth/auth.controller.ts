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
import { ZodBody } from '../http/zod-body.pipe';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, readCookie, setAuthCookies } from './cookies';
import { CurrentUser } from './current-user';
import { JwtGuard } from './jwt.guard';
import type { AccessTokenClaims } from './token.service';

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

  /**
   * Đọc lại từ CSDL chứ không lấy thẳng thông tin trong token: token là bản chụp
   * lúc đăng nhập, còn màn hình cần dữ liệu hiện tại. Vừa tạo công ty xong mà đọc
   * theo token thì vẫn thấy `tenant: null` suốt 15 phút.
   */
  @Get('me')
  @UseGuards(JwtGuard)
  async me(@CurrentUser() user: AccessTokenClaims): Promise<CurrentUserPayload> {
    return this.authService.getCurrentUser(user.userId);
  }

  /**
   * Không đặt guard: gọi endpoint này đúng lúc access token vừa hết hạn mới là
   * trường hợp thường gặp nhất. Bản thân refresh token đã là bằng chứng.
   *
   * Gia hạn thất bại thì xoá cookie luôn, để trình duyệt ngừng gửi một token đã
   * chết ở mọi request sau đó.
   */
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
      reply.code(HttpStatus.UNAUTHORIZED).send({ message: 'Phiên đăng nhập không còn hiệu lực' });
    }
  }

  /**
   * Không đặt guard: access token có thể đã hết hạn mà người dùng vẫn cần đăng
   * xuất. Endpoint này chỉ xoá đúng refresh token được gửi kèm nên không có gì
   * để lạm dụng.
   */
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
