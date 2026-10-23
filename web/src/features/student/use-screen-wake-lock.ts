import { useEffect } from 'react';

export function useScreenWakeLock(isWanted: boolean): void {
  useEffect(() => {
    if (!isWanted || !('wakeLock' in navigator)) return;

    let wakeLock: WakeLockSentinel | undefined;
    let isRequesting = false;
    let isStopped = false;

    function isHeld(): boolean {
      return wakeLock !== undefined && !wakeLock.released;
    }

    async function requestWakeLock(): Promise<void> {
      if (isStopped || isRequesting || isHeld() || document.visibilityState !== 'visible') return;
      isRequesting = true;
      try {
        const newWakeLock = await navigator.wakeLock.request('screen');
        if (isStopped) await newWakeLock.release();
        else wakeLock = newWakeLock;
      } catch {
        wakeLock = undefined;
      } finally {
        isRequesting = false;
      }
    }

    function requestAgain(): void {
      void requestWakeLock();
    }

    requestAgain();
    document.addEventListener('visibilitychange', requestAgain);
    document.addEventListener('pointerup', requestAgain, { capture: true, passive: true });

    return () => {
      isStopped = true;
      document.removeEventListener('visibilitychange', requestAgain);
      document.removeEventListener('pointerup', requestAgain, { capture: true });
      wakeLock?.release().catch(() => undefined);
    };
  }, [isWanted]);
}
