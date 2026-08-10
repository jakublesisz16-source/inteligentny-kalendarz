const CACHE_NAME = 'inteligentny-kalendarz-shell-v1.0.0-rc.7';
const DB_NAME = 'inteligentny-kalendarz';
const STORE_NOTIFICATION_RUNTIME = 'notificationRuntime';
const STORE_NOTIFICATION_REMINDERS = 'notificationReminders';
const STORE_SETTINGS = 'settings';
const LATE_GRACE_MS = 10 * 60 * 1000;
const EARLY_GRACE_MS = 2 * 60 * 1000;

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  const scope = self.registration.scope;
  const shellResponse = await fetch(scope, { cache: 'reload' });
  if (!shellResponse.ok) throw new Error('Nie udało się pobrać powłoki aplikacji.');
  await cache.put(scope, shellResponse.clone());
  const html = await shellResponse.text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => value && !value.startsWith('data:') && !value.startsWith('http'))
    .map((value) => new URL(value, scope).href);
  const essential = [
    new URL('manifest.webmanifest', scope).href,
    new URL('favicon.svg', scope).href,
    new URL('icon-192.png', scope).href,
    new URL('icon-512.png', scope).href,
    new URL('apple-touch-icon.png', scope).href,
    ...discovered,
  ];
  await Promise.all([...new Set(essential)].map(async (url) => {
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    } catch {
      // Pojedynczy opcjonalny zasób nie blokuje instalacji service workera.
    }
  }));
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

async function openExistingDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Database unavailable'));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error('Service Worker does not migrate the database'));
    };
  });
}

async function readNotificationContext(scheduleId) {
  const db = await openExistingDatabase();
  try {
    if (!db.objectStoreNames.contains(STORE_NOTIFICATION_RUNTIME) || !db.objectStoreNames.contains(STORE_NOTIFICATION_REMINDERS)) return null;
    const stores = [STORE_NOTIFICATION_RUNTIME, STORE_NOTIFICATION_REMINDERS];
    if (db.objectStoreNames.contains(STORE_SETTINGS)) stores.push(STORE_SETTINGS);
    const tx = db.transaction(stores, 'readonly');
    const runtime = await requestValue(tx.objectStore(STORE_NOTIFICATION_RUNTIME).get('runtime'));
    if (!runtime || runtime.masterEnabled !== true || runtime.suspended === true) {
      await transactionDone(tx);
      return null;
    }
    const reminderStore = tx.objectStore(STORE_NOTIFICATION_REMINDERS);
    if (!reminderStore.indexNames.contains('scheduleId')) {
      await transactionDone(tx);
      return null;
    }
    const reminder = await requestValue(reminderStore.index('scheduleId').get(scheduleId));
    const settings = stores.includes(STORE_SETTINGS) ? await requestValue(tx.objectStore(STORE_SETTINGS).get('app')) : undefined;
    await transactionDone(tx);
    return { reminder, contentMode: settings?.notificationPreferences?.contentMode === 'FULL' ? 'FULL' : 'DISCREET' };
  } finally {
    db.close();
  }
}

async function markReminderShown(id, shownAt) {
  const db = await openExistingDatabase();
  try {
    if (!db.objectStoreNames.contains(STORE_NOTIFICATION_REMINDERS)) return;
    const tx = db.transaction(STORE_NOTIFICATION_REMINDERS, 'readwrite');
    const store = tx.objectStore(STORE_NOTIFICATION_REMINDERS);
    const reminder = await requestValue(store.get(id));
    if (reminder && !reminder.shownAt) store.put({ ...reminder, shownAt, updatedAt: shownAt });
    await transactionDone(tx);
  } finally { db.close(); }
}

async function notificationsMasterEnabled() {
  try {
    const db = await openExistingDatabase();
    try {
      if (!db.objectStoreNames.contains(STORE_NOTIFICATION_RUNTIME)) return false;
      const tx = db.transaction(STORE_NOTIFICATION_RUNTIME, 'readonly');
      const runtime = await requestValue(tx.objectStore(STORE_NOTIFICATION_RUNTIME).get('runtime'));
      await transactionDone(tx);
      return Boolean(runtime?.masterEnabled && !runtime?.suspended);
    } finally { db.close(); }
  } catch { return false; }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await cacheApplicationShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
    if (!(await notificationsMasterEnabled())) return;

    if (payload?.test === true) {
      await self.registration.showNotification('Inteligentny Kalendarz', {
        body: 'Test powiadomień działa.',
        icon: new URL('icon-192.png', self.registration.scope).href,
        badge: new URL('icon-192.png', self.registration.scope).href,
        tag: 'ik-push-test',
      });
      return;
    }

    if (typeof payload?.scheduleId !== 'string' || !payload.scheduleId) return;
    const context = await readNotificationContext(payload.scheduleId).catch(() => null);
    const reminder = context?.reminder;
    if (!reminder || reminder.shownAt) return;
    const now = Date.now();
    const trigger = Date.parse(reminder.triggerAt);
    if (!Number.isFinite(trigger)) return;
    if (trigger < now - LATE_GRACE_MS) {
      await markReminderShown(reminder.id, new Date(now).toISOString());
      return;
    }
    if (trigger > now + EARLY_GRACE_MS) return;

    const full = context.contentMode === 'FULL';
    await self.registration.showNotification(full ? reminder.fullTitle : reminder.discreetTitle, {
      body: full ? reminder.fullBody : reminder.discreetBody,
      icon: new URL('icon-192.png', self.registration.scope).href,
      badge: new URL('icon-192.png', self.registration.scope).href,
      tag: `ik-reminder-${reminder.id}`,
      data: { reminderId: reminder.id },
    });
    await markReminderShown(reminder.id, new Date().toISOString());
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus();
    }
    return self.clients.openWindow(self.registration.scope);
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const privateFileExtensions = ['.pdf', '.xlsx', '.xls', '.json'];
  if (privateFileExtensions.some((extension) => url.pathname.toLowerCase().endsWith(extension))) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(self.registration.scope, response.clone());
        return response;
      } catch {
        const cached = await caches.match(self.registration.scope);
        return cached || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch { return Response.error(); }
  })());
});
