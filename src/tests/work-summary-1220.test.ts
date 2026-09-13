import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../work/WorkSummaryView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');

describe('1.2.0.20 work summary UX', () => {
  it('pokazuje porównanie miesiąca, dni wolne, ostatnie miesiące i rytm pracy', () => {
    expect(view).toContain('względem {formatMonthLabel(previousMonthDate)}');
    expect(view).toContain('dni wolnych');
    expect(view).toContain('Ostatnie miesiące');
    expect(view).toContain('najdłuższa seria dni pracy');
  });

  it('pokazuje procent zgodności z wysłaną dyspozycyjnością', () => {
    expect(view).toContain('work-summary-compliance-head');
    expect(view).toContain('zmian w pełni zgodnych');
  });

  it('zachowuje prosty, responsywny układ', () => {
    expect(styles).toContain('.work-summary-facts-grid');
    expect(styles).toContain('.work-summary-insights');
    expect(styles).toContain('@media (max-width: 760px)');
  });
});
