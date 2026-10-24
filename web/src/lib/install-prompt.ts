import { useSyncExternalStore } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let savedPrompt: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    savedPrompt = event as InstallPromptEvent;
    notifyListeners();
  });
  window.addEventListener('appinstalled', () => {
    savedPrompt = undefined;
    notifyListeners();
  });
}

export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => savedPrompt);

  async function install(): Promise<void> {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    savedPrompt = undefined;
    notifyListeners();
  }

  return { canInstall: prompt !== undefined, install };
}
