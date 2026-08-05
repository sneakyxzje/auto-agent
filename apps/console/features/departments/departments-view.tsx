'use client';

import { hasRole } from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PageView } from '@/features/workspace/page-view';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { DepartmentForm } from './department-form';
import { useDepartments } from './use-departments';

export const DepartmentsView = () => {
  const { user } = useWorkspace();
  const { departments, loading, reload } = useDepartments();
  const [formOpen, setFormOpen] = useState(false);

  const canManage = hasRole(user.role, 'admin');

  const finishCreate = async (): Promise<void> => {
    await reload();
    setFormOpen(false);
  };

  return (
    <PageView
      title="Phòng ban"
      subtitle="Mỗi phòng ban có kho tài liệu riêng và một lệnh /mã để hỏi đúng phòng đó."
      action={
        canManage ? (
          <Button onClick={() => setFormOpen(true)}>Tạo phòng ban</Button>
        ) : null
      }
    >
      <Dialog
        title="Tạo phòng ban"
        subtitle="Tên hiện trong hệ thống, mã dùng làm lệnh /mã khi hỏi riêng phòng này."
        open={formOpen}
        onClose={() => setFormOpen(false)}
      >
        <DepartmentForm
          onDone={finishCreate}
          onCancel={() => setFormOpen(false)}
        />
      </Dialog>

      {!canManage && (
        <p className="text-muted border-border bg-background/60 rounded-xl border p-4 text-sm">
          Chỉ quản trị viên công ty tạo được phòng ban mới.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : departments.length === 0 ? (
        <p className="text-muted border-border rounded-xl border border-dashed p-8 text-center text-sm">
          Chưa có phòng ban nào. Tạo phòng đầu tiên rồi tải tài liệu lên cho nó.
        </p>
      ) : (
        <ul className="border-border divide-separator bg-surface divide-y overflow-hidden rounded-2xl border">
          {departments.map((department) => (
            <li
              key={department.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{department.name}</p>
                  <span className="border-border text-muted rounded-md border px-1.5 py-0.5 text-xs">
                    /{department.slug}
                  </span>
                </div>

                {department.description !== null && (
                  <p className="text-muted mt-1 truncate text-sm">
                    {department.description}
                  </p>
                )}
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                  department.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-background text-muted'
                }`}
              >
                {department.isActive ? 'Đang hoạt động' : 'Đã tắt'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageView>
  );
};
