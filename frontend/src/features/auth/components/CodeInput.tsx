/**
 * 验证码输入框（T031）——6 位数字，P2 即时校验
 */
import type { ChangeEvent } from 'react';

interface CodeInputProps {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export function CodeInput({ id, value, error, onChange }: CodeInputProps) {
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>短信验证码</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={error ? 'input-error' : ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/\D/g, ''))}
      />
      {error && (
        <span id={describedBy} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
