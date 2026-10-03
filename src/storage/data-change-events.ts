export const LOCAL_DATA_CHANGED_EVENT = 'ik:local-data-changed';

export function emitLocalDataChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCAL_DATA_CHANGED_EVENT));
}
