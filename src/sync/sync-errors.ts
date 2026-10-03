import type { SyncSnapshotEnvelope } from './sync.types';

export class SyncRemoteChangedError extends Error {
  constructor(readonly currentRevision: string | null) {
    super('Dane w chmurze zmieniły się podczas synchronizacji.');
    this.name = 'SyncRemoteChangedError';
  }
}

export class SyncRevisionMismatchError extends Error {
  constructor(
    readonly snapshot: SyncSnapshotEnvelope,
    readonly calculatedRevision: string,
  ) {
    super('Snapshot w chmurze ma niespójne metadane revision. Dane lokalne pozostały bez zmian.');
    this.name = 'SyncRevisionMismatchError';
  }
}

export class SyncPayloadHashMismatchError extends Error {
  constructor(
    readonly snapshot: SyncSnapshotEnvelope,
    readonly expectedPayloadSha256: string,
    readonly actualPayloadSha256: string,
  ) {
    super('Snapshot w chmurze ma niespójny hash payloadu. Dane lokalne pozostały bez zmian.');
    this.name = 'SyncPayloadHashMismatchError';
  }
}
