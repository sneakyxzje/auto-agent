import type { ReactNode } from 'react';
import styles from './auth-card.module.css';

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

/**
 * Khung chung của các màn hình đăng nhập/đăng ký. Dùng component thay vì nested
 * layout của Next: ít phép màu hơn, và tránh luôn lỗi của Next với thư mục có dấu
 * ngoặc trên Windows.
 */
export const AuthCard = ({ title, subtitle, children, footer }: AuthCardProps) => (
  <div className={styles.screen}>
    <div className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {children}
      <p className={styles.footer}>{footer}</p>
    </div>
  </div>
);

export const authFormClassName = styles.form;
