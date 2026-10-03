import type { BackupDocument } from '../safety/safety.types';

export type SyncProviderMode = 'local-only' | 'cloud';

export interface SyncAccount {
  id: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

export interface SyncSnapshotEnvelope {
  format: 'inteligentny-kalendarz-sync-snapshot';
  version: 1;
  revision: string;
  updatedAt: string;
  sourceDeviceId: string;
  document: BackupDocument;
}

export interface SyncProviderCapabilities {
  cloud: boolean;
  authentication: boolean;
}

export interface SyncProvider {
  readonly id: string;
  readonly mode: SyncProviderMode;
  readonly capabilities: SyncProviderCapabilities;
  isConfigured(): boolean;
  getAccount(): Promise<SyncAccount | null>;
  signIn(): Promise<SyncAccount | null>;
  signOut(): Promise<void>;
  pullLatest(): Promise<SyncSnapshotEnvelope | null>;
  pushSnapshot(snapshot: SyncSnapshotEnvelope): Promise<void>;
}

export interface SyncStatus {
  providerId: string;
  mode: SyncProviderMode;
  configured: boolean;
  account: SyncAccount | null;
  cloudEnabled: boolean;
}
