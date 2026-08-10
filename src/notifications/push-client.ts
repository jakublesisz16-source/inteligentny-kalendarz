import {
  clearNotificationReminders,
  ensureNotificationInstallationIdentity,
  getNotificationRuntime,
  updateNotificationRuntime,
} from '../storage/database';
import type { NotificationSystemStatus, PushSupport } from './notification.types';

function workerBaseUrl(): string {
  return String(import.meta.env.VITE_PUSH_WORKER_URL ?? '').replace(/\/$/, '');
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return buffer;
}

function isIosLike(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalonePwa(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function detectPushSupport(): PushSupport {
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return { supported: false, reason: 'INSECURE_CONTEXT' };
  if (isIosLike() && !isStandalonePwa()) return { supported: false, reason: 'IOS_REQUIRES_HOME_SCREEN' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'NO_SERVICE_WORKER' };
  if (!('Notification' in window)) return { supported: false, reason: 'NO_NOTIFICATION_API' };
  if (!('PushManager' in window)) return { supported: false, reason: 'NO_PUSH_MANAGER' };
  return { supported: true };
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const base = workerBaseUrl();
  if (!base) throw new Error('Serwer powiadomień nie jest jeszcze skonfigurowany.');
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Serwer powiadomień zwrócił błąd ${response.status}.`);
  }
  return response;
}

async function subscriptionJson(subscription: PushSubscription) {
  const data = subscription.toJSON();
  if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) throw new Error('Przeglądarka zwróciła niepełną subskrypcję Push.');
  return { endpoint: data.endpoint, expirationTime: data.expirationTime ?? null, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth } };
}

export async function enablePushNotifications(): Promise<void> {
  const support = detectPushSupport();
  if (!support.supported) throw new Error('Powiadomienia nie są dostępne na tym urządzeniu lub w tej przeglądarce.');
  if (!workerBaseUrl()) throw new Error('Serwer powiadomień nie jest jeszcze skonfigurowany.');
  if (Notification.permission === 'denied') {
    await updateNotificationRuntime({ masterEnabled: false, serverRegistrationState: 'DISABLED' });
    throw new Error('Powiadomienia są zablokowane przez przeglądarkę lub system. Zmień uprawnienie w ustawieniach przeglądarki/systemu, jeśli chcesz je później włączyć.');
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    await updateNotificationRuntime({ masterEnabled: false, serverRegistrationState: 'DISABLED' });
    throw new Error('Nie udzielono zgody na powiadomienia.');
  }

  const runtime = await ensureNotificationInstallationIdentity();
  const config = await (await api('/v1/config')).json() as { vapidPublicKey: string };
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (!existingRegistration) await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToArrayBuffer(config.vapidPublicKey),
    });
  }
  await api('/v1/installations/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      installationId: runtime.installationId,
      installationToken: runtime.installationToken,
      subscription: await subscriptionJson(subscription),
    }),
  });
  await updateNotificationRuntime({ masterEnabled: true, suspended: false, serverRegistrationState: 'DEGRADED', pendingRemoteCleanup: false });
}

export async function disablePushNotifications(): Promise<void> {
  const runtime = await getNotificationRuntime();
  await updateNotificationRuntime({ masterEnabled: false, suspended: false, serverRegistrationState: 'DISABLED' });
  await clearNotificationReminders();
  if (!runtime.installationId || !runtime.installationToken || !workerBaseUrl()) return;
  try {
    await api(`/v1/installations/${encodeURIComponent(runtime.installationId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${runtime.installationToken}` },
    });
    await updateNotificationRuntime({ pendingRemoteCleanup: false });
  } catch {
    await updateNotificationRuntime({ pendingRemoteCleanup: true });
  }
}

export async function retryPendingNotificationCleanup(): Promise<void> {
  const runtime = await getNotificationRuntime();
  if (!runtime.pendingRemoteCleanup || !runtime.installationId || !runtime.installationToken || !workerBaseUrl()) return;
  try {
    await api(`/v1/installations/${encodeURIComponent(runtime.installationId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${runtime.installationToken}` },
    });
    await updateNotificationRuntime({ pendingRemoteCleanup: false });
  } catch {
    // Pozostaje do ponowienia przy kolejnym uruchomieniu.
  }
}

export async function syncRemoteSchedules(schedules: { scheduleId: string; triggerAtUtc: string }[]): Promise<void> {
  const runtime = await getNotificationRuntime();
  if (!runtime.masterEnabled || !runtime.installationId || !runtime.installationToken) return;
  await api(`/v1/installations/${encodeURIComponent(runtime.installationId)}/schedules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${runtime.installationToken}` },
    body: JSON.stringify({ schedules }),
  });
}

export async function sendTestPush(): Promise<void> {
  const runtime = await getNotificationRuntime();
  if (!runtime.masterEnabled || !runtime.installationId || !runtime.installationToken) throw new Error('Najpierw włącz powiadomienia.');
  await api(`/v1/installations/${encodeURIComponent(runtime.installationId)}/test`, {
    method: 'POST',
    headers: { authorization: `Bearer ${runtime.installationToken}` },
  });
}

export async function getNotificationSystemStatus(): Promise<NotificationSystemStatus> {
  const support = detectPushSupport();
  if (!support.supported) return 'UNSUPPORTED';
  if (Notification.permission === 'denied') return 'DENIED';
  const runtime = await getNotificationRuntime();
  if (!runtime.masterEnabled) return 'DISABLED';
  return runtime.serverRegistrationState === 'READY' ? 'ENABLED' : 'DEGRADED';
}

export function notificationWorkerConfigured(): boolean {
  return Boolean(workerBaseUrl());
}
