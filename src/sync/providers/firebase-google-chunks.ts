import { sha256Hex } from '../../core/sha256';
import { SyncPayloadHashMismatchError } from '../sync-errors';
import type { SyncSnapshotEnvelope } from '../sync.types';

export const FIRESTORE_SYNC_CHUNK_SOURCE_BYTES = 420_000;
export const FIRESTORE_SYNC_MAX_PAYLOAD_BYTES = 24_000_000;

export interface ChunkedSnapshotPayload {
  payloadBytes: number;
  payloadSha256: string;
  chunks: string[];
}

function bytesToBase64(bytes: Uint8Array): string {
  const blockSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + blockSize, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseSnapshotBytes(bytes: Uint8Array, revision: string): SyncSnapshotEnvelope {
  let parsed: Partial<SyncSnapshotEnvelope>;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SyncSnapshotEnvelope>;
  } catch {
    throw new Error('Snapshot w chmurze nie przeszedł kontroli integralności danych.');
  }
  if (
    parsed.format !== 'inteligentny-kalendarz-sync-snapshot'
    || parsed.version !== 1
    || parsed.revision !== revision
    || typeof parsed.updatedAt !== 'string'
    || typeof parsed.sourceDeviceId !== 'string'
    || !parsed.document
    || !parsed.document.data
  ) {
    throw new Error('Chmura zawiera uszkodzony snapshot synchronizacji.');
  }
  return parsed as SyncSnapshotEnvelope;
}

export async function encodeSnapshotChunks(snapshot: SyncSnapshotEnvelope): Promise<ChunkedSnapshotPayload> {
  const payloadBytesArray = new TextEncoder().encode(JSON.stringify(snapshot));
  if (payloadBytesArray.byteLength > FIRESTORE_SYNC_MAX_PAYLOAD_BYTES) {
    throw new Error('Dane aplikacji są zbyt duże dla Sync V1. Dane lokalne pozostały bez zmian.');
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < payloadBytesArray.byteLength; offset += FIRESTORE_SYNC_CHUNK_SOURCE_BYTES) {
    chunks.push(bytesToBase64(payloadBytesArray.subarray(offset, offset + FIRESTORE_SYNC_CHUNK_SOURCE_BYTES)));
  }
  if (!chunks.length) chunks.push('');
  return {
    payloadBytes: payloadBytesArray.byteLength,
    payloadSha256: await sha256Hex(payloadBytesArray),
    chunks,
  };
}

export async function decodeSnapshotChunks(
  revision: string,
  payloadBytes: number,
  payloadSha256: string,
  encodedChunks: readonly string[],
): Promise<SyncSnapshotEnvelope> {
  if (!Number.isInteger(payloadBytes) || payloadBytes < 0) throw new Error('Chmura zawiera nieprawidłowy rozmiar snapshotu.');
  if (!payloadSha256 || !encodedChunks.length) throw new Error('Chmura zawiera niekompletne dane synchronizacji.');

  const parts = encodedChunks.map(base64ToBytes);
  const actualBytes = parts.reduce((sum, part) => sum + part.byteLength, 0);
  if (actualBytes !== payloadBytes) throw new Error('Snapshot w chmurze ma nieprawidłowy rozmiar.');

  const joined = new Uint8Array(actualBytes);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }

  const actualPayloadSha256 = await sha256Hex(joined);
  if (actualPayloadSha256 !== payloadSha256) {
    const candidate = parseSnapshotBytes(joined, revision);
    throw new SyncPayloadHashMismatchError(candidate, payloadSha256, actualPayloadSha256);
  }

  return parseSnapshotBytes(joined, revision);
}
