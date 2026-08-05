import {
  FieldError,
  TextField as HeroTextField,
  Input,
  Label,
} from '@heroui/react';

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

export const TextField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  disabled = false,
}: TextFieldProps) => (
  <HeroTextField
    name={name}
    type={type}
    value={value}
    onChange={onChange}
    isDisabled={disabled}
    isInvalid={error !== undefined}
    fullWidth
  >
    <Label>{label}</Label>
    <Input autoComplete={autoComplete} />
    {error !== undefined && <FieldError>{error}</FieldError>}
  </HeroTextField>
);
