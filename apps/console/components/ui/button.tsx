import { Button as HeroButton } from '@heroui/react';
import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

const VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
} as const;

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  block = false,
  disabled = false,
  onClick,
}: ButtonProps) => (
  <HeroButton
    type={type}
    variant={VARIANTS[variant]}
    fullWidth={block}
    isDisabled={disabled}
    onPress={onClick}
  >
    {children}
  </HeroButton>
);
