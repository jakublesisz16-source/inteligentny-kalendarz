import { describe, expect, it } from 'vitest';
import { validateEventDraft, validateManualMultiDateDraft } from '../events/event.validation';

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

  it('odrzuca nieistniejący dzień i zachowuje prawidłowy rok przestępny', () => {
    expect(validateEventDraft({ ...baseDraft, startDateTime: '2026-02-31T09:00', endDateTime: '2026-03-03T10:00' }).valid).toBe(false);
    expect(validateEventDraft({ ...baseDraft, startDateTime: '2026-02-29T09:00', endDateTime: '2026-03-01T10:00' }).valid).toBe(false);
    expect(validateEventDraft({ ...baseDraft, startDateTime: '2028-02-29T09:00', endDateTime: '2028-02-29T10:00' }).valid).toBe(true);
    expect(validateEventDraft({ ...baseDraft, allDay: true, startDateTime: '2026-02-31T00:00', endDateTime: '2026-03-03T23:59' }).valid).toBe(false);
  });

  it('nie pozwala Date.parse zmienić 24:00 na następny dzień ani pomylić czasu lokalnego ze znacznikiem UTC', () => {
    expect(validateEventDraft({ ...baseDraft, endDateTime: '2026-08-10T24:00' }).valid).toBe(false);
    expect(validateEventDraft({ ...baseDraft, endDateTime: '2026-08-10T10:00Z' }).valid).toBe(false);
    expect(validateEventDraft({ ...baseDraft, startDateTime: '2026-08-10T23:00', endDateTime: '2026-08-11T00:00' }).valid).toBe(true);
    expect(validateEventDraft({ ...baseDraft, allDay: true, startDateTime: '2026-08-10Twrong', endDateTime: '2026-08-11T23:59' }).valid).toBe(false);
  });

  it('odrzuca 24:00 również w serii dat i zachowuje poprawny dzień całodniowy', () => {
    const series = { title: 'Nauka', dates: ['2026-08-10'], startTime: '09:00', endTime: '24:00', allDay: false, category: 'PERSONAL' as const };
    expect(validateManualMultiDateDraft(series).valid).toBe(false);
    expect(validateManualMultiDateDraft({ ...series, endTime: '23:59' }).valid).toBe(true);
    expect(validateEventDraft({ ...baseDraft, allDay: true, startDateTime: '2026-08-10T00:00', endDateTime: '2026-08-11T23:59' }).valid).toBe(true);
  });

  it('odrzuca nieprawidłowe daty i duplikaty w ręcznej serii', () => {
    const draft = { title: 'Nauka', dates: ['2026-10-20'], startTime: '08:00', endTime: '09:00', allDay: false, category: 'PERSONAL' as const };
    expect(validateManualMultiDateDraft(draft).valid).toBe(true);
    expect(validateManualMultiDateDraft({ ...draft, dates: ['2026-02-31'] }).valid).toBe(false);
    expect(validateManualMultiDateDraft({ ...draft, dates: ['2026-10-20', '2026-10-20'] }).valid).toBe(false);
    expect(validateManualMultiDateDraft({ ...draft, dates: ['2028-02-29'] }).valid).toBe(true);
  });
});
