import type { ReactNode } from 'react';
import styles from './button.module.css';

type ButtonProps = {
  children: ReactNode;
  type?: 'button' | 'submit';
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export const Button = ({
  children,
  type = 'button',
  block = false,
  disabled = false,
  onClick,
}: ButtonProps) => (
  <button
    type={type === 'submit' ? 'submit' : 'button'}
    className={block ? `${styles.button} ${styles.block}` : styles.button}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);
