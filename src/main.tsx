import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './app/registerServiceWorker';
import { capturePwaInstallPrompt } from './pwa/installPrompt';
import './styles/index.css';

const searchParams = new URLSearchParams(window.location.search);
const syncLabEnabled = searchParams.get('syncLab') === '1';

const SyncLabView = lazy(async () => {
  const module = await import('./sync/SyncLabView');
  return { default: module.SyncLabView };
});

if (!syncLabEnabled) capturePwaInstallPrompt();

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root.');

createRoot(root).render(
  <StrictMode>
    {syncLabEnabled ? (
      <Suspense fallback={<main className="startup-screen"><div className="startup-card">Ładowanie Sync Lab...</div></main>}>
        <SyncLabView />
      </Suspense>
    ) : <App />}
  </StrictMode>,
);

if (!syncLabEnabled) registerServiceWorker();
