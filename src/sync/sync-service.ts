import {
  applyCloudSyncSnapshot,
  claimLocalSyncOwnerAccountId,
  compactTechnicalStorage,
  createCanonicalDataTransferDocument,
  hasMeaningfulDataTransferContent,
  resetLocalDatabaseForAccountSwitch,
} from '../storage/database';
import { sha256Hex } from '../core/sha256';
import {
  clearLocalSyncState,
  getPreferredSyncProviderId,
  getSyncDeviceId,
  readLocalSyncState,
  writeLocalSyncState,
} from './sync-config';
import {
  SyncAccountChangedError,
  SyncAccountOwnershipError,
  SyncPayloadHashMismatchError,
  SyncRemoteChangedError,
  SyncRevisionMismatchError,
} from './sync-errors';
import { resolveSyncProvider } from './provider-registry';
import type {
  SyncConflict,
  SyncConflictChoice,
  SyncProvider,
  SyncReconcileResult,
  SyncRemoteState,
  SyncRecoveryConflict,
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

const LEGACY_PAYLOAD_RECOVERY_IGNORED_STORES = new Set(['changeJournal']);

function syncRecoveryPayload(snapshot: SyncSnapshotEnvelope['document']['data']) {
  return {
    format: snapshot.format,
    snapshotVersion: snapshot.snapshotVersion,
    databaseSchemaVersion: snapshot.databaseSchemaVersion,
    stores: Object.fromEntries(
      Object.entries(snapshot.stores).filter(([name]) => !LEGACY_PAYLOAD_RECOVERY_IGNORED_STORES.has(name)),
    ),
  };
}

export async function calculateSyncRecoveryFingerprint(snapshot: SyncSnapshotEnvelope['document']['data']): Promise<string> {
  const jsonCompatible = JSON.parse(JSON.stringify(syncRecoveryPayload(snapshot))) as unknown;
  return sha256Hex(JSON.stringify(sortJsonObjectKeys(jsonCompatible)));
}

export function listSyncRecoveryStoreDifferences(
  local: SyncSnapshotEnvelope['document']['data'],
  cloud: SyncSnapshotEnvelope['document']['data'],
): string[] {
  const differences: string[] = [];
  if (
    local.format !== cloud.format
    || local.snapshotVersion !== cloud.snapshotVersion
    || local.databaseSchemaVersion !== cloud.databaseSchemaVersion
  ) differences.push('$schema');

  const storeNames = new Set([...Object.keys(local.stores), ...Object.keys(cloud.stores)]);
  for (const name of [...storeNames].sort()) {
    if (LEGACY_PAYLOAD_RECOVERY_IGNORED_STORES.has(name)) continue;
    const localValue = JSON.stringify(sortJsonObjectKeys(local.stores[name] ?? null));
    const cloudValue = JSON.stringify(sortJsonObjectKeys(cloud.stores[name] ?? null));
    if (localValue !== cloudValue) differences.push(name);
  }
  return differences;
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

  private async assertAccountStable(accountId: string): Promise<void> {
    const current = await this.provider.getAccount();
    if (!current || current.id !== accountId) throw new SyncAccountChangedError();
  }

  private async ensureLocalAccountOwner(accountId: string): Promise<void> {
    const ownerAccountId = await claimLocalSyncOwnerAccountId(accountId);
    if (ownerAccountId !== accountId) throw new SyncAccountOwnershipError(accountId, ownerAccountId);
  }

  private async prepareCloudOperation(accountId: string): Promise<void> {
    await this.ensureLocalAccountOwner(accountId);
    await this.assertAccountStable(accountId);
  }

  async captureLocalSnapshot(sourceDeviceId = getSyncDeviceId()): Promise<SyncSnapshotEnvelope> {
    // Keep the synchronized state bounded before serializing it. This only removes
    // historical parser payloads / technical history that the active plan no longer
    // needs; current user data remains untouched.
    await compactTechnicalStorage();
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

  async pullLatestSnapshot(accountId?: string, expectedState?: SyncRemoteState | null): Promise<SyncSnapshotEnvelope | null> {
    if (!this.provider.capabilities.cloud || !this.provider.isConfigured()) return null;
    const account = await this.provider.getAccount();
    if (!account) return null;
    const expectedAccountId = accountId ?? account.id;
    if (account.id !== expectedAccountId) throw new SyncAccountChangedError();
    await this.ensureLocalAccountOwner(expectedAccountId);
    const snapshot = await this.provider.pullLatest(expectedState);
    await this.assertAccountStable(expectedAccountId);
    if (!snapshot) return null;
    const calculated = await calculateSyncRevision(snapshot.document.data);
    if (calculated !== snapshot.revision) throw new SyncRevisionMismatchError(snapshot, calculated);
    return snapshot;
  }

  private markSynced(accountId: string, revision: string, remoteState?: SyncRemoteState | null): string {
    const lastSyncAt = nowIso();
    writeLocalSyncState({
      providerId: this.provider.id,
      accountId,
      lastSyncedRevision: revision,
      lastSyncedAt: lastSyncAt,
      ...(remoteState?.payloadSha256 ? { lastRemotePayloadSha256: remoteState.payloadSha256 } : {}),
    });
    return lastSyncAt;
  }

  private async pushSnapshot(
    accountId: string,
    snapshot: SyncSnapshotEnvelope,
    expectedRevision?: string | null,
  ): Promise<string> {
    await this.assertAccountStable(accountId);
    const calculated = await calculateSyncRevision(snapshot.document.data);
    if (calculated !== snapshot.revision) {
      throw new Error('Lokalny snapshot zmienił się przed wysłaniem. Synchronizacja została bezpiecznie zatrzymana.');
    }
    const remoteState = await this.provider.pushSnapshot(snapshot, expectedRevision);
    await this.assertAccountStable(accountId);
    return this.markSynced(accountId, snapshot.revision, remoteState ?? { revision: snapshot.revision });
  }

  private async applyCloudSnapshot(
    accountId: string,
    snapshot: SyncSnapshotEnvelope,
    remoteState?: SyncRemoteState | null,
  ): Promise<string> {
    await this.assertAccountStable(accountId);
    await applyCloudSyncSnapshot(snapshot.document);
    await this.assertAccountStable(accountId);
    return this.markSynced(accountId, snapshot.revision, remoteState ?? { revision: snapshot.revision });
  }

  private conflict(local: SyncSnapshotEnvelope, cloud: SyncSnapshotEnvelope): SyncConflict {
    return {
      localRevision: local.revision,
      cloudRevision: cloud.revision,
      localUpdatedAt: local.updatedAt,
      cloudUpdatedAt: cloud.updatedAt,
    };
  }

  private recoveryConflict(
    local: SyncSnapshotEnvelope,
    error: SyncPayloadHashMismatchError,
    differingStores: string[],
  ): SyncRecoveryConflict {
    return {
      kind: 'legacy-payload-hash-mismatch',
      localRevision: local.revision,
      cloudRevision: error.snapshot.revision,
      localUpdatedAt: local.updatedAt,
      cloudUpdatedAt: error.snapshot.updatedAt,
      expectedPayloadSha256: error.expectedPayloadSha256,
      actualPayloadSha256: error.actualPayloadSha256,
      differingStores,
    };
  }

  private async handleCloudIntegrityError(
    status: SyncStatus,
    accountId: string,
    local: SyncSnapshotEnvelope,
    error: SyncRevisionMismatchError | SyncPayloadHashMismatchError,
  ): Promise<SyncReconcileResult | null> {
    const [localFingerprint, cloudFingerprint] = await Promise.all([
      calculateSyncContentFingerprint(local.document.data),
      calculateSyncContentFingerprint(error.snapshot.document.data),
    ]);
    let equivalent = localFingerprint === cloudFingerprint;

    if (!equivalent && error instanceof SyncPayloadHashMismatchError) {
      const [localRecoveryFingerprint, cloudRecoveryFingerprint] = await Promise.all([
        calculateSyncRecoveryFingerprint(local.document.data),
        calculateSyncRecoveryFingerprint(error.snapshot.document.data),
      ]);
      equivalent = localRecoveryFingerprint === cloudRecoveryFingerprint;
      if (!equivalent) {
        const differences = listSyncRecoveryStoreDifferences(local.document.data, error.snapshot.document.data);
        return {
          phase: 'recovery-required',
          status,
          recovery: this.recoveryConflict(local, error, differences.length ? differences : ['nieznane']),
        };
      }
    }

    if (!equivalent) return null;
    try {
      const lastSyncAt = await this.pushSnapshot(accountId, local, error.snapshot.revision);
      return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
    } catch (repairError) {
      if (repairError instanceof SyncRemoteChangedError) return this.reconcile();
      throw repairError;
    }
  }

  private async reconcileUsingManifest(status: SyncStatus, accountId: string): Promise<SyncReconcileResult> {
    const previous = readLocalSyncState(this.provider.id, accountId);
    const localPromise = this.captureLocalSnapshot();
    const remoteStatePromise = this.provider.readRemoteState!();
    const [local, remoteState] = await Promise.all([localPromise, remoteStatePromise]);
    await this.assertAccountStable(accountId);

    if (!remoteState) {
      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, null);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) return this.reconcile();
        throw error;
      }
    }

    const remoteRevisionChanged = !previous || remoteState.revision !== previous.lastSyncedRevision;
    const remotePayloadChanged = Boolean(
      remoteState.payloadSha256
      && remoteState.payloadSha256 !== (previous?.lastRemotePayloadSha256 ?? ''),
    );
    const remoteChanged = remoteRevisionChanged || remotePayloadChanged;
    const localChanged = !previous || local.revision !== previous.lastSyncedRevision;

    // Normal polling path: one manifest read, no chunk downloads and no writes.
    if (previous && !remoteChanged && !localChanged) {
      const lastSyncAt = this.markSynced(accountId, local.revision, remoteState);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    // Only local data changed since the last common revision. Push directly without
    // downloading the unchanged cloud chunks.
    if (previous && localChanged && !remoteChanged) {
      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, previous.lastSyncedRevision);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) return this.reconcile();
        throw error;
      }
    }

    let cloud: SyncSnapshotEnvelope | null;
    try {
      cloud = await this.pullLatestSnapshot(accountId, remoteState);
    } catch (error) {
      if (error instanceof SyncRevisionMismatchError || error instanceof SyncPayloadHashMismatchError) {
        const recovery = await this.handleCloudIntegrityError(status, accountId, local, error);
        if (recovery) return recovery;
      }
      throw error;
    }
    if (!cloud) return this.reconcile();

    if (cloud.revision === local.revision) {
      const lastSyncAt = this.markSynced(accountId, local.revision, remoteState);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    if (!previous) {
      if (!hasMeaningfulDataTransferContent(local.document)) {
        const lastSyncAt = await this.applyCloudSnapshot(accountId, cloud, remoteState);
        return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
      }
      return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
    }

    const localChangedFromCommon = local.revision !== previous.lastSyncedRevision;
    const cloudChangedFromCommon = cloud.revision !== previous.lastSyncedRevision;

    if (!localChangedFromCommon && cloudChangedFromCommon) {
      const lastSyncAt = await this.applyCloudSnapshot(accountId, cloud, remoteState);
      return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
    }

    if (localChangedFromCommon && !cloudChangedFromCommon) {
      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, previous.lastSyncedRevision);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) return this.reconcile();
        throw error;
      }
    }

    if (!localChangedFromCommon && !cloudChangedFromCommon) {
      const lastSyncAt = this.markSynced(accountId, local.revision, remoteState);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
  }

  private async reconcileLegacyProvider(status: SyncStatus, accountId: string): Promise<SyncReconcileResult> {
    const localPromise = this.captureLocalSnapshot();
    let local: SyncSnapshotEnvelope;
    let cloud: SyncSnapshotEnvelope | null;
    try {
      [local, cloud] = await Promise.all([
        localPromise,
        this.pullLatestSnapshot(accountId),
      ]);
    } catch (error) {
      if (error instanceof SyncRevisionMismatchError || error instanceof SyncPayloadHashMismatchError) {
        local = await localPromise;
        const recovery = await this.handleCloudIntegrityError(status, accountId, local, error);
        if (recovery) return recovery;
      }
      throw error;
    }
    const previous = readLocalSyncState(this.provider.id, accountId);

    if (!cloud) {
      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, null);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) return this.reconcile();
        throw error;
      }
    }

    if (cloud.revision === local.revision) {
      const lastSyncAt = this.markSynced(accountId, local.revision);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    if (!previous) {
      if (!hasMeaningfulDataTransferContent(local.document)) {
        const lastSyncAt = await this.applyCloudSnapshot(accountId, cloud);
        return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
      }
      return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
    }

    const localChanged = local.revision !== previous.lastSyncedRevision;
    const cloudChanged = cloud.revision !== previous.lastSyncedRevision;

    if (!localChanged && cloudChanged) {
      const lastSyncAt = await this.applyCloudSnapshot(accountId, cloud);
      return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
    }

    if (localChanged && !cloudChanged) {
      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, previous.lastSyncedRevision);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (error) {
        if (error instanceof SyncRemoteChangedError) {
          const latestCloud = await this.pullLatestSnapshot(accountId);
          if (!latestCloud) return this.reconcile();
          return { phase: 'conflict', status, conflict: this.conflict(local, latestCloud) };
        }
        throw error;
      }
    }

    if (!localChanged && !cloudChanged) {
      const lastSyncAt = this.markSynced(accountId, local.revision);
      return { phase: 'synced', status, revision: local.revision, lastSyncAt };
    }

    return { phase: 'conflict', status, conflict: this.conflict(local, cloud) };
  }

  async reconcile(): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!this.provider.capabilities.cloud) return { phase: 'local-only', status };
    if (!status.account) return { phase: 'signed-out', status };

    const accountId = status.account.id;
    await this.prepareCloudOperation(accountId);
    if (this.provider.readRemoteState) return this.reconcileUsingManifest(status, accountId);
    return this.reconcileLegacyProvider(status, accountId);
  }

  async replaceDamagedCloudWithLocal(recovery: SyncRecoveryConflict): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!status.account) return { phase: 'signed-out', status };
    const accountId = status.account.id;
    await this.prepareCloudOperation(accountId);
    if (recovery.kind !== 'legacy-payload-hash-mismatch') return this.reconcile();

    const local = await this.captureLocalSnapshot();
    if (local.revision !== recovery.localRevision) return this.reconcile();

    try {
      const state = this.provider.readRemoteState ? await this.provider.readRemoteState() : null;
      await this.provider.pullLatest(state);
      await this.assertAccountStable(accountId);
      // The remote state is no longer the exact damaged legacy payload that the
      // user reviewed. Reconcile again instead of overwriting a changed cloud.
      return this.reconcile();
    } catch (error) {
      if (!(error instanceof SyncPayloadHashMismatchError)) throw error;
      const sameRemote = error.snapshot.revision === recovery.cloudRevision
        && error.expectedPayloadSha256 === recovery.expectedPayloadSha256
        && error.actualPayloadSha256 === recovery.actualPayloadSha256;
      if (!sameRemote) return this.reconcile();

      const differences = listSyncRecoveryStoreDifferences(local.document.data, error.snapshot.document.data);
      if (!differences.length) return this.reconcile();

      try {
        const lastSyncAt = await this.pushSnapshot(accountId, local, recovery.cloudRevision);
        return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
      } catch (pushError) {
        if (pushError instanceof SyncRemoteChangedError) return this.reconcile();
        throw pushError;
      }
    }
  }

  async resolveConflict(choice: SyncConflictChoice): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!status.account) return { phase: 'signed-out', status };
    const accountId = status.account.id;
    await this.prepareCloudOperation(accountId);

    if (choice === 'cloud') {
      const remoteState = this.provider.readRemoteState ? await this.provider.readRemoteState() : null;
      const cloud = await this.pullLatestSnapshot(accountId, remoteState);
      if (!cloud) return this.reconcile();
      const lastSyncAt = await this.applyCloudSnapshot(accountId, cloud, remoteState);
      return { phase: 'pulled', status, revision: cloud.revision, lastSyncAt };
    }

    const local = await this.captureLocalSnapshot();
    let expectedRevision: string | null = null;
    if (this.provider.readRemoteState) {
      const remoteState = await this.provider.readRemoteState();
      expectedRevision = remoteState?.revision ?? null;
    } else {
      const cloud = await this.pullLatestSnapshot(accountId);
      expectedRevision = cloud?.revision ?? null;
    }
    try {
      const lastSyncAt = await this.pushSnapshot(accountId, local, expectedRevision);
      return { phase: 'pushed', status, revision: local.revision, lastSyncAt };
    } catch (error) {
      if (error instanceof SyncRemoteChangedError) return this.reconcile();
      throw error;
    }
  }

  async switchToCurrentAccount(): Promise<SyncReconcileResult> {
    const status = await this.getStatus();
    if (!status.account) return { phase: 'signed-out', status };
    const accountId = status.account.id;
    await this.assertAccountStable(accountId);
    // Verify that the current account and cloud transport are reachable before the
    // destructive local reset. A failed/offline preflight must leave old local data intact.
    if (this.provider.readRemoteState) await this.provider.readRemoteState();
    else await this.provider.pullLatest();
    await this.assertAccountStable(accountId);
    await resetLocalDatabaseForAccountSwitch(accountId);
    clearLocalSyncState(this.provider.id, accountId);
    await this.assertAccountStable(accountId);
    return this.reconcile();
  }
}

export async function createSyncService(providerId = getPreferredSyncProviderId()): Promise<SyncService> {
  return new SyncService(await resolveSyncProvider(providerId));
}
