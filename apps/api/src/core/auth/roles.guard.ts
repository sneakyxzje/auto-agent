import { hasRole, type UserRole } from '@chatbot/contracts';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readRequestContext } from '../context/request-context';

const ROLES_KEY = 'requiredRole';

/** Gắn lên route: `@RequireRole('manager')`. Vai trò cao hơn luôn đi qua được. */
export const RequireRole = (role: UserRole) => SetMetadata(ROLES_KEY, role);

const MESSAGES: Record<UserRole, string> = {
  user: 'Bạn không có quyền làm việc này',
  manager: 'Chỉ quản lý hoặc quản trị viên được làm việc này',
  admin: 'Chỉ quản trị viên công ty được làm việc này',
};

/**
 * Đặt SAU `JwtGuard` — guard này chỉ đọc lại ngữ cảnh mà JwtGuard đã điền, không
 * tự xác thực.
 *
 * Vai trò lấy từ token chứ không tra lại CSDL: đó là bản chụp lúc phát token, nên
 * hạ quyền một người chỉ có hiệu lực đầy đủ sau khi access token của họ hết hạn
 * (15 phút). Đổi lại là không thêm một truy vấn cho mọi request. Cần chặn ngay lập
 * tức thì huỷ hết phiên của người đó.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate = (context: ExecutionContext): boolean => {
    const required = this.reflector.getAllAndOverride<UserRole | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined) return true;

    const actual = readRequestContext()?.role ?? 'user';
    if (!hasRole(actual, required)) {
      throw new ForbiddenException(MESSAGES[required]);
    }

    return true;
  };
}
