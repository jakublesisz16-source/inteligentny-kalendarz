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
    readonly differingStores: readonly string[] = [],
  ) {
    const detail = differingStores.length
      ? ` Różnią się dane: ${differingStores.slice(0, 5).join(', ')}.`
      : '';
    super(`Snapshot w chmurze ma niespójny hash payloadu.${detail} Dane lokalne pozostały bez zmian.`);
    this.name = 'SyncPayloadHashMismatchError';
  }
}
