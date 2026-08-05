import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { TokenService } from './token.service';

/**
 * Xuất `JwtGuard` và `TokenService` để các module nghiệp vụ sau này dùng lại —
 * mọi endpoint cần đăng nhập đều gắn cùng một guard này.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtGuard],
  exports: [TokenService, JwtGuard],
})
export class AuthModule {}
