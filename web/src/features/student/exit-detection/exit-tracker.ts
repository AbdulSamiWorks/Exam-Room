import type { StudentExitReason } from '@exam-room/shared';
import { createRandomId } from '../../../lib/random-id';
import type { PendingExit } from '../attempt-storage';

export type ExitTrackerOptions = {
  unfinishedExit: PendingExit | undefined;
  isWatching: () => boolean;
  onLeave: (exit: PendingExit) => void;
  onReturn: (exit: PendingExit, awayMs: number) => void;
};

export function startExitTracker(options: ExitTrackerOptions): () => void {
  let currentExit = options.unfinishedExit;
  let wasFullscreen = Boolean(document.fullscreenElement);

  function leave(reason: StudentExitReason): void {
    if (currentExit || !options.isWatching()) return;
    currentExit = { clientExitId: createRandomId(), reason, leftAt: Date.now() };
    options.onLeave(currentExit);
  }

  function returnIfBack(): void {
    if (!currentExit || document.visibilityState !== 'visible') return;
    if (currentExit.reason === 'blur' && !document.hasFocus()) return;

    const finishedExit = currentExit;
    currentExit = undefined;
    options.onReturn(finishedExit, Math.max(0, Date.now() - finishedExit.leftAt));
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') leave('hidden');
    else returnIfBack();
  }

  function handleFullscreenChange(): void {
    const isFullscreen = Boolean(document.fullscreenElement);
    if (wasFullscreen && !isFullscreen) {
      leave('fullscreen');
      returnIfBack();
    }
    wasFullscreen = isFullscreen;
  }

  const handleBlur = () => leave('blur');
  const handlePageHide = () => leave('hidden');

  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', returnIfBack);
  window.addEventListener('pagehide', handlePageHide);

  returnIfBack();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', returnIfBack);
    window.removeEventListener('pagehide', handlePageHide);
  };
}
