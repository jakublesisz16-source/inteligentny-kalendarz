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
  pushSnapshot(snapshot: SyncSnapshotEnvelope, expectedRevision?: string | null): Promise<void>;
}

export interface SyncStatus {
  providerId: string;
  mode: SyncProviderMode;
  configured: boolean;
  account: SyncAccount | null;
  cloudEnabled: boolean;
}

export type SyncConflictChoice = 'local' | 'cloud';

export interface SyncRecoveryConflict {
  kind: 'legacy-payload-hash-mismatch';
  localRevision: string;
  cloudRevision: string;
  localUpdatedAt: string;
  cloudUpdatedAt: string;
  expectedPayloadSha256: string;
  actualPayloadSha256: string;
  differingStores: string[];
}

export interface SyncConflict {
  localRevision: string;
  cloudRevision: string;
  localUpdatedAt: string;
  cloudUpdatedAt: string;
}

export type SyncReconcileResult =
  | { phase: 'local-only'; status: SyncStatus }
  | { phase: 'signed-out'; status: SyncStatus }
  | { phase: 'synced'; status: SyncStatus; revision: string; lastSyncAt: string }
  | { phase: 'pushed'; status: SyncStatus; revision: string; lastSyncAt: string }
  | { phase: 'pulled'; status: SyncStatus; revision: string; lastSyncAt: string }
  | { phase: 'conflict'; status: SyncStatus; conflict: SyncConflict }
  | { phase: 'recovery-required'; status: SyncStatus; recovery: SyncRecoveryConflict };

export interface SyncRuntimeNotice {
  state: 'local-only' | 'signed-out' | 'syncing' | 'synced' | 'conflict' | 'recovery-required' | 'error';
  providerId: string;
  account?: SyncAccount;
  message?: string;
  lastSyncAt?: string;
  conflict?: SyncConflict;
  recovery?: SyncRecoveryConflict;
}
