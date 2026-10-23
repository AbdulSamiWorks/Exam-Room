const SERVICE_WORKER_PATH = '/service-worker.js';

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(() => undefined);
  });
}
