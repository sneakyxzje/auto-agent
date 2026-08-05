import { sql } from 'drizzle-orm';
import type { Database, Transaction } from './database.tokens';

/**
 * Chạy một khối truy vấn trong ngữ cảnh của đúng một khách hàng.
 *
 * Bắt buộc phải là transaction: `set_config(..., true)` chỉ sống trong transaction
 * đó, nên hai request chạy song song trên cùng pool không giẫm lên nhau. Ngoài
 * transaction thì giá trị sẽ dính lại trên connection và rò sang request sau —
 * đúng kiểu lỗi khó tái hiện nhất.
 *
 * Dùng `set_config()` chứ không phải `SET LOCAL` vì `SET LOCAL` không nhận tham số
 * truy vấn, phải nối chuỗi vào SQL.
 *
 * Không có ngữ cảnh thì mọi policy đều không khớp và truy vấn trả về rỗng, chứ
 * không phải trả về của khách khác.
 */
export const withTenant = async <T>(
  db: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );
    return work(tx);
  });
