'use client';

import { Modal as HeroModal, useOverlayState } from '@heroui/react';
import type { ReactNode } from 'react';

type DialogProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
};

/**
 * Khác `Modal` ở chỗ đóng được: `Modal` phục vụ luồng onboarding, người dùng chưa
 * xong bước thì không có gì để xem phía sau nên nó cố tình không cho thoát.
 *
 * Nội dung chỉ được mount khi mở, nên form bên trong tự sạch state sau mỗi lần
 * đóng — không cần reset tay.
 */
export const Dialog = ({
  title,
  subtitle,
  open,
  onClose,
  size = 'md',
  children,
}: DialogProps) => {
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <HeroModal state={state}>
      <HeroModal.Backdrop>
        <HeroModal.Container size={size} placement="center">
          <HeroModal.Dialog>
            <HeroModal.Header>
              <HeroModal.Heading>{title}</HeroModal.Heading>
              {subtitle !== undefined && (
                <p className="text-muted mt-1 text-sm">{subtitle}</p>
              )}
              <HeroModal.CloseTrigger />
            </HeroModal.Header>

            <HeroModal.Body>{children}</HeroModal.Body>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
};
