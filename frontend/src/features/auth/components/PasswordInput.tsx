/**
 * 密码输入框（T031）——P2 即时校验；Enter 提交由父表单处理
 */
import type { ChangeEvent } from 'react';

interface PasswordInputProps {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export function PasswordInput({ id, value, error, onChange }: PasswordInputProps) {
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>密码</label>
      <input
        id={id}
        type="password"
        autoComplete="current-password"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={error ? 'input-error' : ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {error && (
        <span id={describedBy} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
