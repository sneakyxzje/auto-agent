'use client';

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  name: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | undefined;
  disabled?: boolean;
};

export const SelectField = ({
  label,
  name,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled = false,
}: SelectFieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={name} className="text-sm font-medium">
      {label}
    </label>

    <select
      id={name}
      name={name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="border-border bg-surface h-11 cursor-pointer rounded-xl border px-3 text-sm disabled:opacity-50"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    {error !== undefined && <p className="text-danger text-xs">{error}</p>}
  </div>
);
