import webpush from 'web-push';

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGINS: string;
  REGISTER_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
  API_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

interface InstallationRow {
  installation_id: string;
  token_hash: string;
  push_endpoint: string;
  push_p256dh: string;
  push_auth: string;
  last_test_at: number | null;
}

interface DueScheduleRow extends InstallationRow {
  schedule_id: string;
  trigger_at_utc: number;
  attempts: number;
}

const MAX_SCHEDULES = 500;
const MAX_HORIZON_MS = 100 * 24 * 60 * 60 * 1000;
const TEST_RATE_LIMIT_MS = 30_000;
const D1_INSERT_ROWS_PER_QUERY = 25; // 4 bindings/row = max 100 bound params.
const DUE_SCHEDULE_BATCH = 25;

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin') ?? '';
  const allowed = allowedOrigins(env);
  return {
    ...(allowed.has(origin) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request, env) } });
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && allowedOrigins(env).has(origin));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bearer(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function validToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

async function getInstallation(env: Env, id: string): Promise<InstallationRow | null> {
  return env.DB.prepare('SELECT installation_id, token_hash, push_endpoint, push_p256dh, push_auth, last_test_at FROM push_installations WHERE installation_id = ?')
    .bind(id).first<InstallationRow>();
}

async function authorizeInstallation(request: Request, env: Env, id: string): Promise<InstallationRow | null> {
  const token = bearer(request);
  if (!validToken(token)) return null;
  const row = await getInstallation(env, id);
  if (!row) return null;
  return (await sha256Hex(token)) === row.token_hash ? row : null;
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 200_000) throw new Error('PAYLOAD_TOO_LARGE');
  const value = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON');
  return value as Record<string, unknown>;
}

async function registerInstallation(request: Request, env: Env): Promise<Response> {
  if (!(await env.REGISTER_RATE_LIMITER.limit({ key: 'register' })).success) return json(request, env, { error: 'Zbyt wiele prób rejestracji. Spróbuj ponownie później.' }, 429);
  const body = await parseJson(request);
  const installationId = body.installationId;
  const installationToken = body.installationToken;
  const subscription = body.subscription as Record<string, unknown> | undefined;
  const keys = subscription?.keys as Record<string, unknown> | undefined;
  if (!validId(installationId) || !validToken(installationToken)) return json(request, env, { error: 'Nieprawidłowa identyfikacja instalacji.' }, 400);
  if (typeof subscription?.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') || subscription.endpoint.length > 4096) return json(request, env, { error: 'Nieprawidłowy endpoint Push.' }, 400);
  if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' || keys.p256dh.length > 512 || keys.auth.length > 256) return json(request, env, { error: 'Nieprawidłowe klucze subskrypcji.' }, 400);

  const tokenHash = await sha256Hex(installationToken);
  const existing = await getInstallation(env, installationId);
  if (existing && existing.token_hash !== tokenHash) return json(request, env, { error: 'Instalacja jest już zarejestrowana z innym tokenem.' }, 403);
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO push_installations (installation_id, token_hash, push_endpoint, push_p256dh, push_auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(installation_id) DO UPDATE SET push_endpoint=excluded.push_endpoint, push_p256dh=excluded.push_p256dh, push_auth=excluded.push_auth, updated_at=excluded.updated_at`)
    .bind(installationId, tokenHash, subscription.endpoint, keys.p256dh, keys.auth, now, now).run();
  return json(request, env, { ok: true });
}

function normalizeSchedules(value: unknown, now: number): { scheduleId: string; triggerAt: number }[] | null {
  if (!Array.isArray(value) || value.length > MAX_SCHEDULES) return null;
  const normalized: { scheduleId: string; triggerAt: number }[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (!validId(record.scheduleId) || seen.has(record.scheduleId)) return null;
    const triggerAt = typeof record.triggerAtUtc === 'string' ? Date.parse(record.triggerAtUtc) : NaN;
    if (!Number.isFinite(triggerAt) || triggerAt <= now - 60_000 || triggerAt > now + MAX_HORIZON_MS) return null;
    seen.add(record.scheduleId);
    normalized.push({ scheduleId: record.scheduleId, triggerAt });
  }
  return normalized;
}

function scheduleInsertStatements(env: Env, installationId: string, schedules: { scheduleId: string; triggerAt: number }[], now: number): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < schedules.length; offset += D1_INSERT_ROWS_PER_QUERY) {
    const chunk = schedules.slice(offset, offset + D1_INSERT_ROWS_PER_QUERY);
    const values = chunk.map(() => '(?, ?, ?, 0, ?)').join(',');
    const bindings: (string | number)[] = [];
    for (const item of chunk) bindings.push(item.scheduleId, installationId, item.triggerAt, now);
    statements.push(env.DB.prepare(`INSERT INTO wake_schedules (schedule_id, installation_id, trigger_at_utc, attempts, created_at) VALUES ${values}`).bind(...bindings));
  }
  return statements;
}

async function replaceSchedules(request: Request, env: Env, installationId: string): Promise<Response> {
  if (!(await env.API_RATE_LIMITER.limit({ key: `schedule:${installationId}` })).success) return json(request, env, { error: 'Zbyt wiele żądań synchronizacji.' }, 429);
  const installation = await authorizeInstallation(request, env, installationId);
  if (!installation) return json(request, env, { error: 'Brak autoryzacji instalacji.' }, 401);
  const body = await parseJson(request);
  const now = Date.now();
  const normalized = normalizeSchedules(body.schedules, now);
  if (!normalized) return json(request, env, { error: 'Nieprawidłowy harmonogram lub liczba harmonogramów.' }, 400);

  // Max 500 records -> 1 DELETE + 20 multi-row INSERT statements, below D1 Free's
  // 50-query Worker-invocation limit. D1 batch is transactional.
  const statements = [
    env.DB.prepare('DELETE FROM wake_schedules WHERE installation_id = ?').bind(installationId),
    ...scheduleInsertStatements(env, installationId, normalized, now),
  ];
  await env.DB.batch(statements);
  return json(request, env, { ok: true, count: normalized.length });
}

async function deleteInstallation(request: Request, env: Env, installationId: string): Promise<Response> {
  if (!(await env.API_RATE_LIMITER.limit({ key: `delete:${installationId}` })).success) return json(request, env, { error: 'Zbyt wiele żądań.' }, 429);
  const installation = await authorizeInstallation(request, env, installationId);
  if (!installation) return json(request, env, { error: 'Brak autoryzacji instalacji.' }, 401);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM wake_schedules WHERE installation_id = ?').bind(installationId),
    env.DB.prepare('DELETE FROM push_installations WHERE installation_id = ?').bind(installationId),
  ]);
  return json(request, env, { ok: true });
}


function pushStatusCode(error: unknown): number {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return 0;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' ? value : 0;
}

function configureVapid(env: Env): void {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) throw new Error('VAPID_NOT_CONFIGURED');
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

async function sendPush(env: Env, installation: Pick<InstallationRow, 'push_endpoint' | 'push_p256dh' | 'push_auth'>, payload: string): Promise<void> {
  configureVapid(env);
  await webpush.sendNotification({
    endpoint: installation.push_endpoint,
    keys: { p256dh: installation.push_p256dh, auth: installation.push_auth },
  }, payload, { TTL: 300, urgency: 'normal' });
}

async function testPush(request: Request, env: Env, installationId: string): Promise<Response> {
  if (!(await env.API_RATE_LIMITER.limit({ key: `test:${installationId}` })).success) return json(request, env, { error: 'Zbyt wiele testów.' }, 429);
  const installation = await authorizeInstallation(request, env, installationId);
  if (!installation) return json(request, env, { error: 'Brak autoryzacji instalacji.' }, 401);
  const now = Date.now();
  if (installation.last_test_at && now - installation.last_test_at < TEST_RATE_LIMIT_MS) return json(request, env, { error: 'Odczekaj chwilę przed kolejnym testem.' }, 429);
  try {
    await sendPush(env, installation, JSON.stringify({ v: 1, test: true }));
    await env.DB.prepare('UPDATE push_installations SET last_test_at = ?, updated_at = ? WHERE installation_id = ?').bind(now, now, installationId).run();
    return json(request, env, { ok: true });
  } catch (error) {
    const statusCode = pushStatusCode(error);
    if (statusCode === 404 || statusCode === 410) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM wake_schedules WHERE installation_id = ?').bind(installationId),
        env.DB.prepare('DELETE FROM push_installations WHERE installation_id = ?').bind(installationId),
      ]);
      return json(request, env, { error: 'Subskrypcja Push wygasła. Włącz powiadomienia ponownie.' }, 410);
    }
    return json(request, env, { error: 'Nie udało się wysłać testowego Push.' }, 502);
  }
}

function inClause(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

async function runDueSchedules(env: Env): Promise<void> {
  configureVapid(env);
  const now = Date.now();
  const result = await env.DB.prepare(`SELECT ws.schedule_id, ws.installation_id, ws.trigger_at_utc, ws.attempts,
      pi.token_hash, pi.push_endpoint, pi.push_p256dh, pi.push_auth, pi.last_test_at
    FROM wake_schedules ws
    JOIN push_installations pi ON pi.installation_id = ws.installation_id
    WHERE ws.trigger_at_utc <= ?
    ORDER BY ws.trigger_at_utc
    LIMIT ?`).bind(now, DUE_SCHEDULE_BATCH).all<DueScheduleRow>();

  const deleteScheduleIds = new Set<string>();
  const retryScheduleIds = new Set<string>();
  const deadInstallationIds = new Set<string>();

  for (const schedule of result.results) {
    try {
      await sendPush(env, schedule, JSON.stringify({ v: 1, scheduleId: schedule.schedule_id }));
      deleteScheduleIds.add(schedule.schedule_id);
    } catch (error) {
      const statusCode = pushStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        deadInstallationIds.add(schedule.installation_id);
      } else if (schedule.attempts >= 2 || (statusCode >= 400 && statusCode < 500)) {
        deleteScheduleIds.add(schedule.schedule_id);
      } else {
        retryScheduleIds.add(schedule.schedule_id);
      }
    }
  }

  const statements: D1PreparedStatement[] = [];
  const dead = [...deadInstallationIds];
  if (dead.length) {
    statements.push(env.DB.prepare(`DELETE FROM wake_schedules WHERE installation_id IN (${inClause(dead.length)})`).bind(...dead));
    statements.push(env.DB.prepare(`DELETE FROM push_installations WHERE installation_id IN (${inClause(dead.length)})`).bind(...dead));
  }
  const deleted = [...deleteScheduleIds].filter((id) => !result.results.some((row) => deadInstallationIds.has(row.installation_id) && row.schedule_id === id));
  if (deleted.length) statements.push(env.DB.prepare(`DELETE FROM wake_schedules WHERE schedule_id IN (${inClause(deleted.length)})`).bind(...deleted));
  const retried = [...retryScheduleIds].filter((id) => !deleteScheduleIds.has(id));
  if (retried.length) statements.push(env.DB.prepare(`UPDATE wake_schedules SET attempts = attempts + 1 WHERE schedule_id IN (${inClause(retried.length)})`).bind(...retried));
  statements.push(env.DB.prepare('DELETE FROM wake_schedules WHERE trigger_at_utc < ?').bind(now - 24 * 60 * 60 * 1000));
  await env.DB.batch(statements);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(request, env)) return new Response(null, { status: 403, headers: corsHeaders(request, env) });
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (!isAllowedOrigin(request, env)) return json(request, env, { error: 'Origin niedozwolony.' }, 403);
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/v1/config') return json(request, env, { vapidPublicKey: env.VAPID_PUBLIC_KEY });
      if (request.method === 'POST' && url.pathname === '/v1/installations/register') return await registerInstallation(request, env);
      const scheduleMatch = url.pathname.match(/^\/v1\/installations\/([^/]+)\/schedules$/);
      if (request.method === 'PUT' && scheduleMatch) return await replaceSchedules(request, env, decodeURIComponent(scheduleMatch[1]!));
      const testMatch = url.pathname.match(/^\/v1\/installations\/([^/]+)\/test$/);
      if (request.method === 'POST' && testMatch) return await testPush(request, env, decodeURIComponent(testMatch[1]!));
      const installationMatch = url.pathname.match(/^\/v1\/installations\/([^/]+)$/);
      if (request.method === 'DELETE' && installationMatch) return await deleteInstallation(request, env, decodeURIComponent(installationMatch[1]!));
      return json(request, env, { error: 'Not found' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'PAYLOAD_TOO_LARGE') return json(request, env, { error: 'Payload jest zbyt duży.' }, 413);
      if (message === 'INVALID_JSON') return json(request, env, { error: 'Nieprawidłowy JSON.' }, 400);
      return json(request, env, { error: 'Błąd serwera powiadomień.' }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDueSchedules(env);
  },
} satisfies ExportedHandler<Env>;
