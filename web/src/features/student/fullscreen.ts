export function enterFullscreen(): void {
  const page = document.documentElement;
  if (document.fullscreenElement || typeof page.requestFullscreen !== 'function') return;
  page.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
}

export function leaveFullscreen(): void {
  if (!document.fullscreenElement) return;
  document.exitFullscreen().catch(() => undefined);
}
