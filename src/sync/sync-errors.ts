export class SyncRemoteChangedError extends Error {
  constructor(readonly currentRevision: string | null) {
    super('Dane w chmurze zmieniły się podczas synchronizacji.');
    this.name = 'SyncRemoteChangedError';
  }
}
