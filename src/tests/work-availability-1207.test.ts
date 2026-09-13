import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const availabilityView = fs.readFileSync(path.join(root, 'src/availability/AvailabilityView.tsx'), 'utf8');
const dayEditor = fs.readFileSync(path.join(root, 'src/availability/DayAvailabilityEditor.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles/components.css'), 'utf8');

describe('1.2.0.7 manual-first Work availability UX', () => {
  it('keeps manual weekly availability before optional automation', () => {
    expect(availabilityView.indexOf('availability-week-editor')).toBeLessThan(availabilityView.indexOf('availability-automation-panel'));
    expect(availabilityView).toContain('Automatyczne propozycje');
    expect(availabilityView).toContain('Ręczny wpis lub wyjątek ma zawsze pierwszeństwo');
  });

  it('does not show the old optimizer banner above manual time inputs', () => {
    expect(dayEditor).not.toContain('availability-safe-preview');
    expect(dayEditor).not.toContain('availability-auto-default');
    expect(dayEditor).toContain('Wpisz, kiedy możesz pracować');
    expect(dayEditor).toContain('Wolne okna w kalendarzu:');
  });

  it('keeps day automation settings clearly optional and visible', () => {
    expect(dayEditor).toContain("mode === 'automation'");
    expect(dayEditor).toContain('Ustawienia automatu dla dnia');
    expect(dayEditor).toContain('Wyklucz cały dzień');
  });

  it('uses the pink product accent in Work summary instead of category teal', () => {
    expect(styles).toContain('.work-summary-total strong { color: var(--accent-strong);');
    expect(styles).toContain('background: var(--accent); opacity: .72;');
  });
});
