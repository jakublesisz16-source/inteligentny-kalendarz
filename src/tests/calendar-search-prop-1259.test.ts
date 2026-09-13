import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');

describe('1.2.0.60 calendar search regression follow-up', () => {
  it('removes the visible Calendar search dependency entirely so the old missing-prop regression cannot recur', () => {
    expect(calendar).not.toContain('HeaderSearch');
    expect(calendar).not.toContain('onSearch');
  });

  it('does not pass search callbacks into CalendarView anymore', () => {
    expect(app).not.toContain('onOpenAvailability={(date, blockId) => setAvailabilityEditor({ date, ...(blockId ? { blockId } : {}) })} onSearch=');
  });
});
