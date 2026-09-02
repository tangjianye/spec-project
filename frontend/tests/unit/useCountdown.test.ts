/**
 * T053 倒计时 Hook 单测（FR-002 60s 冷却交互）
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../../src/features/auth/hooks/useCountdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCountdown', () => {
  it('start 后进入倒计时，结束自动恢复', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown(3));

    act(() => result.current.start(3));
    expect(result.current.isCounting).toBe(true);
    expect(result.current.secondsLeft).toBe(3);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isCounting).toBe(false);
  });

  it('reset 立即清零', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown(60));

    act(() => result.current.start(60));
    expect(result.current.isCounting).toBe(true);

    act(() => result.current.reset());
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isCounting).toBe(false);
  });
});
