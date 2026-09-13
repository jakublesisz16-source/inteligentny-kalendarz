import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

function exists(path: string): boolean {
  return existsSync(new URL(`../../${path}`, import.meta.url));
}

describe('1.2.0 public package hygiene', () => {
  it('does not ship internal handoff or PRIVATE notes', () => {
    const entries = readdirSync(root);
    expect(entries.filter((name) => /^HANDOFF_NEW_CHAT_.*\.md$/u.test(name))).toEqual([]);
    expect(entries.filter((name) => /^PRIVATE_.*\.md$/u.test(name))).toEqual([]);
    expect(entries).not.toContain('CURRENT_PROJECT_RULES.md');
    expect(entries).not.toContain('CLEAN_CHECKPOINT_CONTENTS.md');
  });

  it('keeps only the active PWA icon generation', () => {
    for (const current of ['public/icon-192-v1203.png', 'public/icon-512-v1203.png', 'public/apple-touch-icon-v1203.png']) {
      expect(exists(current)).toBe(true);
    }
    for (const obsolete of [
      'public/icon-192.png', 'public/icon-512.png', 'public/apple-touch-icon.png',
      'public/icon-192-v111.png', 'public/icon-512-v111.png', 'public/apple-touch-icon-v111.png',
      'public/icon-192-v1202.png', 'public/icon-512-v1202.png', 'public/apple-touch-icon-v1202.png',
      'public/icon-192-v120d1.png', 'public/icon-512-v120d1.png', 'public/apple-touch-icon-v120d1.png',
    ]) expect(exists(obsolete)).toBe(false);
  });

  it('does not ship superseded 1.0 release notes or the obsolete root validator', () => {
    for (const obsolete of [
      'docs/DEPLOYMENT_1.0.0.md',
      'docs/LOCAL_FINAL_GATE.md',
      'docs/PROJECT_HANDOFF.md',
      'FINAL_RELEASE_VALIDATION.ps1',
    ]) expect(exists(obsolete)).toBe(false);
  });

  it('keeps publication guidance version-neutral', () => {
    const doc = readFileSync(new URL('../../docs/PUBLIC_REPOSITORY.md', import.meta.url), 'utf8');
    expect(doc).toContain('Repozytorium publiczne zawiera wyłącznie kod źródłowy');
    expect(doc).not.toContain('Finalna architektura `1.0.0`');
  });
});
