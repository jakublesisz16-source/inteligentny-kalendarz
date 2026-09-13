import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const availabilityView = fs.readFileSync(path.join(root, 'src/availability/AvailabilityView.tsx'), 'utf8');
const dayEditor = fs.readFileSync(path.join(root, 'src/availability/DayAvailabilityEditor.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/availability/availability.service.ts'), 'utf8');

describe('1.2.0.6 work availability repair', () => {
  it('exposes direct weekly manual availability inside Work', () => {
    expect(availabilityView).toContain('availability-week-editor');
    expect(availabilityView).toContain('Ustaw ręcznie');
    expect(availabilityView).toContain('<DayAvailabilityEditor');
    expect(dayEditor).toContain('Dodaj godziny');
  });

  it('keeps manual availability independent from optimizer setup', () => {
    expect(service).toContain("mode: 'OPTIMIZER' | 'MANUAL' = 'OPTIMIZER'");
    expect(service).toContain("currentOrShell(weekStart, 'MANUAL')");
    expect(service).toContain("buildAvailabilityInput(weekStart, plan, 'MANUAL')");
    expect(service).toContain("mode === 'OPTIMIZER' && !profile.targetWeeklyWorkMinutes");
  });

  it('opens manual time entry immediately for a selected day', () => {
    expect(dayEditor).toContain('Wpisz, kiedy możesz pracować');
    expect(dayEditor).toContain('Zapisz dyspozycyjność');
    expect(dayEditor).toContain('Wyklucz cały dzień');
  });

  it('does not hide Work availability diagnostics in details accordions', () => {
    expect(availabilityView).not.toContain('<details');
  });
});
