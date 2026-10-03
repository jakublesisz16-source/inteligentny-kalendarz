import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const main = read('src/main.tsx');
const client = read('src/sync/firebase-client.ts');
const view = read('src/sync/SyncLabView.tsx');

describe('Sync Lab 0.1 isolation', () => {
  it('keeps the normal app as the default path and gates the lab behind a query flag', () => {
    expect(main).toContain("searchParams.get('syncLab') === '1'");
    expect(main).toContain('<App />');
    expect(main).toContain('<SyncLabView />');
  });

  it('does not connect the lab to the production IndexedDB layer', () => {
    expect(view).not.toContain('../storage/database');
    expect(client).not.toContain('../storage/database');
    expect(view).toContain('Obecne dane kalendarza i IndexedDB nie są dotykane.');
  });

  it('writes only to the user-scoped syncTest ping document', () => {
    expect(client).toContain("'users', userId, 'syncTest', 'ping'");
    expect(client).toContain('updatedByDevice');
    expect(client).toContain('serverTimestamp()');
  });

  it('loads Firebase lazily and gets client configuration from Firebase Hosting', () => {
    expect(client).toContain("FIREBASE_SDK_VERSION = '12.19.0'");
    expect(client).toContain('https://www.gstatic.com/firebasejs/');
    expect(client).toContain("fetch('/__/firebase/init.json'");
    expect(client).not.toContain('AIza');
    expect(main).toContain("import('./sync/SyncLabView')");
  });
});
