import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const availabilityView = fs.readFileSync(path.join(root, 'src/availability/AvailabilityView.tsx'), 'utf8');
const dayEditor = fs.readFileSync(path.join(root, 'src/availability/DayAvailabilityEditor.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/availability/availability.service.ts'), 'utf8');
const optimizer = fs.readFileSync(path.join(root, 'src/availability/optimizer.ts'), 'utf8');

describe('1.2.0.8 compact Work availability UX', () => {
  it('keeps manual day modal focused only on manual hours', () => {
    const manualStart = dayEditor.indexOf('day-manual-availability-editor');
    const automationStart = dayEditor.indexOf("mode === 'automation'");
    expect(manualStart).toBeGreaterThan(automationStart);
    expect(dayEditor).toContain('Wpisz, kiedy możesz pracować');
    expect(availabilityView).toContain("mode: 'manual'");
    expect(availabilityView).toContain("mode: 'automation'");
  });

  it('moves per-day automation exceptions to the automation section', () => {
    expect(availabilityView).toContain('Wyjątki dla poszczególnych dni');
    expect(availabilityView).toContain('availability-day-rule-grid');
    expect(dayEditor).toContain('Ustawienia automatu dla dnia');
  });

  it('does not let automatic-only day rules constrain manual blocks', () => {
    expect(service).toContain("(!manual || item.kind !== 'DAY_RULE')");
    expect(service).toContain('const automaticEligibility = resolveAvailabilityEligibility');
    expect(service).toContain('const manualEligibility = resolveAvailabilityEligibility');
    expect(optimizer).toContain("blockingIntervals: day.blockingIntervals.filter((item) => item.kind !== 'DAY_RULE')");
    expect(optimizer).toContain('allowedStartMinute: 0');
    expect(optimizer).toContain('allowedEndMinute: 1440');
  });
});
