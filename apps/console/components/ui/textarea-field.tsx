import {
  FieldError,
  TextField as HeroTextField,
  Label,
  TextArea,
} from '@heroui/react';

type TextAreaFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  error?: string | undefined;
  disabled?: boolean;
};

export const TextAreaField = ({
  label,
  name,
  value,
  onChange,
  rows = 3,
  error,
  disabled = false,
}: TextAreaFieldProps) => (
  <HeroTextField
    name={name}
    value={value}
    onChange={onChange}
    isDisabled={disabled}
    isInvalid={error !== undefined}
    fullWidth
  >
    <Label>{label}</Label>
    <TextArea rows={rows} />
    {error !== undefined && <FieldError>{error}</FieldError>}
  </HeroTextField>
);
