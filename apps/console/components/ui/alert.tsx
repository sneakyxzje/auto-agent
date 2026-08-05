import { Alert as HeroAlert } from '@heroui/react';
import type { ReactNode } from 'react';

type AlertProps = {
  tone: 'danger' | 'success';
  children: ReactNode;
};

export const Alert = ({ tone, children }: AlertProps) => (
  <HeroAlert status={tone}>
    <HeroAlert.Indicator />
    <HeroAlert.Content>
      <HeroAlert.Description>{children}</HeroAlert.Description>
    </HeroAlert.Content>
  </HeroAlert>
);
