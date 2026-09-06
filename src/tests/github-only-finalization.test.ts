import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.1.0-dev.2 GitHub-only architecture invariants', () => {
  it('removes Cloudflare/Web Push runtime and toolchain dependencies', () => {
    const packageJson = JSON.parse(source('../../package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies['web-push']).toBeUndefined();
    expect(packageJson.devDependencies.wrangler).toBeUndefined();
    expect(packageJson.devDependencies['@cloudflare/workers-types']).toBeUndefined();
    expect(packageJson.devDependencies['@types/web-push']).toBeUndefined();
    expect(Object.keys(packageJson.scripts).some((name) => name.startsWith('worker:'))).toBe(false);
    expect(existsSync(new URL('../../worker', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../wrangler.jsonc', import.meta.url))).toBe(false);
  });

  it('keeps the production UI and application bootstrap free of Push transport', () => {
    const app = source('../app/App.tsx');
    const settings = source('../settings/SettingsView.tsx');
    expect(app).not.toContain('push-client');
    expect(app).not.toContain('notification-storage');
    expect(app).not.toContain('rebuildAndSyncNotifications');
    expect(settings).not.toContain('NotificationsSettings');
  });

  it('keeps Service Worker offline-only and never caches private import/export files', () => {
    const serviceWorker = source('../../public/service-worker.js');
    expect(serviceWorker).not.toContain("addEventListener('push'");
    expect(serviceWorker).not.toContain('showNotification(');
    expect(serviceWorker).not.toContain("addEventListener('notificationclick'");
    expect(serviceWorker).not.toContain('indexedDB');
    expect(serviceWorker).toContain("'.pdf', '.xlsx', '.xls', '.json'");
    expect(serviceWorker).toContain("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'");
    expect(serviceWorker).toContain("const CACHE_NAME = `${CACHE_PREFIX}v1.1.0`");
  });

  it('retains the pure reminder planner as a future Android-local integration seam', () => {
    const planner = source('../notifications/notification-planner.ts');
    const settingsTypes = source('../settings/settings.types.ts');
    expect(planner).toContain('planNotificationReminders');
    expect(planner).not.toContain('fetch(');
    expect(settingsTypes).toContain('notificationPreferences');
  });

  it('validates work PDF extension, size and signature before reading the full file', () => {
    const workView = source('../work/WorkView.tsx');
    const validator = source('../imports/pdf/work-pdf-file.ts');
    const validationAt = workView.indexOf('await validateWorkPdfFile(file)');
    const readAt = workView.indexOf('file.arrayBuffer()');
    expect(validationAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(validationAt);
    expect(validator).toContain("endsWith('.pdf')");
    expect(validator).toContain('MAX_WORK_PDF_FILE_BYTES = 32 * 1024 * 1024');
    expect(validator).toContain('file.slice(0, 5).arrayBuffer()');
  });
});
