'use client';

import { hasRole, type UserRole } from '@chatbot/contracts';
import type { ReactNode } from 'react';
import { useWorkspace } from './workspace-context';

const LABELS: Record<UserRole, string> = {
  user: 'thành viên',
  manager: 'quản lý',
  admin: 'quản trị viên',
};

/**
 * Ẩn mục khỏi thanh bên là chưa đủ — gõ thẳng URL vẫn vào được. Bọc thêm ở đây để
 * người không đủ quyền thấy lời giải thích thay vì một màn hình lỗi từ API.
 *
 * Đây chỉ là lớp cho người dùng đọc. Rào chắn thật nằm ở `RolesGuard` phía server;
 * mọi thứ ở trình duyệt đều sửa được.
 */
export const RequireRole = ({
  minRole,
  children,
}: {
  minRole: UserRole;
  children: ReactNode;
}) => {
  const { user } = useWorkspace();

  if (hasRole(user.role, minRole)) return <>{children}</>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 py-16 text-center">
      <p className="text-lg font-medium">Bạn không có quyền xem trang này</p>
      <p className="text-muted text-sm">
        Trang này dành cho {LABELS[minRole]} trở lên. Liên hệ quản trị viên công
        ty
        nếu bạn cần quyền truy cập.
      </p>
    </div>
  );
};
