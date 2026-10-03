import { createCanonicalDataTransferDocument } from '../storage/database';
import { getPreferredSyncProviderId } from './sync-config';
import { resolveSyncProvider } from './provider-registry';
import type { SyncProvider, SyncSnapshotEnvelope, SyncStatus } from './sync.types';

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `device-${Date.now()}`;
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

  async captureLocalSnapshot(sourceDeviceId = createDeviceId()): Promise<SyncSnapshotEnvelope> {
    const document = await createCanonicalDataTransferDocument();
    return {
      format: 'inteligentny-kalendarz-sync-snapshot',
      version: 1,
      revision: document.checksum,
      updatedAt: document.createdAt,
      sourceDeviceId,
      document,
    };
  }

  async pushCurrentSnapshot(sourceDeviceId?: string): Promise<SyncSnapshotEnvelope | null> {
    if (!this.provider.capabilities.cloud || !this.provider.isConfigured()) return null;
    const account = await this.provider.getAccount();
    if (!account) return null;
    const snapshot = await this.captureLocalSnapshot(sourceDeviceId);
    await this.provider.pushSnapshot(snapshot);
    return snapshot;
  }

  async pullLatestSnapshot(): Promise<SyncSnapshotEnvelope | null> {
    if (!this.provider.capabilities.cloud || !this.provider.isConfigured()) return null;
    const account = await this.provider.getAccount();
    if (!account) return null;
    return this.provider.pullLatest();
  }
}

export async function createSyncService(providerId = getPreferredSyncProviderId()): Promise<SyncService> {
  return new SyncService(await resolveSyncProvider(providerId));
}
