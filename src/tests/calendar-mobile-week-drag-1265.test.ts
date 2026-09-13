import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8').replace(/\r\n?/g, '\n');

describe('1.2.0.65 mobile long-press handoff hardening', () => {
  it('handles an already activated drag locally while React installs the window listeners', () => {
    expect(calendar).toContain('if (session.activated) {\n      event.preventDefault();\n      updateMobileWeekTouchPosition(touch);');
    expect(calendar).toContain("window.addEventListener('touchmove', handleTouchMove, { passive: false })");
  });

  it('can commit or cancel an activated drag from the event target without waiting for bubbling', () => {
    expect(calendar).toContain('event?.preventDefault();\n      void commitMobileWeekTouchDrag();');
    expect(calendar).toContain('event?.preventDefault();\n      cancelMobileWeekTouchSession(true);');
  });

  it('keeps mobile resize isolated from the long-press move gesture', () => {
    expect(calendar).toContain('onPointerDown={(pointerEvent) => startWeekResize(pointerEvent, event)}');
  });
});
