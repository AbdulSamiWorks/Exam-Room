import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { startAnswerOutboxes } from './features/student/answers/outbox-store';
import { listenForInstallPrompt } from './lib/install-prompt';
import { registerServiceWorker } from './lib/service-worker';
import './styles/global.css';

listenForInstallPrompt();
startAnswerOutboxes();
registerServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
