'use client';

import type { Invitation, Member, UserRole } from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { PageView } from '@/features/workspace/page-view';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { ApiError } from '@/lib/api-client';
import { createInvitation, listMembers, setMemberRole } from './api';

const ROLE_OPTIONS = [
  { value: 'user', label: 'Thành viên — chỉ hỏi đáp' },
  { value: 'manager', label: 'Quản lý — tài liệu, phiếu chuyển, duyệt' },
  { value: 'admin', label: 'Quản trị viên — toàn quyền' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Thành viên',
  manager: 'Quản lý',
  admin: 'Quản trị viên',
};

const ROLE_TONES: Record<UserRole, string> = {
  user: 'bg-background text-muted',
  manager: 'bg-sky-50 text-sky-700',
  admin: 'bg-violet-50 text-violet-700',
};

const formatDate = (iso: string | null): string =>
  iso === null ? 'chưa đăng nhập' : new Date(iso).toLocaleDateString('vi-VN');

export const MembersView = () => {
  const { user } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('user');
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      setMembers(await listMembers());
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const changeRole = async (id: string, role: string): Promise<void> => {
    setSaving(id);
    setError(null);

    try {
      await setMemberRole(id, { role: role as UserRole });
      await reload();
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Không đổi được vai trò',
      );
    } finally {
      setSaving(null);
    }
  };

  const invite = async (): Promise<void> => {
    setError(null);

    try {
      setInvitation(
        await createInvitation({
          maxUses: 1,
          expiresInDays: 7,
          grantsRole: inviteRole as UserRole,
        }),
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Không tạo được mã mời',
      );
    }
  };

  return (
    <PageView
      title="Thành viên"
      subtitle="Vai trò quyết định ai được tải tài liệu, trả lời phiếu chuyển và duyệt tri thức vào kho."
      action={
        <Button
          onClick={() => {
            setInvitation(null);
            setInviteOpen(true);
          }}
        >
          Mời đồng nghiệp
        </Button>
      }
    >
      {error !== null && <Alert tone="danger">{error}</Alert>}

      {loading && members.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <ul className="border-border divide-separator bg-surface divide-y overflow-hidden rounded-2xl border">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{member.displayName}</p>

                  {member.id === user.id && (
                    <span className="border-border text-muted rounded-md border px-1.5 py-0.5 text-xs">
                      bạn
                    </span>
                  )}
                </div>

                <p className="text-muted mt-0.5 truncate text-sm">
                  {member.email} · đăng nhập gần nhất{' '}
                  {formatDate(member.lastLoginAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${ROLE_TONES[member.role]}`}
                >
                  {ROLE_LABELS[member.role]}
                </span>

                {member.id === user.id ? (
                  <span className="text-muted w-56 text-right text-xs">
                    Nhờ quản trị viên khác đổi giúp
                  </span>
                ) : (
                  <select
                    value={member.role}
                    disabled={saving === member.id}
                    onChange={(event) =>
                      changeRole(member.id, event.target.value)
                    }
                    className="border-border bg-surface h-10 w-56 cursor-pointer rounded-xl border px-3 text-sm disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted text-xs">
        Đổi vai trò sẽ đăng xuất người đó khỏi mọi thiết bị — vai trò nằm trong
        phiên đăng nhập, không huỷ phiên thì quyền cũ còn hiệu lực thêm 15 phút.
      </p>

      <Dialog
        title="Mời đồng nghiệp"
        subtitle="Mã dùng được một lần trong 7 ngày. Người nhận đăng ký tài khoản rồi nhập mã này là vào đúng công ty với vai trò bạn chọn."
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Vai trò khi vào công ty"
            name="inviteRole"
            value={inviteRole}
            options={ROLE_OPTIONS}
            onChange={setInviteRole}
          />

          {invitation !== null && (
            <div className="border-border bg-background rounded-xl border p-4 text-center">
              <p className="text-muted text-xs">Mã mời</p>
              <p className="mt-1 font-mono text-2xl tracking-widest">
                {invitation.code}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Đóng
            </Button>

            <Button onClick={invite}>
              {invitation === null ? 'Tạo mã mời' : 'Tạo mã khác'}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageView>
  );
};
