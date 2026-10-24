const SLOW_REQUEST_MS = 3000;

let waitingRequestCount = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export type WatchedRequest = {
  markWaiting: () => void;
  finish: () => void;
};

export function watchRequest(): WatchedRequest {
  let isWaiting = false;
  const markWaiting = () => {
    if (isWaiting) return;
    isWaiting = true;
    waitingRequestCount += 1;
    notify();
  };
  const slowTimer = setTimeout(markWaiting, SLOW_REQUEST_MS);
  return {
    markWaiting,
    finish: () => {
      clearTimeout(slowTimer);
      if (!isWaiting) return;
      waitingRequestCount -= 1;
      notify();
    },
  };
}

export function subscribeToServerWait(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isWaitingForServer(): boolean {
  return waitingRequestCount > 0;
}
