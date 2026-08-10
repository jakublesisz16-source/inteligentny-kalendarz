import { useEffect, useState } from 'react';
import { canPromptPwaInstall, isIosSafari, isPwaStandalone, promptPwaInstall, subscribePwaInstallPrompt } from '../pwa/installPrompt';

export function PwaInstallPanel() {
  const [, rerender] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => subscribePwaInstallPrompt(() => rerender((value) => value + 1)), []);

  const installed = isPwaStandalone();
  const canInstall = !installed && canPromptPwaInstall();
  const iosHelp = !installed && !canInstall && isIosSafari();

  if (!installed && !canInstall && !iosHelp) return null;

  return (
    <div className="pwa-install-panel">
      {installed ? <span>Aplikacja jest uruchomiona w trybie zainstalowanym.</span> : null}
      {canInstall ? <button type="button" className="button button-secondary button-small" onClick={() => void promptPwaInstall().then((result) => setMessage(result === 'accepted' ? 'Instalacja została uruchomiona.' : result === 'dismissed' ? 'Instalację anulowano.' : 'Instalacja nie jest teraz dostępna.'))}>Zainstaluj aplikację na tym urządzeniu</button> : null}
      {iosHelp ? <span>Na iPhone: wybierz Udostępnij, a potem Do ekranu początkowego.</span> : null}
      {message ? <small role="status" aria-live="polite">{message}</small> : null}
    </div>
  );
}
