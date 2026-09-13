const APP_CACHE_PREFIX = 'inteligentny-kalendarz-shell-';
const DEV_RELOAD_GUARD = 'ik-dev-sw-cleanup-reloaded';

export async function cleanupDevelopmentServiceWorker(): Promise<void> {
  const hadController = Boolean(navigator.serviceWorker.controller);
  const registration = await navigator.serviceWorker.getRegistration('./');
  if (registration) await registration.unregister();

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(APP_CACHE_PREFIX))
      .map((key) => caches.delete(key)));
  }

  // A previously installed production worker can still control the current
  // development tab, including a phone using a private-LAN address, until the next navigation. Reload once so Vite always serves
  // one coherent JS/CSS revision while developing.
  if (hadController && sessionStorage.getItem(DEV_RELOAD_GUARD) !== '1') {
    sessionStorage.setItem(DEV_RELOAD_GUARD, '1');
    window.location.reload();
    return;
  }

  sessionStorage.removeItem(DEV_RELOAD_GUARD);
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      void cleanupDevelopmentServiceWorker().catch((error: unknown) => {
        console.warn('Nie udało się wyczyścić deweloperskiego Service Workera.', error);
      });
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch((error: unknown) => {
      console.warn('Service worker nie został zarejestrowany.', error);
    });
  });
}
