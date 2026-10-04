import { FIREBASE_GOOGLE_SYNC_CONFIG } from './firebase-google-config';
import { SyncRemoteChangedError } from '../sync-errors';
import { FIREBASE_GOOGLE_SYNC_PROVIDER_ID } from '../provider-ids';
import type { SyncAccount, SyncProvider, SyncSnapshotEnvelope } from '../sync.types';
import {
  createSnapshotDecodeBuffer,
  decodeSnapshotChunkInto,
  encodePreparedSnapshotChunk,
  expectedSnapshotChunkCount,
  finalizeSnapshotDecodeBuffer,
  FIRESTORE_SYNC_IO_CONCURRENCY,
  FIRESTORE_SYNC_MAX_PAYLOAD_BYTES,
  prepareSnapshotPayload,
} from './firebase-google-chunks';

const FIREBASE_SDK_VERSION = '12.19.0';
const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

interface FirebaseAppModule {
  initializeApp(config: typeof FIREBASE_GOOGLE_SYNC_CONFIG): unknown;
}

interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface FirebaseAuthModule {
  getAuth(app: unknown): unknown;
  GoogleAuthProvider: new () => unknown;
  signInWithPopup(auth: unknown, provider: unknown): Promise<{ user: FirebaseAuthUser }>;
  signOut(auth: unknown): Promise<void>;
  onAuthStateChanged(
    auth: unknown,
    next: (user: FirebaseAuthUser | null) => void,
    error?: (error: unknown) => void,
  ): () => void;
}

interface FirestoreDocumentSnapshot {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

interface FirestoreTransaction {
  get(reference: unknown): Promise<FirestoreDocumentSnapshot>;
  set(reference: unknown, data: Record<string, unknown>): void;
}

interface FirebaseFirestoreModule {
  getFirestore(app: unknown): unknown;
  doc(db: unknown, ...pathSegments: string[]): unknown;
  getDoc(reference: unknown): Promise<FirestoreDocumentSnapshot>;
  setDoc(reference: unknown, data: Record<string, unknown>): Promise<void>;
  deleteDoc(reference: unknown): Promise<void>;
  runTransaction<T>(db: unknown, update: (transaction: FirestoreTransaction) => Promise<T>): Promise<T>;
  serverTimestamp(): unknown;
}

interface FirebaseRuntime {
  authModule: FirebaseAuthModule;
  firestoreModule: FirebaseFirestoreModule;
  auth: unknown;
  db: unknown;
}

interface LegacyCloudSnapshotDocument {
  format: 'inteligentny-kalendarz-cloud-snapshot';
  version: 1;
  revision: string;
  clientUpdatedAt: string;
  sourceDeviceId: string;
  payloadJson: string;
  payloadBytes: number;
  appVersion: string;
  databaseSchemaVersion: number;
}

interface LegacyChunkedCloudManifestDocument {
  format: 'inteligentny-kalendarz-cloud-manifest';
  version: 2;
  storage: 'chunks-v1';
  revision: string;
  clientUpdatedAt: string;
  sourceDeviceId: string;
  payloadBytes: number;
  payloadSha256: string;
  chunkCount: number;
  appVersion: string;
  databaseSchemaVersion: number;
  previousRevision?: string;
  previousChunkCount?: number;
}

interface ChunkedCloudManifestDocument {
  format: 'inteligentny-kalendarz-cloud-manifest';
  version: 3;
  storage: 'chunks-v2';
  revision: string;
  chunkSetId: string;
  clientUpdatedAt: string;
  sourceDeviceId: string;
  payloadBytes: number;
  payloadSha256: string;
  chunkCount: number;
  appVersion: string;
  databaseSchemaVersion: number;
}

type ParsedChunkedManifestDocument = LegacyChunkedCloudManifestDocument | ChunkedCloudManifestDocument;

interface LegacyCloudChunkDocument {
  format: 'inteligentny-kalendarz-cloud-chunk';
  version: 1;
  revision: string;
  index: number;
  chunkCount: number;
  encoding: 'base64-utf8';
  payloadPart: string;
}

interface CloudChunkDocument {
  format: 'inteligentny-kalendarz-cloud-chunk';
  version: 2;
  revision: string;
  chunkSetId: string;
  index: number;
  chunkCount: number;
  encoding: 'base64-utf8';
  payloadPart: string;
}

interface CloudSnapshotCacheEntry {
  revision: string;
  payloadSha256: string;
  snapshotRef?: WeakRef<SyncSnapshotEnvelope>;
}

interface ChunkSetCleanup {
  chunkSetId: string;
  chunkCount: number;
}

let runtimePromise: Promise<FirebaseRuntime> | null = null;
const cloudSnapshotCache = new Map<string, CloudSnapshotCacheEntry>();
const CHUNK_CLEANUP_QUEUE_LIMIT = 24;
const CHUNK_CLEANUP_KEY_PREFIX = 'ik.sync.chunk-cleanup.v1.';


function cleanupStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function cleanupQueueKey(uid: string): string {
  return `${CHUNK_CLEANUP_KEY_PREFIX}${uid}`;
}

function readPendingChunkCleanup(uid: string): ChunkSetCleanup[] {
  const storage = cleanupStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(cleanupQueueKey(uid)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((item): item is ChunkSetCleanup => Boolean(
      item && typeof item === 'object'
      && typeof (item as ChunkSetCleanup).chunkSetId === 'string'
      && Number.isInteger((item as ChunkSetCleanup).chunkCount)
      && (item as ChunkSetCleanup).chunkCount > 0,
    ));
    return valid.slice(-CHUNK_CLEANUP_QUEUE_LIMIT);
  } catch {
    return [];
  }
}

function writePendingChunkCleanup(uid: string, items: readonly ChunkSetCleanup[]): void {
  const storage = cleanupStorage();
  if (!storage) return;
  try {
    const unique = [...new Map(items.map((item) => [item.chunkSetId, item])).values()].slice(-CHUNK_CLEANUP_QUEUE_LIMIT);
    if (unique.length) storage.setItem(cleanupQueueKey(uid), JSON.stringify(unique));
    else storage.removeItem(cleanupQueueKey(uid));
  } catch {
    // Cleanup metadata is best-effort and must never block sync/local work.
  }
}

function rememberPendingChunkCleanup(uid: string, item: ChunkSetCleanup): void {
  writePendingChunkCleanup(uid, [...readPendingChunkCleanup(uid), item]);
}

function weakSnapshotRef(snapshot: SyncSnapshotEnvelope): WeakRef<SyncSnapshotEnvelope> | undefined {
  return typeof WeakRef === 'function' ? new WeakRef(snapshot) : undefined;
}

function chunkBatchIndexes(chunkCount: number): number[][] {
  const batches: number[][] = [];
  for (let start = 0; start < chunkCount; start += FIRESTORE_SYNC_IO_CONCURRENCY) {
    const batch: number[] = [];
    for (let index = start; index < Math.min(start + FIRESTORE_SYNC_IO_CONCURRENCY, chunkCount); index += 1) batch.push(index);
    batches.push(batch);
  }
  return batches;
}

async function importFirebaseModule<T>(filename: string): Promise<T> {
  const url = `${FIREBASE_CDN}/${filename}`;
  return import(/* @vite-ignore */ url) as Promise<T>;
}

async function createRuntime(): Promise<FirebaseRuntime> {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    importFirebaseModule<FirebaseAppModule>('firebase-app.js'),
    importFirebaseModule<FirebaseAuthModule>('firebase-auth.js'),
    importFirebaseModule<FirebaseFirestoreModule>('firebase-firestore.js'),
  ]);
  const app = appModule.initializeApp(FIREBASE_GOOGLE_SYNC_CONFIG);
  return {
    authModule,
    firestoreModule,
    auth: authModule.getAuth(app),
    db: firestoreModule.getFirestore(app),
  };
}

function getRuntime(): Promise<FirebaseRuntime> {
  runtimePromise ??= createRuntime();
  return runtimePromise;
}

function normalizeAccount(user: FirebaseAuthUser): SyncAccount {
  return {
    id: user.uid,
    ...(user.email ? { email: user.email } : {}),
    ...(user.displayName ? { displayName: user.displayName } : {}),
    ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
  };
}

async function currentUser(runtime: FirebaseRuntime): Promise<FirebaseAuthUser | null> {
  return new Promise((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    unsubscribe = runtime.authModule.onAuthStateChanged(
      runtime.auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
}

async function requireUser(runtime: FirebaseRuntime): Promise<FirebaseAuthUser> {
  const user = await currentUser(runtime);
  if (!user) throw new Error('Zaloguj się przez Google, aby synchronizować dane.');
  return user;
}

function syncDocumentReference(runtime: FirebaseRuntime, uid: string): unknown {
  return runtime.firestoreModule.doc(runtime.db, 'users', uid, 'sync', 'current');
}

function syncChunkReference(runtime: FirebaseRuntime, uid: string, chunkSetId: string, index: number): unknown {
  return runtime.firestoreModule.doc(
    runtime.db,
    'users', uid, 'sync', 'current', 'chunks', `${chunkSetId}-${String(index).padStart(4, '0')}`,
  );
}

function decodeLegacyCloudSnapshot(data: Record<string, unknown>): SyncSnapshotEnvelope {
  if (typeof data.payloadJson !== 'string' || typeof data.revision !== 'string') {
    throw new Error('Chmura zawiera niekompletne dane synchronizacji.');
  }
  const parsed = JSON.parse(data.payloadJson) as Partial<SyncSnapshotEnvelope>;
  if (
    parsed.format !== 'inteligentny-kalendarz-sync-snapshot'
    || parsed.version !== 1
    || parsed.revision !== data.revision
    || typeof parsed.updatedAt !== 'string'
    || typeof parsed.sourceDeviceId !== 'string'
    || !parsed.document
  ) {
    throw new Error('Chmura zawiera uszkodzony snapshot synchronizacji.');
  }
  return parsed as SyncSnapshotEnvelope;
}

function parseChunkedManifest(data: Record<string, unknown>): ParsedChunkedManifestDocument {
  const commonValid = data.format === 'inteligentny-kalendarz-cloud-manifest'
    && typeof data.revision === 'string'
    && typeof data.payloadSha256 === 'string'
    && typeof data.payloadBytes === 'number'
    && typeof data.chunkCount === 'number'
    && Number.isInteger(data.chunkCount)
    && data.chunkCount >= 1;
  if (!commonValid) throw new Error('Chmura zawiera nieobsługiwany format danych synchronizacji.');

  if (data.version === 2 && data.storage === 'chunks-v1') {
    return data as unknown as LegacyChunkedCloudManifestDocument;
  }
  if (data.version === 3 && data.storage === 'chunks-v2' && typeof data.chunkSetId === 'string' && data.chunkSetId.length > 0) {
    return data as unknown as ChunkedCloudManifestDocument;
  }
  throw new Error('Chmura zawiera nieobsługiwany format danych synchronizacji.');
}

function manifestChunkSetId(manifest: ParsedChunkedManifestDocument): string {
  return manifest.version === 3 ? manifest.chunkSetId : manifest.revision;
}

function parseChunkDocument(
  data: Record<string, unknown> | undefined,
  manifest: ParsedChunkedManifestDocument,
  index: number,
): string {
  if (!data) throw new Error('Chmura zawiera niekompletny fragment synchronizacji.');
  const commonValid = data.format === 'inteligentny-kalendarz-cloud-chunk'
    && data.revision === manifest.revision
    && data.index === index
    && data.chunkCount === manifest.chunkCount
    && data.encoding === 'base64-utf8'
    && typeof data.payloadPart === 'string';
  if (!commonValid) throw new Error('Chmura zawiera niekompletny fragment synchronizacji.');

  if (manifest.version === 2 && data.version === 1) {
    return (data as unknown as LegacyCloudChunkDocument).payloadPart;
  }
  if (
    manifest.version === 3
    && data.version === 2
    && data.chunkSetId === manifest.chunkSetId
  ) {
    return (data as unknown as CloudChunkDocument).payloadPart;
  }
  throw new Error('Chmura zawiera niekompletny fragment synchronizacji.');
}

async function deleteChunkSet(
  runtime: FirebaseRuntime,
  uid: string,
  chunkSetId: string,
  chunkCount: number,
): Promise<boolean> {
  let complete = true;
  for (const batch of chunkBatchIndexes(chunkCount)) {
    const results = await Promise.allSettled(batch.map((index) => (
      runtime.firestoreModule.deleteDoc(syncChunkReference(runtime, uid, chunkSetId, index))
    )));
    if (results.some((result) => result.status === 'rejected')) complete = false;
  }
  return complete;
}

async function deleteChunkSetIfUnreferenced(
  runtime: FirebaseRuntime,
  uid: string,
  chunkSetId: string,
  chunkCount: number,
): Promise<boolean> {
  try {
    const current = await runtime.firestoreModule.getDoc(syncDocumentReference(runtime, uid));
    const currentData = current.data();
    if (
      current.exists()
      && currentData?.format === 'inteligentny-kalendarz-cloud-manifest'
      && currentData.version === 3
      && currentData.storage === 'chunks-v2'
      && currentData.chunkSetId === chunkSetId
    ) return true;
    return deleteChunkSet(runtime, uid, chunkSetId, chunkCount);
  } catch {
    // Cleanup is best-effort. Never turn a transport error into local-data loss.
    return false;
  }
}

async function retryPendingChunkCleanup(runtime: FirebaseRuntime, uid: string): Promise<void> {
  const pending = readPendingChunkCleanup(uid);
  if (!pending.length) return;
  try {
    const current = await runtime.firestoreModule.getDoc(syncDocumentReference(runtime, uid));
    const currentData = current.data();
    const activeChunkSetId = current.exists()
      && currentData?.format === 'inteligentny-kalendarz-cloud-manifest'
      && currentData.version === 3
      && currentData.storage === 'chunks-v2'
      && typeof currentData.chunkSetId === 'string'
      ? currentData.chunkSetId
      : null;
    const remaining: ChunkSetCleanup[] = [];
    for (const item of pending) {
      if (item.chunkSetId === activeChunkSetId) continue;
      if (!(await deleteChunkSet(runtime, uid, item.chunkSetId, item.chunkCount))) remaining.push(item);
    }
    writePendingChunkCleanup(uid, remaining);
  } catch {
    // Keep the bounded queue for the next successful sync attempt.
  }
}

export function createFirebaseGoogleSyncProvider(): SyncProvider {
  return {
    id: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => Boolean(
      FIREBASE_GOOGLE_SYNC_CONFIG.apiKey
      && FIREBASE_GOOGLE_SYNC_CONFIG.authDomain
      && FIREBASE_GOOGLE_SYNC_CONFIG.projectId
      && FIREBASE_GOOGLE_SYNC_CONFIG.appId
    ),
    async getAccount() {
      const runtime = await getRuntime();
      const user = await currentUser(runtime);
      return user ? normalizeAccount(user) : null;
    },
    async signIn() {
      const runtime = await getRuntime();
      const provider = new runtime.authModule.GoogleAuthProvider();
      const result = await runtime.authModule.signInWithPopup(runtime.auth, provider);
      return normalizeAccount(result.user);
    },
    async signOut() {
      const runtime = await getRuntime();
      cloudSnapshotCache.clear();
      await runtime.authModule.signOut(runtime.auth);
    },
    async pullLatest() {
      const runtime = await getRuntime();
      const user = await requireUser(runtime);
      await retryPendingChunkCleanup(runtime, user.uid);
      const manifestSnapshot = await runtime.firestoreModule.getDoc(syncDocumentReference(runtime, user.uid));
      if (!manifestSnapshot.exists()) return null;
      const data = manifestSnapshot.data();
      if (!data) return null;
      if (data.format === 'inteligentny-kalendarz-cloud-snapshot' && data.version === 1) {
        const legacy = decodeLegacyCloudSnapshot(data);
        cloudSnapshotCache.delete(user.uid);
        return legacy;
      }

      const manifest = parseChunkedManifest(data);
      if (manifest.payloadBytes > FIRESTORE_SYNC_MAX_PAYLOAD_BYTES) {
        throw new Error('Snapshot w chmurze przekracza bezpieczny limit 24 MB. Pobieranie zatrzymano, aby nie ryzykować brakiem pamięci.');
      }
      if (manifest.chunkCount !== expectedSnapshotChunkCount(manifest.payloadBytes)) {
        throw new Error('Chmura zawiera niekompletne dane synchronizacji: nieprawidłowa liczba fragmentów.');
      }
      const cached = cloudSnapshotCache.get(user.uid);
      const cachedSnapshot = cached?.snapshotRef?.deref();
      if (
        cached
        && cachedSnapshot
        && cached.revision === manifest.revision
        && cached.payloadSha256 === manifest.payloadSha256
      ) return cachedSnapshot;

      const chunkSetId = manifestChunkSetId(manifest);
      const payloadBuffer = createSnapshotDecodeBuffer(manifest.payloadBytes);
      for (const batch of chunkBatchIndexes(manifest.chunkCount)) {
        const chunkSnapshots = await Promise.all(batch.map((index) => (
          runtime.firestoreModule.getDoc(syncChunkReference(runtime, user.uid, chunkSetId, index))
        )));
        chunkSnapshots.forEach((chunkSnapshot, batchIndex) => {
          const index = batch[batchIndex]!;
          if (!chunkSnapshot.exists()) throw new Error('Chmura zawiera brakujący fragment synchronizacji.');
          decodeSnapshotChunkInto(payloadBuffer, index, parseChunkDocument(chunkSnapshot.data(), manifest, index));
        });
      }
      const decoded = await finalizeSnapshotDecodeBuffer(manifest.revision, manifest.payloadSha256, payloadBuffer);
      const snapshotRef = weakSnapshotRef(decoded);
      cloudSnapshotCache.set(user.uid, {
        revision: manifest.revision,
        payloadSha256: manifest.payloadSha256,
        ...(snapshotRef ? { snapshotRef } : {}),
      });
      return decoded;
    },
    async pushSnapshot(snapshot, expectedRevision = undefined) {
      const runtime = await getRuntime();
      const user = await requireUser(runtime);
      await retryPendingChunkCleanup(runtime, user.uid);
      const reference = syncDocumentReference(runtime, user.uid);
      const encoded = await prepareSnapshotPayload(snapshot);
      const chunkCount = encoded.chunkCount;
      const chunkSetId = encoded.payloadSha256;

      if (encoded.nearLimit) {
        console.warn(`[sync] Snapshot uses ${encoded.payloadBytes} bytes of the ${FIRESTORE_SYNC_MAX_PAYLOAD_BYTES} byte safety budget.`);
      }

      let manifestSwitched = false;
      try {
        for (const batch of chunkBatchIndexes(chunkCount)) {
          await Promise.all(batch.map((index) => (
            runtime.firestoreModule.setDoc(syncChunkReference(runtime, user.uid, chunkSetId, index), {
              format: 'inteligentny-kalendarz-cloud-chunk',
              version: 2,
              revision: snapshot.revision,
              chunkSetId,
              index,
              chunkCount,
              encoding: 'base64-utf8',
              payloadPart: encodePreparedSnapshotChunk(encoded, index),
            })
          )));
        }

        const staleChunkSets = await runtime.firestoreModule.runTransaction<ChunkSetCleanup[]>(
          runtime.db,
          async (transaction) => {
            const current = await transaction.get(reference);
            const currentData = current.data();
            const currentRevision = current.exists() && typeof currentData?.revision === 'string'
              ? String(currentData.revision)
              : null;
            if (expectedRevision !== undefined && currentRevision !== expectedRevision) {
              throw new SyncRemoteChangedError(currentRevision);
            }

            const stale: ChunkSetCleanup[] = [];
            if (
              current.exists()
              && currentData?.format === 'inteligentny-kalendarz-cloud-manifest'
              && typeof currentData.chunkCount === 'number'
              && Number.isInteger(currentData.chunkCount)
              && currentData.chunkCount > 0
            ) {
              if (
                currentData.version === 3
                && currentData.storage === 'chunks-v2'
                && typeof currentData.chunkSetId === 'string'
                && currentData.chunkSetId !== chunkSetId
              ) {
                stale.push({ chunkSetId: currentData.chunkSetId, chunkCount: currentData.chunkCount });
              } else if (
                currentData.version === 2
                && currentData.storage === 'chunks-v1'
                && typeof currentData.revision === 'string'
                && currentData.revision !== chunkSetId
              ) {
                stale.push({ chunkSetId: currentData.revision, chunkCount: currentData.chunkCount });
                if (
                  typeof currentData.previousRevision === 'string'
                  && typeof currentData.previousChunkCount === 'number'
                  && Number.isInteger(currentData.previousChunkCount)
                  && currentData.previousChunkCount > 0
                  && currentData.previousRevision !== chunkSetId
                  && currentData.previousRevision !== currentData.revision
                ) {
                  stale.push({ chunkSetId: currentData.previousRevision, chunkCount: currentData.previousChunkCount });
                }
              }
            }

            transaction.set(reference, {
              format: 'inteligentny-kalendarz-cloud-manifest',
              version: 3,
              storage: 'chunks-v2',
              revision: snapshot.revision,
              chunkSetId,
              clientUpdatedAt: snapshot.updatedAt,
              sourceDeviceId: snapshot.sourceDeviceId,
              payloadBytes: encoded.payloadBytes,
              payloadSha256: encoded.payloadSha256,
              chunkCount,
              appVersion: snapshot.document.appVersion,
              databaseSchemaVersion: snapshot.document.databaseSchemaVersion,
              serverUpdatedAt: runtime.firestoreModule.serverTimestamp(),
            });
            return stale;
          },
        );
        manifestSwitched = true;

        const snapshotRef = weakSnapshotRef(snapshot);
        cloudSnapshotCache.set(user.uid, {
          revision: snapshot.revision,
          payloadSha256: encoded.payloadSha256,
          ...(snapshotRef ? { snapshotRef } : {}),
        });
        // Defer deletion of the previously active generation until the next sync
        // attempt. This keeps one rollback/read buffer and avoids deleting a set
        // that another device may be concurrently switching back to. The retry
        // path re-reads the manifest before any deletion.
        for (const stale of staleChunkSets) rememberPendingChunkCleanup(user.uid, stale);
      } catch (error) {
        if (!manifestSwitched) {
          const cleanup = { chunkSetId, chunkCount };
          if (!(await deleteChunkSetIfUnreferenced(runtime, user.uid, chunkSetId, chunkCount))) rememberPendingChunkCleanup(user.uid, cleanup);
        }
        throw error;
      }
    },

  };
}
