import type { ReactNode } from 'react';
import styles from './alert.module.css';

type AlertProps = {
  tone: 'danger' | 'success';
  children: ReactNode;
};

export const Alert = ({ tone, children }: AlertProps) => (
  <p className={`${styles.alert} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
    {children}
  </p>
);
