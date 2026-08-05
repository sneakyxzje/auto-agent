import type { ReactNode } from 'react';
import styles from './modal.module.css';

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
}: ModalProps) => (
  <div className={styles.backdrop} role="dialog" aria-modal="true">
    <div className={styles.panel}>
      <div className={styles.steps}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <span
            key={`step-${index + 1}`}
            className={
              index < step ? `${styles.step} ${styles.stepActive}` : styles.step
            }
          />
        ))}
      </div>

      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>
      <div className={styles.body}>{children}</div>
    </div>
  </div>
);

export const modalStyles = styles;
