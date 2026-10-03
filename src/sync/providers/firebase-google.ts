import { FIREBASE_GOOGLE_SYNC_CONFIG } from './firebase-google-config';
import { SyncRemoteChangedError } from '../sync-errors';
import { FIREBASE_GOOGLE_SYNC_PROVIDER_ID } from '../provider-ids';
import type { SyncAccount, SyncProvider, SyncSnapshotEnvelope } from '../sync.types';
import { decodeSnapshotChunks, encodeSnapshotChunks } from './firebase-google-chunks';

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

interface ChunkedCloudManifestDocument {
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

interface CloudChunkDocument {
  format: 'inteligentny-kalendarz-cloud-chunk';
  version: 1;
  revision: string;
  index: number;
  chunkCount: number;
  encoding: 'base64-utf8';
  payloadPart: string;
}

let runtimePromise: Promise<FirebaseRuntime> | null = null;
const cloudSnapshotCache = new Map<string, SyncSnapshotEnvelope>();

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

function syncChunkReference(runtime: FirebaseRuntime, uid: string, revision: string, index: number): unknown {
  return runtime.firestoreModule.doc(
    runtime.db,
    'users', uid, 'sync', 'current', 'chunks', `${revision}-${String(index).padStart(4, '0')}`,
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

function parseChunkedManifest(data: Record<string, unknown>): ChunkedCloudManifestDocument {
  if (
    data.format !== 'inteligentny-kalendarz-cloud-manifest'
    || data.version !== 2
    || data.storage !== 'chunks-v1'
    || typeof data.revision !== 'string'
    || typeof data.payloadSha256 !== 'string'
    || typeof data.payloadBytes !== 'number'
    || typeof data.chunkCount !== 'number'
    || !Number.isInteger(data.chunkCount)
    || data.chunkCount < 1
  ) {
    throw new Error('Chmura zawiera nieobsługiwany format danych synchronizacji.');
  }
  return data as unknown as ChunkedCloudManifestDocument;
}

function parseChunkDocument(
  data: Record<string, unknown> | undefined,
  revision: string,
  index: number,
  chunkCount: number,
): CloudChunkDocument {
  if (
    !data
    || data.format !== 'inteligentny-kalendarz-cloud-chunk'
    || data.version !== 1
    || data.revision !== revision
    || data.index !== index
    || data.chunkCount !== chunkCount
    || data.encoding !== 'base64-utf8'
    || typeof data.payloadPart !== 'string'
  ) {
    throw new Error('Chmura zawiera niekompletny fragment synchronizacji.');
  }
  return data as unknown as CloudChunkDocument;
}

async function deleteChunkSet(
  runtime: FirebaseRuntime,
  uid: string,
  revision: string,
  chunkCount: number,
): Promise<void> {
  const deletes: Promise<void>[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    deletes.push(runtime.firestoreModule.deleteDoc(syncChunkReference(runtime, uid, revision, index)));
  }
  await Promise.allSettled(deletes);
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
      const manifestSnapshot = await runtime.firestoreModule.getDoc(syncDocumentReference(runtime, user.uid));
      if (!manifestSnapshot.exists()) return null;
      const data = manifestSnapshot.data();
      if (!data) return null;
      if (data.format === 'inteligentny-kalendarz-cloud-snapshot' && data.version === 1) {
        const legacy = decodeLegacyCloudSnapshot(data);
        cloudSnapshotCache.set(user.uid, legacy);
        return legacy;
      }

      const manifest = parseChunkedManifest(data);
      const cached = cloudSnapshotCache.get(user.uid);
      if (cached?.revision === manifest.revision) return cached;
      const chunkSnapshots = await Promise.all(
        Array.from({ length: manifest.chunkCount }, (_, index) => (
          runtime.firestoreModule.getDoc(syncChunkReference(runtime, user.uid, manifest.revision, index))
        )),
      );
      const chunks = chunkSnapshots.map((chunkSnapshot, index) => {
        if (!chunkSnapshot.exists()) throw new Error('Chmura zawiera brakujący fragment synchronizacji.');
        return parseChunkDocument(chunkSnapshot.data(), manifest.revision, index, manifest.chunkCount).payloadPart;
      });
      const decoded = await decodeSnapshotChunks(manifest.revision, manifest.payloadBytes, manifest.payloadSha256, chunks);
      cloudSnapshotCache.set(user.uid, decoded);
      return decoded;
    },
    async pushSnapshot(snapshot, expectedRevision = undefined) {
      const runtime = await getRuntime();
      const user = await requireUser(runtime);
      const reference = syncDocumentReference(runtime, user.uid);
      const encoded = await encodeSnapshotChunks(snapshot);
      const chunkCount = encoded.chunks.length;

      await Promise.all(encoded.chunks.map((payloadPart, index) => (
        runtime.firestoreModule.setDoc(syncChunkReference(runtime, user.uid, snapshot.revision, index), {
          format: 'inteligentny-kalendarz-cloud-chunk',
          version: 1,
          revision: snapshot.revision,
          index,
          chunkCount,
          encoding: 'base64-utf8',
          payloadPart,
        })
      )));

      const staleChunked = await runtime.firestoreModule.runTransaction<{ revision: string; chunkCount: number } | null>(
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

          let previousRevision: string | undefined;
          let previousChunkCount: number | undefined;
          let stale: { revision: string; chunkCount: number } | null = null;
          if (
            current.exists()
            && currentData?.format === 'inteligentny-kalendarz-cloud-manifest'
            && currentData.version === 2
            && typeof currentData.revision === 'string'
            && typeof currentData.chunkCount === 'number'
            && Number.isInteger(currentData.chunkCount)
            && currentData.chunkCount > 0
          ) {
            if (currentData.revision === snapshot.revision) {
              if (
                typeof currentData.previousRevision === 'string'
                && typeof currentData.previousChunkCount === 'number'
                && Number.isInteger(currentData.previousChunkCount)
                && currentData.previousChunkCount > 0
              ) {
                previousRevision = currentData.previousRevision;
                previousChunkCount = currentData.previousChunkCount;
              }
            } else {
              previousRevision = currentData.revision;
              previousChunkCount = currentData.chunkCount;
              if (
                typeof currentData.previousRevision === 'string'
                && typeof currentData.previousChunkCount === 'number'
                && Number.isInteger(currentData.previousChunkCount)
                && currentData.previousChunkCount > 0
                && currentData.previousRevision !== snapshot.revision
              ) {
                stale = {
                  revision: currentData.previousRevision,
                  chunkCount: currentData.previousChunkCount,
                };
              }
            }
          }

          transaction.set(reference, {
            format: 'inteligentny-kalendarz-cloud-manifest',
            version: 2,
            storage: 'chunks-v1',
            revision: snapshot.revision,
            clientUpdatedAt: snapshot.updatedAt,
            sourceDeviceId: snapshot.sourceDeviceId,
            payloadBytes: encoded.payloadBytes,
            payloadSha256: encoded.payloadSha256,
            chunkCount,
            appVersion: snapshot.document.appVersion,
            databaseSchemaVersion: snapshot.document.databaseSchemaVersion,
            ...(previousRevision && previousChunkCount ? { previousRevision, previousChunkCount } : {}),
            serverUpdatedAt: runtime.firestoreModule.serverTimestamp(),
          });
          return stale;
        },
      );

      cloudSnapshotCache.set(user.uid, snapshot);
      if (staleChunked) {
        await deleteChunkSet(runtime, user.uid, staleChunked.revision, staleChunked.chunkCount);
      }
    },
  };
}
