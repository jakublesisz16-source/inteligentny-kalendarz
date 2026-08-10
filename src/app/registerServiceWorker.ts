export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch((error: unknown) => {
      console.warn('Service worker nie został zarejestrowany.', error);
    });
  });
}
