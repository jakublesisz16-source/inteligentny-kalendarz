import type { WorkProfile } from './work.types';

export type WorkImportReadiness =
  | { ready: true; reason: null; actionLabel: 'Importuj PDF' }
  | { ready: false; reason: 'MISSING_PROFILE' | 'MISSING_EMPLOYEE_NAME'; actionLabel: 'Ustaw profil pracy' | 'Uzupełnij profil' };

export function getWorkImportReadiness(profile?: WorkProfile): WorkImportReadiness {
  if (!profile) return { ready: false, reason: 'MISSING_PROFILE', actionLabel: 'Ustaw profil pracy' };
  if (!profile.employeeMatchName.trim()) return { ready: false, reason: 'MISSING_EMPLOYEE_NAME', actionLabel: 'Uzupełnij profil' };
  return { ready: true, reason: null, actionLabel: 'Importuj PDF' };
}
