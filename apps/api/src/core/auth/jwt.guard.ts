import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ACCESS_TOKEN_COOKIE, readCookie } from './cookies';
import { attachCurrentUser } from './current-user';
import { TokenService } from './token.service';

const BEARER_PREFIX = 'Bearer ';

/**
 * Đọc token từ cookie trước, sau đó mới tới header `Authorization`.
 *
 * Console chạy cùng domain nên dùng cookie, an toàn hơn vì JavaScript không đọc
 * được. Nhưng widget sau này nhúng vào web của khách hàng ở domain khác, trình
 * duyệt sẽ chặn cookie bên thứ ba — lúc đó nó phải gửi qua header. Nhận cả hai
 * ngay từ đầu để khỏi phải sửa guard về sau.
 */
const extractToken = (request: FastifyRequest): string | null => {
  const fromCookie = readCookie(request, ACCESS_TOKEN_COOKIE);
  if (fromCookie !== undefined && fromCookie.length > 0) return fromCookie;

  const header = request.headers.authorization;
  if (header?.startsWith(BEARER_PREFIX)) {
    return header.slice(BEARER_PREFIX.length);
  }

  return null;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = extractToken(request);

    if (token === null) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }

    const claims = await this.tokenService.verifyAccessToken(token);

    /**
     * Token sai chữ ký và token hết hạn đều trả về cùng một thông báo. Phía client
     * chỉ cần biết "phiên không dùng được nữa, đi làm mới đi" — phân biệt kỹ hơn
     * chỉ giúp ích cho người đang dò.
     */
    if (claims === null) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }

    attachCurrentUser(request, claims);
    return true;
  };
}
