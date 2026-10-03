import { FIREBASE_GOOGLE_SYNC_CONFIG } from './firebase-google-config';
import { SyncRemoteChangedError } from '../sync-errors';
import { FIREBASE_GOOGLE_SYNC_PROVIDER_ID } from '../provider-ids';
import type { SyncAccount, SyncProvider, SyncSnapshotEnvelope } from '../sync.types';

const FIREBASE_SDK_VERSION = '12.19.0';
const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const MAX_SYNC_PAYLOAD_BYTES = 850_000;

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
  runTransaction<T>(db: unknown, update: (transaction: FirestoreTransaction) => Promise<T>): Promise<T>;
  serverTimestamp(): unknown;
}

interface FirebaseRuntime {
  authModule: FirebaseAuthModule;
  firestoreModule: FirebaseFirestoreModule;
  auth: unknown;
  db: unknown;
}

interface CloudSnapshotDocument {
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

let runtimePromise: Promise<FirebaseRuntime> | null = null;

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
    let unsubscribe = () => undefined;
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

function encodeCloudSnapshot(snapshot: SyncSnapshotEnvelope): CloudSnapshotDocument & { serverUpdatedAt: unknown } {
  const payloadJson = JSON.stringify(snapshot);
  const payloadBytes = new TextEncoder().encode(payloadJson).byteLength;
  if (payloadBytes > MAX_SYNC_PAYLOAD_BYTES) {
    throw new Error('Dane aplikacji są zbyt duże dla prostego Sync V1. Dane lokalne pozostały bez zmian.');
  }
  return {
    format: 'inteligentny-kalendarz-cloud-snapshot',
    version: 1,
    revision: snapshot.revision,
    clientUpdatedAt: snapshot.updatedAt,
    sourceDeviceId: snapshot.sourceDeviceId,
    payloadJson,
    payloadBytes,
    appVersion: snapshot.document.appVersion,
    databaseSchemaVersion: snapshot.document.databaseSchemaVersion,
    serverUpdatedAt: null,
  };
}

function decodeCloudSnapshot(data: Record<string, unknown> | undefined): SyncSnapshotEnvelope | null {
  if (!data) return null;
  if (data.format !== 'inteligentny-kalendarz-cloud-snapshot' || data.version !== 1) {
    throw new Error('Chmura zawiera nieobsługiwany format danych synchronizacji.');
  }
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
      await runtime.authModule.signOut(runtime.auth);
    },
    async pullLatest() {
      const runtime = await getRuntime();
      const user = await requireUser(runtime);
      const snapshot = await runtime.firestoreModule.getDoc(syncDocumentReference(runtime, user.uid));
      return snapshot.exists() ? decodeCloudSnapshot(snapshot.data()) : null;
    },
    async pushSnapshot(snapshot, expectedRevision = undefined) {
      const runtime = await getRuntime();
      const user = await requireUser(runtime);
      const reference = syncDocumentReference(runtime, user.uid);
      const encoded = encodeCloudSnapshot(snapshot);
      await runtime.firestoreModule.runTransaction(runtime.db, async (transaction) => {
        const current = await transaction.get(reference);
        const currentRevision = current.exists() && typeof current.data()?.revision === 'string'
          ? String(current.data()?.revision)
          : null;
        if (expectedRevision !== undefined && currentRevision !== expectedRevision) {
          throw new SyncRemoteChangedError(currentRevision);
        }
        transaction.set(reference, {
          ...encoded,
          serverUpdatedAt: runtime.firestoreModule.serverTimestamp(),
        });
      });
    },
  };
}
