import { describe, expect, it } from 'vitest';
import type { AvailabilitySentSnapshot } from '../availability/availability.types';
import { compareAvailabilityWithWorkSchedule, selectDefaultSentSnapshot } from '../work/availability-work-comparison';

function snapshot(blocks: AvailabilitySentSnapshot['blocks'], version = 1, createdAt = '2026-08-07T10:00:00.000Z'): AvailabilitySentSnapshot {
  return { id: `sent-${version}`, version, createdAt, totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0), blocks };
}
function block(date:string,startTime:string,endTime:string,minutes:number) { return { date,startTime,endTime,minutes }; }
function shift(id:string,startDateTime:string,endDateTime:string) { return { id,startDateTime,endDateTime }; }

describe('availability vs real work 0.3.3', () => {
  it('recognizes a shift fully within sent availability', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([block('2026-08-18','15:00','21:00',360)]), [shift('w','2026-08-18T16:00','2026-08-18T21:00')]);
    expect(result.perShift[0]?.status).toBe('WITHIN_AVAILABILITY');
    expect(result.perShift[0]?.coveredMinutes).toBe(300);
    expect(result.totalOutsideMinutes).toBe(0);
  });

  it('calculates the exact partial interval outside availability', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([block('2026-08-18','15:00','20:00',300)]), [shift('w','2026-08-18T12:00','2026-08-18T20:00')]);
    expect(result.perShift[0]?.status).toBe('PARTIALLY_OUTSIDE_AVAILABILITY');
    expect(result.perShift[0]?.coveredMinutes).toBe(300);
    expect(result.perShift[0]?.outsideMinutes).toBe(180);
    expect(result.perShift[0]?.uncoveredIntervals[0]).toMatchObject({ startDateTime:'2026-08-18T12:00', endDateTime:'2026-08-18T15:00', minutes:180 });
  });

  it('recognizes a shift fully outside availability', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([block('2026-08-17','12:00','18:00',360)]), [shift('w','2026-08-18T12:00','2026-08-18T18:00')]);
    expect(result.perShift[0]?.status).toBe('OUTSIDE_AVAILABILITY');
    expect(result.perShift[0]?.outsideMinutes).toBe(360);
  });

  it('treats unused availability as information, not a work error', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([block('2026-08-19','12:00','20:00',480)]), []);
    expect(result.shiftCount).toBe(0);
    expect(result.unusedAvailabilityMinutes).toBe(480);
  });

  it('unions touching availability blocks', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([
      block('2026-08-18','12:00','15:00',180), block('2026-08-18','15:00','20:00',300),
    ]), [shift('w','2026-08-18T13:00','2026-08-18T19:00')]);
    expect(result.perShift[0]?.status).toBe('WITHIN_AVAILABILITY');
  });

  it('keeps a real gap between sent blocks uncovered', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([
      block('2026-08-18','12:00','15:00',180), block('2026-08-18','16:00','20:00',240),
    ]), [shift('w','2026-08-18T13:00','2026-08-18T19:00')]);
    expect(result.perShift[0]?.outsideMinutes).toBe(60);
    expect(result.perShift[0]?.uncoveredIntervals).toHaveLength(1);
  });

  it('handles shifts and availability across midnight', () => {
    const result = compareAvailabilityWithWorkSchedule(snapshot([block('2026-08-18','22:00','02:00',240)]), [shift('w','2026-08-18T23:00','2026-08-19T01:00')]);
    expect(result.perShift[0]?.status).toBe('WITHIN_AVAILABILITY');
    expect(result.perShift[0]?.coveredMinutes).toBe(120);
  });

  it('chooses latest sent snapshot before active roster import', () => {
    const v1=snapshot([block('2026-08-18','12:00','16:00',240)],1,'2026-08-01T10:00:00.000Z');
    const v2=snapshot([block('2026-08-18','14:00','18:00',240)],2,'2026-08-05T10:00:00.000Z');
    const v3=snapshot([block('2026-08-18','16:00','20:00',240)],3,'2026-08-09T10:00:00.000Z');
    expect(selectDefaultSentSnapshot([v1,v2,v3],'2026-08-07T12:00:00.000Z')?.version).toBe(2);
  });
});
