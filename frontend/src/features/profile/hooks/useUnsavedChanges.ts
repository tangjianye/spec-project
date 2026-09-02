import { useEffect } from 'react';

export function useUnsavedChanges(enabled: boolean, message = '资料尚未保存，确定要离开吗？') {
  useEffect(() => {
    if (!enabled) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!anchor || event.defaultPrevented) return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin === window.location.origin && !window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [enabled, message]);
}
