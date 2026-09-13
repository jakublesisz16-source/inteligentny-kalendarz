import { cleanupDevelopmentServiceWorker } from './registerServiceWorker';

// This entry is intentionally loaded before main.tsx. A production Service Worker
// left behind on the same LAN origin can otherwise cache Vite development modules
// and keep a phone on an older CalendarView even after the desktop is up to date.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void cleanupDevelopmentServiceWorker().catch((error: unknown) => {
    console.warn('Nie udało się wyczyścić starego Service Workera przed uruchomieniem dev.', error);
  });
}
