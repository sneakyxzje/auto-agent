import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { readRequestContext } from '../core/context/request-context';
import { DATABASE, type Database, type Transaction } from './database.tokens';
import { withTenant } from './tenant-context';

@Injectable()
export class TenantDb {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  readonly run = async <T>(
    work: (tx: Transaction, tenantId: string) => Promise<T>,
  ): Promise<T> => {
    const tenantId = readRequestContext()?.tenantId ?? null;

    if (tenantId === null) {
      throw new ForbiddenException('Tài khoản chưa thuộc công ty nào');
    }

    return withTenant(this.db, tenantId, (tx) => work(tx, tenantId));
  };

  /**
   * Dành cho job nền: worker chạy ngoài vòng đời request nên không có ngữ cảnh để
   * đọc, phải nhận `tenantId` từ payload của job. Đừng dùng trong controller —
   * ở đó lấy tenant từ token mới đúng, truyền tay là mở đường cho lỗi phân quyền.
   */
  readonly runAs = async <T>(
    tenantId: string,
    work: (tx: Transaction, tenantId: string) => Promise<T>,
  ): Promise<T> => withTenant(this.db, tenantId, (tx) => work(tx, tenantId));
}
