'use client';

import { Modal as HeroModal, useOverlayState } from '@heroui/react';
import type { ReactNode } from 'react';

type ModalProps = {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  children: ReactNode;
};

export const Modal = ({
  title,
  subtitle,
  step,
  totalSteps,
  children,
}: ModalProps) => {
  const state = useOverlayState({ isOpen: true });

  return (
    <HeroModal state={state}>
      <HeroModal.Backdrop>
        <HeroModal.Container size="sm" placement="center">
          <HeroModal.Dialog>
            <HeroModal.Header>
              <div className="mb-3 flex gap-1.5">
                {Array.from({ length: totalSteps }, (_, index) => (
                  <span
                    key={`step-${index + 1}`}
                    className={`h-1 flex-1 rounded-full ${
                      index < step ? 'bg-accent' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <HeroModal.Heading>{title}</HeroModal.Heading>
              <p className="text-muted mt-1 text-sm">{subtitle}</p>
            </HeroModal.Header>

            <HeroModal.Body>{children}</HeroModal.Body>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
};
