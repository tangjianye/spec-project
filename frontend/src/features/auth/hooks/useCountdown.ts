/**
 * 60 秒倒计时 Hook（T029）——对齐 spec FR-002
 * 发送成功后进入倒计时，按钮禁用；倒计时结束自动恢复可点击。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown(initialSeconds = 60): {
  secondsLeft: number;
  isCounting: boolean;
  start: (seconds?: number) => void;
  reset: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds = initialSeconds) => {
      stop();
      setSecondsLeft(seconds);
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            stop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [initialSeconds, stop]
  );

  const reset = useCallback(() => {
    stop();
    setSecondsLeft(0);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { secondsLeft, isCounting: secondsLeft > 0, start, reset };
}
