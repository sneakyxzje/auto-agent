import { useId } from 'react';
import styles from './text-field.module.css';

type TextFieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete?: string;
  disabled?: boolean;
};

/** Gộp nhãn, ô nhập và thông báo lỗi làm một, để mọi form khỏi lặp lại ba phần này. */
export const TextField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  disabled = false,
}: TextFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className={
          error === undefined
            ? styles.input
            : `${styles.input} ${styles.invalid}`
        }
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
      />
      {error !== undefined && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
};
