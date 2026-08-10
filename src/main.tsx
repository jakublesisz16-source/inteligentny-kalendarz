import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './app/registerServiceWorker';
import { capturePwaInstallPrompt } from './pwa/installPrompt';
import './styles/index.css';

capturePwaInstallPrompt();

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) registerServiceWorker();
