'use client';

import type { ChangeEvent } from 'react';
import { AlertIcon } from '@/components/Icons';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email';
  autoComplete?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
}

export function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  multiline = false,
  rows = 3,
  placeholder,
  maxLength,
  required,
  optional,
  hint,
  error,
}: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const fieldClass = `w-full min-h-12 rounded-sm border bg-surface px-4 py-3 text-[15px] leading-[23px] text-ink-strong placeholder:text-ink-disabled transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none ${
    error ? 'border-state-danger' : 'border-line-strong hover:border-ink-muted'
  }`;

  function handle(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-ui text-[13px] font-bold leading-4 tracking-[0.02em] text-ink">
        {label}
        {optional ? <span className="font-medium text-ink-muted"> (opcional)</span> : null}
      </label>

      {multiline ? (
        <textarea
          id={id}
          name={id}
          rows={rows}
          value={value}
          onChange={handle}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`${fieldClass} min-h-[88px] resize-y`}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={handle}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={fieldClass}
        />
      )}

      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1 text-[13px] font-semibold leading-5 text-state-danger"
        >
          <AlertIcon size={15} />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-5 text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
