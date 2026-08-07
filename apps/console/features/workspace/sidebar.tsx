'use client';

import type { CurrentUser } from '@chatbot/contracts';
import { Avatar, Popover } from '@heroui/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ComponentType, useState } from 'react';
import { logout } from '@/features/auth/api';
import { deleteConversation as deleteConversationRequest } from '@/features/chat/api';
import { useHistory } from '@/features/chat/history-context';
import { clearDepartmentsCache } from '@/features/departments/use-departments';
import {
  ChevronUpDownIcon,
  HelpIcon,
  type IconProps,
  Kebab,
  LogoIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
} from './icons';
import { type NavItem, navSectionsFor } from './nav';

type SidebarProps = {
  user: CurrentUser;
  onCollapse: () => void;
  /** Mobile drawer: bấm link nào cũng phải đóng drawer để lộ nội dung. */
  onNavigate?: () => void;
};

const ITEM_CLASS =
  'flex w-full  items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors';
const IDLE_CLASS = 'text-muted hover:bg-surface hover:text-foreground';
const ACTIVE_CLASS =
  'bg-surface text-foreground border-border border shadow-xs';

const initialsOf = (displayName: string): string =>
  displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const NavRow = ({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) => {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </>
  );

  if (!item.ready)
    return (
      <span
        title="Sắp có"
        aria-disabled="true"
        className={`${ITEM_CLASS} text-muted cursor-default opacity-90`}
      >
        {content}
      </span>
    );

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`${ITEM_CLASS} ${active ? ACTIVE_CLASS : IDLE_CLASS}`}
    >
      {content}
    </Link>
  );
};

/**
 * Lịch sử hội thoại kiểu Claude/Gemini: bấm vào là mở lại đúng cuộc đó và hỏi tiếp
 * được. Tiêu đề là câu hỏi đầu tiên nên không có bước đặt tên nào cho người dùng.
 */
const ConversationHistory = ({
  activeId,
  onNavigate,
}: {
  activeId: string | null;
  onNavigate?: () => void;
}) => {
  const { conversations, loading, reload } = useHistory();
  const router = useRouter();

  const deleteConversation = async (conversationId: string): Promise<void> => {
    await deleteConversationRequest(conversationId);
    await reload();

    if (activeId === conversationId) {
      router.replace('/workspace');
    }
  };

  if (loading || conversations.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted px-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
        Conversations
      </p>

      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className="relative flex items-stretch gap-1"
        >
          <Link
            href={`/workspace?c=${conversation.id}`}
            title={conversation.title}
            onClick={onNavigate}
            className={`${ITEM_CLASS} min-w-0 flex-1 ${
              conversation.id === activeId ? ACTIVE_CLASS : IDLE_CLASS
            }`}
          >
            <span className="truncate">{conversation.title}</span>
          </Link>
          <Popover>
            <Popover.Trigger
              aria-label={`Mở menu cho ${conversation.title}`}
              className="text-muted hover:bg-surface-hover hover:text-foreground flex size-10 shrink-0 items-center justify-center rounded-md"
            >
              <Kebab className="size-4" />
            </Popover.Trigger>
            <Popover.Content placement="bottom end" className="min-w-36 p-0">
              <Popover.Dialog>
                <button
                  type="button"
                  onClick={() => void deleteConversation(conversation.id)}
                  className="text-danger hover:bg-surface-secondary w-full rounded-md cursor-pointer bg-transparent px-3 py-2 text-left text-sm"
                >
                  Xóa
                </button>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
      ))}
    </div>
  );
};

const FooterRow = ({
  label,
  icon: Icon,
}: {
  label: string;
  icon: ComponentType<IconProps>;
}) => (
  <span
    title="Sắp có"
    aria-disabled="true"
    className={`${ITEM_CLASS} text-muted cursor-default`}
  >
    <Icon className="size-4 shrink-0" />
    <span>{label}</span>
  </span>
);

export const Sidebar = ({ user, onCollapse, onNavigate }: SidebarProps) => {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeConversationId =
    pathname === '/workspace' ? params.get('c') : null;

  const signOut = async (): Promise<void> => {
    await logout();
    clearDepartmentsCache();
    router.replace('/login');
  };

  return (
    <aside className="bg-background flex h-full w-80 max-w-[85vw] shrink-0 flex-col p-3">
      <div className="flex items-center justify-between px-1 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-foreground text-background flex size-7 shrink-0 items-center justify-center rounded-lg">
            <LogoIcon className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold">
            {user.tenant?.name ?? 'Auto Agent'}
          </span>
        </div>

        <button
          type="button"
          onClick={onCollapse}
          aria-label="Thu gọn thanh bên"
          className="text-muted hover:text-foreground cursor-pointer bg-transparent p-1"
        >
          <PanelLeftIcon className="size-4" />
        </button>
      </div>

      <div className="bg-surface border-border mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2">
        <SearchIcon className="text-muted size-4 shrink-0" />
        <input
          type="search"
          placeholder="Tìm kiếm..."
          className="text-foreground placeholder:text-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-muted border-border rounded border px-1 text-[10px] leading-4">
          ⌘
        </span>
        <span className="text-muted border-border rounded border px-1 text-[10px] leading-4">
          K
        </span>
      </div>

      <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {navSectionsFor(user.role).map((section) => (
          <div key={section.title ?? 'root'} className="flex flex-col gap-0.5">
            {section.title !== null && (
              <p className="text-muted px-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                {section.title}
              </p>
            )}

            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={pathname === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}

        <ConversationHistory
          activeId={activeConversationId}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="flex flex-col gap-0.5">
        <FooterRow label="Trợ giúp & Tài liệu" icon={HelpIcon} />
        <FooterRow label="Cài đặt" icon={SettingsIcon} />
      </div>

      <div className="relative mt-2">
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default bg-transparent"
            />
            <div className="bg-surface border-border absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border shadow-sm">
              <button
                type="button"
                onClick={signOut}
                className="text-danger hover:bg-surface-secondary w-full cursor-pointer bg-transparent px-3 py-2.5 text-left text-sm"
              >
                Đăng xuất
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="bg-surface border-border hover:bg-surface-hover flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left"
        >
          <Avatar size="sm">
            <Avatar.Fallback color="accent">
              {initialsOf(user.displayName)}
            </Avatar.Fallback>
          </Avatar>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {user.displayName}
            </span>
            <span className="text-muted block truncate text-xs">
              {user.email}
            </span>
          </span>

          <ChevronUpDownIcon className="text-muted size-4 shrink-0" />
        </button>
      </div>
    </aside>
  );
};
