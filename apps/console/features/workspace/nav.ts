import type { UserRole } from '@chatbot/contracts';
import { hasRole } from '@chatbot/contracts';
import type { ComponentType } from 'react';
import {
  ApproveIcon,
  ChartIcon,
  DepartmentIcon,
  DocumentIcon,
  HomeIcon,
  type IconProps,
  MembersIcon,
  TicketIcon,
} from './icons';

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  ready: boolean;
  minRole: UserRole;
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      {
        href: '/workspace',
        label: 'Trang chủ',
        icon: HomeIcon,
        ready: true,
        minRole: 'user',
      },
    ],
  },
  {
    title: 'Chung',
    items: [
      {
        href: '/workspace/departments',
        label: 'Phòng ban',
        icon: DepartmentIcon,
        ready: true,
        minRole: 'user',
      },
      {
        href: '/workspace/documents',
        label: 'Tài liệu',
        icon: DocumentIcon,
        ready: true,
        minRole: 'user',
      },
      {
        href: '/workspace/escalations',
        label: 'Ticket',
        icon: TicketIcon,
        ready: true,
        minRole: 'manager',
      },
      {
        href: '/workspace/curation',
        label: 'Duyệt nội dung',
        icon: ApproveIcon,
        ready: true,
        minRole: 'manager',
      },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      {
        href: '/workspace/members',
        label: 'Thành viên',
        icon: MembersIcon,
        ready: true,
        minRole: 'admin',
      },
      {
        href: '/workspace/dashboard',
        label: 'Chỉ số',
        icon: ChartIcon,
        ready: false,
        minRole: 'admin',
      },
    ],
  },
];

/** Nhóm nào không còn mục nào hợp lệ thì biến mất luôn, không để tiêu đề trơ. */
export const navSectionsFor = (role: UserRole): NavSection[] =>
  SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasRole(role, item.minRole)),
  })).filter((section) => section.items.length > 0);
