const FIREBASE_SDK_VERSION = '12.19.0';
const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

export const SYNC_LAB_FIREBASE_PROJECT_ID = 'inteligentny-kalendarz-s-2cfc9';

const firebaseConfig = {
  apiKey: 'AIzaSyAn8Ri_kXqwBIKPb5sIbrb9TGPxVRvnIzo',
  authDomain: 'inteligentny-kalendarz-s-2cfc9.firebaseapp.com',
  projectId: SYNC_LAB_FIREBASE_PROJECT_ID,
  storageBucket: 'inteligentny-kalendarz-s-2cfc9.firebasestorage.app',
  messagingSenderId: '837697978117',
  appId: '1:837697978117:web:28401f63928826972fc16c',
};

interface FirebaseAppModule {
  initializeApp(config: typeof firebaseConfig): unknown;
}

interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
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

interface FirebaseFirestoreModule {
  getFirestore(app: unknown): unknown;
  doc(db: unknown, ...pathSegments: string[]): unknown;
  setDoc(reference: unknown, data: Record<string, unknown>, options?: { merge: boolean }): Promise<void>;
  onSnapshot(
    reference: unknown,
    next: (snapshot: FirestoreDocumentSnapshot) => void,
    error?: (error: unknown) => void,
  ): () => void;
  serverTimestamp(): unknown;
}

interface FirebaseRuntime {
  authModule: FirebaseAuthModule;
  firestoreModule: FirebaseFirestoreModule;
  auth: unknown;
  db: unknown;
}

export interface SyncLabUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface SyncLabPing {
  text: string;
  updatedAt: string | null;
  updatedByDevice: string;
}

let runtimePromise: Promise<FirebaseRuntime> | null = null;

async function importFirebaseModule<T>(filename: string): Promise<T> {
  const url = `${FIREBASE_CDN}/${filename}`;
  return import(/* @vite-ignore */ url) as Promise<T>;
}

function normalizeUser(user: FirebaseAuthUser): SyncLabUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

function timestampToIso(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('toDate' in value)) return null;
  const candidate = value as { toDate?: unknown };
  if (typeof candidate.toDate !== 'function') return null;
  const date = candidate.toDate();
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

async function createRuntime(): Promise<FirebaseRuntime> {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    importFirebaseModule<FirebaseAppModule>('firebase-app.js'),
    importFirebaseModule<FirebaseAuthModule>('firebase-auth.js'),
    importFirebaseModule<FirebaseFirestoreModule>('firebase-firestore.js'),
  ]);

  const app = appModule.initializeApp(firebaseConfig);
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

export function getSyncLabDeviceId(): string {
  const storageKey = 'ik-sync-lab-device-id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const value = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(storageKey, value);
  return value;
}

export async function warmSyncLabRuntime(): Promise<void> {
  await getRuntime();
}

export async function subscribeToSyncLabUser(
  listener: (user: SyncLabUser | null) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const runtime = await getRuntime();
  return runtime.authModule.onAuthStateChanged(
    runtime.auth,
    (user) => listener(user ? normalizeUser(user) : null),
    onError,
  );
}

export async function signInSyncLabWithGoogle(): Promise<SyncLabUser> {
  const runtime = await getRuntime();
  const provider = new runtime.authModule.GoogleAuthProvider();
  const result = await runtime.authModule.signInWithPopup(runtime.auth, provider);
  return normalizeUser(result.user);
}

export async function signOutSyncLab(): Promise<void> {
  const runtime = await getRuntime();
  await runtime.authModule.signOut(runtime.auth);
}

export async function writeSyncLabPing(userId: string, text: string): Promise<void> {
  const runtime = await getRuntime();
  const reference = runtime.firestoreModule.doc(runtime.db, 'users', userId, 'syncTest', 'ping');
  await runtime.firestoreModule.setDoc(reference, {
    text,
    updatedAt: runtime.firestoreModule.serverTimestamp(),
    updatedByDevice: getSyncLabDeviceId(),
  }, { merge: true });
}

export async function subscribeToSyncLabPing(
  userId: string,
  listener: (ping: SyncLabPing | null) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const runtime = await getRuntime();
  const reference = runtime.firestoreModule.doc(runtime.db, 'users', userId, 'syncTest', 'ping');

  return runtime.firestoreModule.onSnapshot(
    reference,
    (snapshot) => {
      if (!snapshot.exists()) {
        listener(null);
        return;
      }
      const data = snapshot.data() ?? {};
      listener({
        text: typeof data.text === 'string' ? data.text : '',
        updatedAt: timestampToIso(data.updatedAt),
        updatedByDevice: typeof data.updatedByDevice === 'string' ? data.updatedByDevice : '',
      });
    },
    onError,
  );
}

export function readableFirebaseError(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown };
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    if (code === 'auth/popup-closed-by-user') return 'Logowanie zostało anulowane.';
    if (code === 'auth/popup-blocked') return 'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna i spróbuj ponownie.';
    if (code === 'permission-denied') return 'Firestore odrzucił zapis. Sprawdź reguły Sync Lab.';
    if (message) return message;
  }
  return 'Nie udało się wykonać operacji Sync Lab.';
}
