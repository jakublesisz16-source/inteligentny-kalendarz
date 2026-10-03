import { describe, expect, it } from 'vitest';
import type { SyncSnapshotEnvelope } from '../sync/sync.types';
import {
  decodeSnapshotChunks,
  encodeSnapshotChunks,
  FIRESTORE_SYNC_CHUNK_SOURCE_BYTES,
} from '../sync/providers/firebase-google-chunks';
import { readFileSync } from 'node:fs';

function largeSnapshot(): SyncSnapshotEnvelope {
  const repeated = 'Plan zajęć Żółć 🚆 '.repeat(40_000);
  return {
    format: 'inteligentny-kalendarz-sync-snapshot',
    version: 1,
    revision: 'a'.repeat(64),
    updatedAt: '2026-10-03T20:00:00.000Z',
    sourceDeviceId: 'device-test',
    document: {
      format: 'inteligentny-kalendarz-backup',
      backupVersion: 1,
      appVersion: '1.2.0.295',
      databaseSchemaVersion: 14,
      createdAt: '2026-10-03T20:00:00.000Z',
      checksum: 'test',
      data: {
        format: 'inteligentny-kalendarz-snapshot',
        snapshotVersion: 1,
        appVersion: '1.2.0.295',
        databaseSchemaVersion: 14,
        capturedAt: '2026-10-03T20:00:00.000Z',
        stores: { events: [{ id: 'large', title: repeated }] },
      },
    },
  };
}

describe('Build295 chunked Firestore sync', () => {
  it('splits a large UTF-8 snapshot and reconstructs it byte-exactly', async () => {
    const snapshot = largeSnapshot();
    const encoded = await encodeSnapshotChunks(snapshot);
    expect(encoded.payloadBytes).toBeGreaterThan(FIRESTORE_SYNC_CHUNK_SOURCE_BYTES);
    expect(encoded.chunks.length).toBeGreaterThan(1);
    expect(encoded.chunks.every((part) => part.length < 700_000)).toBe(true);
    const decoded = await decodeSnapshotChunks(
      snapshot.revision,
      encoded.payloadBytes,
      encoded.payloadSha256,
      encoded.chunks,
    );
    expect(decoded).toEqual(snapshot);
  });

  it('rejects missing or corrupted chunk data before applying it', async () => {
    const snapshot = largeSnapshot();
    const encoded = await encodeSnapshotChunks(snapshot);
    await expect(decodeSnapshotChunks(
      snapshot.revision,
      encoded.payloadBytes,
      encoded.payloadSha256,
      encoded.chunks.slice(0, -1),
    )).rejects.toThrow(/rozmiar|integralności|niekompletne/);
    const corrupted = [...encoded.chunks];
    corrupted[0] = `${corrupted[0]?.slice(0, -4)}AAAA`;
    await expect(decodeSnapshotChunks(
      snapshot.revision,
      encoded.payloadBytes,
      encoded.payloadSha256,
      corrupted,
    )).rejects.toThrow(/integralności|rozmiar/);
  });

  it('keeps the manifest atomic and stores versioned chunks below current', () => {
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    expect(provider).toContain("'users', uid, 'sync', 'current', 'chunks'");
    expect(provider).toContain("format: 'inteligentny-kalendarz-cloud-manifest'");
    expect(provider).toContain("format: 'inteligentny-kalendarz-cloud-chunk'");
    expect(provider).toContain('setDoc(syncChunkReference');
    expect(provider).toContain('runTransaction');
    expect(provider).toContain('payloadSha256');
    expect(provider).not.toContain('MAX_SYNC_PAYLOAD_BYTES = 850_000');
  });
});
