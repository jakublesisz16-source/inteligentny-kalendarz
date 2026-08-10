import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalStorageProtectionStatus, requestLocalStoragePersistence } from '../storage/persistence';
import { getWorkImportReadiness } from '../work/work-import-readiness';
import type { WorkProfile } from '../work/work.types';

function profile(employeeMatchName: string): WorkProfile {
  return {
    id: 'work',
    employeeMatchName,
    employerName: '',
    workplaceName: '',
    storeCoworkerSchedule: true,
    active: true,
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('0.3.7 blocked action UX', () => {
  it('explains missing work profile', () => {
    expect(getWorkImportReadiness()).toEqual({ ready: false, reason: 'MISSING_PROFILE', actionLabel: 'Ustaw profil pracy' });
  });

  it('explains missing employee name', () => {
    expect(getWorkImportReadiness(profile('   '))).toEqual({ ready: false, reason: 'MISSING_EMPLOYEE_NAME', actionLabel: 'Uzupełnij profil' });
  });

  it('unlocks PDF import after employee name is configured', () => {
    expect(getWorkImportReadiness(profile('Osoba Testowa'))).toEqual({ ready: true, reason: null, actionLabel: 'Importuj PDF' });
  });
});

describe('0.3.7 local storage persistence', () => {
  it('falls back safely when StorageManager is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getLocalStorageProtectionStatus()).resolves.toBe('unsupported');
    await expect(requestLocalStoragePersistence()).resolves.toBe(false);
  });

  it('reads granted persistent storage', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist: async () => true } });
    await expect(getLocalStorageProtectionStatus()).resolves.toBe('persistent');
  });

  it('handles a denied persistence request without failing the app', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => false } });
    await expect(requestLocalStoragePersistence()).resolves.toBe(false);
    await expect(getLocalStorageProtectionStatus()).resolves.toBe('standard');
  });
});
