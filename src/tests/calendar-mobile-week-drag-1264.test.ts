import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeMobileWeekTargetDayIndex, shouldCancelWeekLongPress } from '../calendar/week-touch-drag';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');

describe('1.2.0.64 mobile long-press week drag', () => {
  it('does not steal normal scrolling before the long press activates', () => {
    expect(shouldCancelWeekLongPress({ x: 100, y: 200 }, { x: 106, y: 205 })).toBe(false);
    expect(shouldCancelWeekLongPress({ x: 100, y: 200 }, { x: 100, y: 217 })).toBe(true);
  });

  it('maps horizontal movement to neighboring days and clamps inside the week', () => {
    expect(computeMobileWeekTargetDayIndex({ startIndex: 2, startX: 180, currentX: 236, viewportWidth: 390 })).toBe(3);
    expect(computeMobileWeekTargetDayIndex({ startIndex: 0, startX: 180, currentX: -500, viewportWidth: 390 })).toBe(0);
    expect(computeMobileWeekTargetDayIndex({ startIndex: 6, startX: 180, currentX: 900, viewportWidth: 390 })).toBe(6);
  });

  it('wires touch long press without opening imported events to movement', () => {
    expect(calendar).toContain('MOBILE_WEEK_LONG_PRESS_MS = 450');
    expect(calendar).toContain('startMobileWeekLongPress');
    expect(calendar).toContain('moveMobileWeekTouchDrag');
    expect(calendar).toContain('finishMobileWeekTouchDrag');
    expect(calendar).toContain('canDragWeekEvent(event)');
    expect(calendar).toContain("inputMode: 'touch'");
    expect(responsive).toContain('1.2.0.64 - long-press drag and drop for safe manual week events on mobile');
  });
});
