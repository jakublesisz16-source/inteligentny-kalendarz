import { sha256Hex } from '../../core/sha256';
import { SyncPayloadHashMismatchError } from '../sync-errors';
import type { SyncSnapshotEnvelope } from '../sync.types';

export const FIRESTORE_SYNC_CHUNK_SOURCE_BYTES = 420_000;
export const FIRESTORE_SYNC_MAX_PAYLOAD_BYTES = 24_000_000;
export const FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES = 18_000_000;
export const FIRESTORE_SYNC_IO_CONCURRENCY = 3;

export interface PreparedSnapshotPayload {
  payloadBytes: number;
  payloadSha256: string;
  chunkCount: number;
  bytes: Uint8Array;
  nearLimit: boolean;
}

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

export function expectedSnapshotChunkCount(payloadBytes: number): number {
  if (!Number.isInteger(payloadBytes) || payloadBytes < 0) throw new Error('Chmura zawiera nieprawidłowy rozmiar snapshotu.');
  return Math.max(1, Math.ceil(payloadBytes / FIRESTORE_SYNC_CHUNK_SOURCE_BYTES));
}

export async function prepareSnapshotPayload(snapshot: SyncSnapshotEnvelope): Promise<PreparedSnapshotPayload> {
  // Encode directly so the large UTF-16 JSON string can become collectible as soon
  // as TextEncoder finishes instead of being retained beside the byte buffer.
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  if (bytes.byteLength > FIRESTORE_SYNC_MAX_PAYLOAD_BYTES) {
    throw new Error('Dane synchronizacji przekroczyły bezpieczny limit 24 MB. Wysyłanie zostało zatrzymane, aby nie ryzykować brakiem pamięci. Dane lokalne pozostały bez zmian.');
  }
  return {
    payloadBytes: bytes.byteLength,
    payloadSha256: await sha256Hex(bytes),
    chunkCount: expectedSnapshotChunkCount(bytes.byteLength),
    bytes,
    nearLimit: bytes.byteLength >= FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES,
  };
}

export function encodePreparedSnapshotChunk(payload: PreparedSnapshotPayload, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= payload.chunkCount) throw new Error('Nieprawidłowy indeks fragmentu synchronizacji.');
  const start = index * FIRESTORE_SYNC_CHUNK_SOURCE_BYTES;
  const end = Math.min(start + FIRESTORE_SYNC_CHUNK_SOURCE_BYTES, payload.payloadBytes);
  return bytesToBase64(payload.bytes.subarray(start, end));
}

export function createSnapshotDecodeBuffer(payloadBytes: number): Uint8Array {
  if (!Number.isInteger(payloadBytes) || payloadBytes < 0 || payloadBytes > FIRESTORE_SYNC_MAX_PAYLOAD_BYTES) {
    throw new Error('Chmura zawiera nieprawidłowy rozmiar snapshotu.');
  }
  return new Uint8Array(payloadBytes);
}

export function decodeSnapshotChunkInto(target: Uint8Array, index: number, encodedChunk: string): void {
  const start = index * FIRESTORE_SYNC_CHUNK_SOURCE_BYTES;
  if (start > target.byteLength) throw new Error('Chmura zawiera fragment poza zakresem snapshotu.');
  const expectedBytes = Math.min(FIRESTORE_SYNC_CHUNK_SOURCE_BYTES, Math.max(0, target.byteLength - start));
  const bytes = base64ToBytes(encodedChunk);
  if (bytes.byteLength !== expectedBytes) throw new Error('Snapshot w chmurze ma nieprawidłowy rozmiar fragmentu.');
  target.set(bytes, start);
}

export async function finalizeSnapshotDecodeBuffer(
  revision: string,
  payloadSha256: string,
  payloadBytes: Uint8Array,
): Promise<SyncSnapshotEnvelope> {
  if (!payloadSha256) throw new Error('Chmura zawiera niekompletne dane synchronizacji.');
  const actualPayloadSha256 = await sha256Hex(payloadBytes);
  if (actualPayloadSha256 !== payloadSha256) {
    const candidate = parseSnapshotBytes(payloadBytes, revision);
    throw new SyncPayloadHashMismatchError(candidate, payloadSha256, actualPayloadSha256);
  }
  return parseSnapshotBytes(payloadBytes, revision);
}

// Backward-compatible pure helper used by regression tests. Production upload uses
// prepareSnapshotPayload + on-demand chunk encoding so base64 copies are not all
// retained in memory at once.
export async function encodeSnapshotChunks(snapshot: SyncSnapshotEnvelope): Promise<ChunkedSnapshotPayload> {
  const prepared = await prepareSnapshotPayload(snapshot);
  const chunks: string[] = [];
  for (let index = 0; index < prepared.chunkCount; index += 1) chunks.push(encodePreparedSnapshotChunk(prepared, index));
  return {
    payloadBytes: prepared.payloadBytes,
    payloadSha256: prepared.payloadSha256,
    chunks,
  };
}

// Backward-compatible pure helper used by regression tests. It now fills one
// preallocated buffer instead of keeping a second array of decoded chunk buffers.
export async function decodeSnapshotChunks(
  revision: string,
  payloadBytes: number,
  payloadSha256: string,
  encodedChunks: readonly string[],
): Promise<SyncSnapshotEnvelope> {
  if (!payloadSha256 || !encodedChunks.length) throw new Error('Chmura zawiera niekompletne dane synchronizacji.');
  const expectedCount = expectedSnapshotChunkCount(payloadBytes);
  if (encodedChunks.length !== expectedCount) throw new Error('Chmura zawiera niekompletne dane synchronizacji: nieprawidłowa liczba fragmentów.');
  const joined = createSnapshotDecodeBuffer(payloadBytes);
  encodedChunks.forEach((chunk, index) => decodeSnapshotChunkInto(joined, index, chunk));
  return finalizeSnapshotDecodeBuffer(revision, payloadSha256, joined);
}
