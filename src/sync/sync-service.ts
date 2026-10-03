import { applyCloudSyncSnapshot, createCanonicalDataTransferDocument, hasMeaningfulDataTransferContent } from '../storage/database';
import { sha256Hex } from '../core/sha256';
import {
  getPreferredSyncProviderId,
  getSyncDeviceId,
  readLocalSyncState,
  writeLocalSyncState,
} from './sync-config';
import { SyncPayloadHashMismatchError, SyncRemoteChangedError, SyncRevisionMismatchError } from './sync-errors';
import { resolveSyncProvider } from './provider-registry';
import type {
  SyncConflict,
  SyncConflictChoice,
  SyncProvider,
  SyncReconcileResult,
  SyncSnapshotEnvelope,
  SyncStatus,
} from './sync.types';

function syncRevisionPayload(snapshot: SyncSnapshotEnvelope['document']['data']) {
  return {
    format: snapshot.format,
    snapshotVersion: snapshot.snapshotVersion,
    databaseSchemaVersion: snapshot.databaseSchemaVersion,
    stores: snapshot.stores,
  };
}

export async function calculateSyncRevision(snapshot: SyncSnapshotEnvelope['document']['data']): Promise<string> {
  return sha256Hex(JSON.stringify(syncRevisionPayload(snapshot)));
}

function sortJsonObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonObjectKeys);
  if (!value || typeof value !== 'object') return value;
  const object = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(object).sort().map((key) => [key, sortJsonObjectKeys(object[key])]));
}

export async function calculateSyncContentFingerprint(snapshot: SyncSnapshotEnvelope['document']['data']): Promise<string> {
  // This fingerprint is only an order-independent equivalence proof used to repair
  // revision metadata. It does not replace the persisted revision format.
  const jsonCompatible = JSON.parse(JSON.stringify(syncRevisionPayload(snapshot))) as unknown;
  return sha256Hex(JSON.stringify(sortJsonObjectKeys(jsonCompatible)));
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SyncService {
  constructor(private readonly provider: SyncProvider) {}

  async getStatus(): Promise<SyncStatus> {
    const account = await this.provider.getAccount();
    return {
      providerId: this.provider.id,
      mode: this.provider.mode,
      configured: this.provider.isConfigured(),
      account,
      cloudEnabled: this.provider.capabilities.cloud && Boolean(account),
    };
  }

  async signIn() {
    return this.provider.signIn();
  }

  async signOut(): Promise<void> {
    await this.provider.signOut();
  }

  async captureLocalSnapshot(sourceDeviceId = getSyncDeviceId()): Promise<SyncSnapshotEnvelope> {
    const document = await createCanonicalDataTransferDocument();
    return {
      format: 'inteligentny-kalendarz-sync-snapshot',
      version: 1,
      revision: await calculateSyncRevision(document.data),
      updatedAt: document.createdAt,
      sourceDeviceId,
      document,
    };
  }

  async pullLatestSnapshot(): Promise<SyncSnapshotEnvelope | null> {
    if (!this.provider.capabilities.cloud || !this.provider.isConfigured()) return null;
    const account = await this.provider.getAccount();
    if (!account) return null;
    const snapshot = await this.provider.pullLatest();
    if (!snapshot) return null;
    const calculated = await calculateSyncRevision(snapshot.document.data);
    if (calculated !== snapshot.revision) throw new SyncRevisionMismatchError(snapshot, calculated);
    return snapshot;
  }

  private markSynced(accountId: string, revision: string): string {
    const lastSyncAt = nowIso();
    writeLocalSyncState({
      providerId: this.provider.id,
      accountId,
      lastSyncedRevision: revision,
      lastSyncedAt: lastSyncAt,
    });
    return lastSyncAt;
  }

  private async pushSnapshot(
    accountId: string,
    snapshot: SyncSnapshotEnvelope,
    expectedRevision?: string | null,
  ): Promise<string> {
    const calculated = await calculateSyncRevision(snapshot.document.data);
    if (calculated !== snapshot.revision) {
      throw new Error('Lokalny snapshot zmienił się przed wysłaniem. Synchronizacja została bezpiecznie zatrzymana.');
    }
    await this.provider.pushSnapshot(snapshot, expectedRevision);
    return this.markSynced(accountId, snapshot.revision);
  }

  private async applyCloudSnapshot(accountId: string, snapshot: SyncSnapshotEnvelope): Promise<string> {
    await applyCloudSyncSnapshot(snapshot.document);
    return this.markSynced(accountId, snapshot.revision);
  }

  private conflict(local: SyncSnapshotEnvelope, cloud: SyncSnapshotEnvelope): SyncConflict {
    return {
      localRevision: local.revision,
      cloudRevision: cloud.revision,
      localUpdatedAt: local.updatedAt,
      cloudUpdatedAt: cloud.updatedAt,
    };
  }

  async reconcile(): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!this.provider.capabilities.cloud) return { phase: 'local-only', status };
    if (!status.account) return { phase: 'signed-out', status };

    const account = status.account;
    const localPromise = this.captureLocalSnapshot();
    let local: SyncSnapshotEnvelope;
    let cloud: SyncSnapshotEnvelope | null;
    try {
      [local, cloud] = await Promise.all([
        localPromise,
        this.pullLatestSnapshot(),
      ]);
    } catch (error) {
      if (error instanceof SyncRevisionMismatchError || error instanceof SyncPayloadHashMismatchError) {
        local = await localPromise;
        const [localFingerprint, cloudFingerprint] = await Promise.all([
          calculateSyncContentFingerprint(local.document.data),
          calculateSyncContentFingerprint(error.snapshot.document.data),
        ]);
        if (localFingerprint === cloudFingerprint) {
          try {
            const lastSyncAt = await this.pushSnapshot(account.id, local, error.snapshot.revision);
            return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
          } catch (repairError) {
            if (repairError instanceof SyncRemoteChangedError) return this.reconcile();
            throw repairError;
          }
        }
      }
      throw error;
    }
    const previous = readLocalSyncState(this.provider.id, account.id);

    if (!cloud) {
      try {
        const lastSyncAt = await this.pushSnapshot(account.id, local, null);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) return this.reconcile();
        throw error;
      }
    }

    if (cloud.revision === local.revision) {
      const lastSyncAt = this.markSynced(account.id, local.revision);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    if (!previous) {
      if (!hasMeaningfulDataTransferContent(local.document)) {
        const lastSyncAt = await this.applyCloudSnapshot(account.id, cloud);
        return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
      }
      return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
    }

    const localChanged = local.revision !== previous.lastSyncedRevision;
    const cloudChanged = cloud.revision !== previous.lastSyncedRevision;

    if (!localChanged && cloudChanged) {
      const lastSyncAt = await this.applyCloudSnapshot(account.id, cloud);
      return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
    }

    if (localChanged && !cloudChanged) {
      try {
        const lastSyncAt = await this.pushSnapshot(account.id, local, previous.lastSyncedRevision);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) {
          const latestCloud = await this.pullLatestSnapshot();
          if (!latestCloud) return this.reconcile();
          return { phase: 'conflict', status, conflict: this.conflict(local, latestCloud) };
        }
        throw error;
      }
    }

    if (!localChanged && !cloudChanged) {
      const lastSyncAt = this.markSynced(account.id, local.revision);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
  }

  async resolveConflict(choice: SyncConflictChoice): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!status.account) return { phase: 'signed-out', status };
    const account = status.account;

    if (choice === 'cloud') {
      const cloud = await this.pullLatestSnapshot();
      if (!cloud) return this.reconcile();
      const lastSyncAt = await this.applyCloudSnapshot(account.id, cloud);
      return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
    }

    const [local, cloud] = await Promise.all([
      this.captureLocalSnapshot(),
      this.pullLatestSnapshot(),
    ]);
    const expectedRevision = cloud?.revision ?? null;
    try {
      const lastSyncAt = await this.pushSnapshot(account.id, local, expectedRevision);
      return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
    } catch (error) {
      if (error instanceof SyncRemoteChangedError) return this.reconcile();
      throw error;
    }
  }
}

export async function createSyncService(providerId = getPreferredSyncProviderId()): Promise<SyncService> {
  return new SyncService(await resolveSyncProvider(providerId));
}
