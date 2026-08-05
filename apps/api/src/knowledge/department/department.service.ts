import type { CreateDepartment } from '@chatbot/contracts';
import { ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { departments } from '../../db/schema/department';
import { TenantDb } from '../../db/tenant-db.service';

export type DepartmentSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
};

const SUMMARY_COLUMNS = {
  id: departments.id,
  name: departments.name,
  slug: departments.slug,
  description: departments.description,
  isActive: departments.isActive,
};

@Injectable()
export class DepartmentService {
  constructor(private readonly tenantDb: TenantDb) {}

  readonly list = async (): Promise<DepartmentSummary[]> =>
    this.tenantDb.run((tx) =>
      tx.select(SUMMARY_COLUMNS).from(departments).orderBy(departments.name),
    );

  /**
   * Phòng ban tạo lúc chạy là dùng được ngay, không deploy lại: `slug` trở thành
   * lệnh `/slug` trong chat ngay khi bản ghi có mặt.
   *
   * Định dạng slug và từ khóa `all` đã bị chặn ở schema zod lẫn `check` của CSDL.
   * Chỗ này chỉ còn lo trùng slug trong cùng một công ty và trả về lỗi đọc được.
   */
  readonly create = async (
    input: CreateDepartment,
    createdBy: string,
  ): Promise<DepartmentSummary> =>
    this.tenantDb.run(async (tx, tenantId) => {
      const taken = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.tenantId, tenantId),
            eq(departments.slug, input.slug),
          ),
        )
        .limit(1);

      if (taken.length > 0) {
        throw new ConflictException({
          message: 'Phòng ban đã tồn tại',
          errors: [{ field: 'slug', message: 'Mã phòng ban này đã được dùng' }],
        });
      }

      const created = await tx
        .insert(departments)
        .values({
          tenantId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          createdBy,
        })
        .returning(SUMMARY_COLUMNS);

      const department = created[0];
      if (department === undefined) throw new Error('Không tạo được phòng ban');

      return department;
    });
}
