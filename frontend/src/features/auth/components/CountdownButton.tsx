/**
 * "获取验证码"按钮（T030）——对齐 spec FR-002 / 宪法 IV 无障碍
 * 原生 button + disabled + aria-disabled；倒计时文案 59s 后重新获取。
 */
import { useCountdown } from '../hooks/useCountdown';

interface CountdownButtonProps {
  disabled?: boolean;
  onSend: () => Promise<void> | void;
}

export function CountdownButton({ disabled = false, onSend }: CountdownButtonProps) {
  const { secondsLeft, isCounting, start } = useCountdown(60);

  const handleClick = async () => {
    if (isCounting || disabled) return;
    await onSend();
    start(60);
  };

  return (
    <button
      type="button"
      disabled={disabled || isCounting}
      aria-disabled={disabled || isCounting}
      onClick={handleClick}
      className="countdown-btn"
    >
      {isCounting ? `${secondsLeft}s 后重新获取` : '获取验证码'}
    </button>
  );
}
