/**
 * 登录表单组合组件（T032）——对齐宪法 II Component-First
 * 组合 PhoneInput / CountdownButton / CodeInput / PasswordInput。
 */
import { useState, type FormEvent } from 'react';
import { PhoneInput } from './PhoneInput';
import { CodeInput } from './CodeInput';
import { PasswordInput } from './PasswordInput';
import { CountdownButton } from './CountdownButton';
import { useLogin } from '../hooks/useLogin';

export function LoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const { fieldErrors, globalError, isSubmitting, isSendingCode, validateField, handleSendSms, handleSubmit } =
    useLogin();

  const values = { phone, code, password };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSubmit(values);
  };

  const onFieldBlur = () => {
    const errors = validateField(values);
    // 仅展示已触碰字段错误，避免过早打扰（对齐 P2 友好提示）
    const next: typeof fieldErrors = {};
    if (phone && errors.phone) next.phone = errors.phone;
    if (code && errors.code) next.code = errors.code;
    if (password && errors.password) next.password = errors.password;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="login-form" aria-label="登录表单">
      {globalError && (
        <div className="global-error" role="alert">
          {globalError}
        </div>
      )}

      <PhoneInput id="phone" value={phone} error={fieldErrors.phone} onChange={setPhone} />

      <div className="code-row">
        <CodeInput id="code" value={code} error={fieldErrors.code} onChange={setCode} />
        <CountdownButton disabled={isSendingCode || !/^1[3-9]\d{9}$/.test(phone)} onSend={() => handleSendSms(phone)} />
      </div>

      <PasswordInput id="password" value={password} error={fieldErrors.password} onChange={setPassword} />

      <button
        type="submit"
        disabled={isSubmitting}
        aria-disabled={isSubmitting}
        className="submit-btn"
        onBlur={onFieldBlur}
      >
        {isSubmitting ? '登录中…' : '登 录'}
      </button>
    </form>
  );
}
