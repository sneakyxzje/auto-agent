import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { readRequestContext } from '../core/context/request-context';
import { DATABASE, type Database, type Transaction } from './database.tokens';
import { withTenant } from './tenant-context';

@Injectable()
export class TenantDb {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  readonly run = async <T>(
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> => {
    const tenantId = readRequestContext()?.tenantId ?? null;

    if (tenantId === null) {
      throw new ForbiddenException('Tài khoản chưa thuộc công ty nào');
    }

    return withTenant(this.db, tenantId, work);
  };
}
