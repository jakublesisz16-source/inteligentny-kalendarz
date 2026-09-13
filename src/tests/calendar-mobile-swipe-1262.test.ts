import { describe, expect, it } from 'vitest';
import { detectPeriodSwipe } from '../calendar/swipe-navigation';

describe('1.2.0.62 mobile period swipe', () => {
  it('moves forward for a clear left swipe', () => {
    expect(detectPeriodSwipe(
      { x: 320, y: 300, time: 1000 },
      { x: 220, y: 312, time: 1250 },
    )).toBe(1);
  });

  it('moves backward for a clear right swipe', () => {
    expect(detectPeriodSwipe(
      { x: 120, y: 300, time: 1000 },
      { x: 225, y: 292, time: 1260 },
    )).toBe(-1);
  });

  it('ignores vertical scrolls and short horizontal movement', () => {
    expect(detectPeriodSwipe(
      { x: 200, y: 180, time: 1000 },
      { x: 230, y: 320, time: 1300 },
    )).toBe(0);
    expect(detectPeriodSwipe(
      { x: 200, y: 180, time: 1000 },
      { x: 245, y: 182, time: 1200 },
    )).toBe(0);
  });

  it('ignores long presses followed by a drag', () => {
    expect(detectPeriodSwipe(
      { x: 300, y: 200, time: 1000 },
      { x: 190, y: 205, time: 2100 },
    )).toBe(0);
  });
});
