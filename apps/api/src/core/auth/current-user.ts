import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AccessTokenClaims } from './token.service';

/**
 * Dùng Symbol làm khoá thay vì chuỗi để chắc chắn không đụng thuộc tính nào của
 * Fastify hay của plugin khác gắn lên cùng object request.
 */
const CURRENT_USER = Symbol('currentUser');

type RequestWithUser = FastifyRequest & { [CURRENT_USER]?: AccessTokenClaims };

export const attachCurrentUser = (request: FastifyRequest, claims: AccessTokenClaims): void => {
  (request as RequestWithUser)[CURRENT_USER] = claims;
};

export const readCurrentUser = (request: FastifyRequest): AccessTokenClaims | undefined =>
  (request as RequestWithUser)[CURRENT_USER];

/**
 * Lấy thông tin người đang gọi trong controller: `@CurrentUser() user: AccessTokenClaims`.
 *
 * Ném lỗi nếu chưa qua guard — đó là lỗi lập trình chứ không phải lỗi người dùng,
 * nên phải nổ to ngay lúc dev thay vì lặng lẽ trả `undefined` rồi hỏng ở đâu đó xa hơn.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenClaims => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = readCurrentUser(request);

    if (user === undefined) {
      throw new Error('Route dùng @CurrentUser() nhưng thiếu @UseGuards(JwtGuard)');
    }

    return user;
  },
);
