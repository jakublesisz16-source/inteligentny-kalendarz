import { describe, expect, it } from 'vitest';
import { buildOccurrenceKey, buildSeriesKey } from '../study/study-identity';

const base = {
  adapterId: 'nursing-plan-v1',
  sourceSheet: 'PRAKTYKI',
  subject: 'Podstawy pielęgniarstwa',
  activityType: 'Zajęcia praktyczne',
  groupTags: ['13A'],
  clinic: 'Klinika I',
  date: '2026-03-18',
  startTime: '08:00',
};

describe('study identity', () => {
  it('seriesKey nie zależy od daty', () => {
    expect(buildSeriesKey(base)).toBe(buildSeriesKey({ ...base, date: '2026-04-01' }));
  });

  it('inna grupa daje inny seriesKey', () => {
    expect(buildSeriesKey(base)).not.toBe(buildSeriesKey({ ...base, groupTags: ['13B'] }));
  });

  it('inna klinika daje inny seriesKey', () => {
    expect(buildSeriesKey(base)).not.toBe(buildSeriesKey({ ...base, clinic: 'Klinika II' }));
  });

  it('inny rodzaj zajęć daje inny seriesKey', () => {
    expect(buildSeriesKey(base)).not.toBe(buildSeriesKey({ ...base, activityType: 'Seminarium' }));
  });



  it('kosmetyczny wariant zapisu kliniki nie zmienia seriesKey', () => {
    expect(buildSeriesKey(base)).toBe(buildSeriesKey({ ...base, subject: 'podstawy pielęgniarstwa', clinic: 'klinika 1' }));
  });

  it('occurrenceKey rozróżnia konkretne terminy', () => {
    expect(buildOccurrenceKey(base)).not.toBe(buildOccurrenceKey({ ...base, date: '2026-03-25' }));
  });
});
