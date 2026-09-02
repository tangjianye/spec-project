/**
 * 登录提交流状态 Hook（T040）——组合校验 + 加密 + 请求
 * 对齐 P2：Zod 未通过或提交中 → 登录按钮 disabled。
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginFormSchema, type LoginFormValues } from '../schemas/loginSchema';
import { encryptPassword } from '../services/rsaCrypto';
import { login, sendSms } from '../services/authApi';
import { parseApiError } from '../../../shared/services/http';
import { errorMessageMap } from '../schemas/loginSchema';
import { randomUUID } from '../../../shared/utils/uuid';

export type FieldErrors = Partial<Record<keyof LoginFormValues, string>>;

export function useLogin() {
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  /** P2 场景 1：字段失焦即时校验（≤200ms 纯本地） */
  const validateField = useCallback((values: LoginFormValues): FieldErrors => {
    const result = loginFormSchema.safeParse(values);
    const errors: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LoginFormValues;
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    return errors;
  }, []);

  const handleSendSms = useCallback(
    async (phone: string) => {
      setIsSendingCode(true);
      try {
        await sendSms(phone);
        setGlobalError('');
      } catch (error) {
        setGlobalError(error instanceof Error ? error.message : errorMessageMap[10009]);
      } finally {
        setIsSendingCode(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (values: LoginFormValues) => {
      const errors = validateField(values);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setIsSubmitting(true);
      setGlobalError('');
      try {
        const encryptedPassword = await encryptPassword(values.password);
        await login({
          phone: values.phone,
          code: values.code,
          encryptedPassword,
          deviceSessionId: randomUUID()
        });
        navigate('/dashboard', { replace: true });
      } catch (error) {
        const api = parseApiError(error);
        if (api.errors.length > 0) {
          const mapped: FieldErrors = {};
          for (const e of api.errors) {
            const key = e.field as keyof LoginFormValues;
            mapped[key] = errorMessageMap[api.code] ?? e.message;
          }
          setFieldErrors(mapped);
        } else {
          setGlobalError(errorMessageMap[api.code] ?? api.message);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, validateField]
  );

  return {
    fieldErrors,
    globalError,
    isSubmitting,
    isSendingCode,
    validateField,
    handleSendSms,
    handleSubmit
  };
}
