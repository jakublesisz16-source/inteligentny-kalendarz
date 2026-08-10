import { describe, expect, it } from 'vitest';
import { validateEventDraft } from '../events/event.validation';

const baseDraft = {
  title: 'Zajęcia',
  startDateTime: '2026-08-10T09:00',
  endDateTime: '2026-08-10T10:00',
  category: 'STUDY' as const,
};

describe('validateEventDraft', () => {
  it('akceptuje poprawny zakres godzin', () => {
    expect(validateEventDraft(baseDraft).valid).toBe(true);
  });

  it('odrzuca puste tytuły', () => {
    const result = validateEventDraft({ ...baseDraft, title: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeTruthy();
  });

  it('odrzuca koniec równy początkowi', () => {
    const result = validateEventDraft({ ...baseDraft, endDateTime: baseDraft.startDateTime });
    expect(result.valid).toBe(false);
    expect(result.errors.timeRange).toBeTruthy();
  });

  it('odrzuca koniec wcześniejszy od początku', () => {
    const result = validateEventDraft({ ...baseDraft, endDateTime: '2026-08-10T08:30' });
    expect(result.valid).toBe(false);
  });
});
