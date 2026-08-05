import { Injectable } from '@nestjs/common';
import { departments } from '../../db/schema/department';
import { TenantDb } from '../../db/tenant-db.service';

export type DepartmentSummary = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

@Injectable()
export class DepartmentService {
  constructor(private readonly tenantDb: TenantDb) {}

  readonly list = async (): Promise<DepartmentSummary[]> =>
    this.tenantDb.run((tx) =>
      tx
        .select({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          isActive: departments.isActive,
        })
        .from(departments)
        .orderBy(departments.name),
    );
}
