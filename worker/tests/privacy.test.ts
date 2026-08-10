import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('notification worker privacy contract', () => {
  const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../migrations/0001_notifications.sql', import.meta.url), 'utf8');
  const serviceWorker = readFileSync(new URL('../../public/service-worker.js', import.meta.url), 'utf8');

  it('D1 schema stores only technical installation and wake scheduling fields', () => {
    expect(schema).not.toMatch(/event_title|location|cycle|study|work|notes|category/i);
    expect(schema).toContain('trigger_at_utc');
    expect(schema).toContain('token_hash');
  });

  it('scheduled Web Push payload contains only protocol version and opaque scheduleId', () => {
    expect(source).toContain("JSON.stringify({ v: 1, scheduleId: schedule.schedule_id })");
    expect(source).not.toContain('payload.message');
  });

  it('master kill switch is checked locally by the Service Worker', () => {
    expect(serviceWorker).toContain('runtime.masterEnabled !== true');
    expect(serviceWorker).toContain('runtime.suspended === true');
    expect(serviceWorker).toContain("if (!(await notificationsMasterEnabled())) return;");
  });

  it('batches schedule writes to stay compatible with D1 Free query limits', () => {
    expect(source).toContain('D1_INSERT_ROWS_PER_QUERY = 25');
    expect(source).toContain('VALUES ${values}');
    expect(source).toContain('DUE_SCHEDULE_BATCH = 25');
    expect(source).not.toContain("for (const item of normalized) statements.push(env.DB.prepare('INSERT INTO wake_schedules");
  });

  it('rejects API calls without an explicitly allowed Origin', () => {
    expect(source).toContain('Boolean(origin && allowedOrigins(env).has(origin))');
  });

});
