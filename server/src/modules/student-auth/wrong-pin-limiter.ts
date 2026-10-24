export type WrongPinLimiter = {
  isBlocked: (accountKey: string, currentTime: number) => boolean;
  recordWrongPin: (accountKey: string, currentTime: number) => void;
  forget: (accountKey: string) => void;
};

type WrongPinLimits = {
  maxWrongPins: number;
  windowMs: number;
  maxTrackedAccounts: number;
};

type WrongPinWindow = {
  firstWrongAt: number;
  wrongPinCount: number;
};

export function createWrongPinLimiter({
  maxWrongPins,
  windowMs,
  maxTrackedAccounts,
}: WrongPinLimits): WrongPinLimiter {
  const windows = new Map<string, WrongPinWindow>();

  function isExpired(window: WrongPinWindow, currentTime: number): boolean {
    return currentTime - window.firstWrongAt >= windowMs;
  }

  function activeWindow(accountKey: string, currentTime: number): WrongPinWindow | undefined {
    const window = windows.get(accountKey);
    if (!window || !isExpired(window, currentTime)) return window;
    windows.delete(accountKey);
    return undefined;
  }

  function forgetExpiredWindows(currentTime: number): void {
    for (const [accountKey, window] of windows) {
      if (isExpired(window, currentTime)) windows.delete(accountKey);
    }
  }

  return {
    isBlocked: (accountKey, currentTime) =>
      (activeWindow(accountKey, currentTime)?.wrongPinCount ?? 0) >= maxWrongPins,
    recordWrongPin: (accountKey, currentTime) => {
      const window = activeWindow(accountKey, currentTime);
      if (window) window.wrongPinCount += 1;
      else windows.set(accountKey, { firstWrongAt: currentTime, wrongPinCount: 1 });
      if (windows.size > maxTrackedAccounts) forgetExpiredWindows(currentTime);
    },
    forget: (accountKey) => {
      windows.delete(accountKey);
    },
  };
}
