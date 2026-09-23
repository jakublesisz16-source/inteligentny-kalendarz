import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

describe('Build194 Today accent rail cleanup', () => {
  it('removes the decorative left rail from the lightweight next-event strip', () => {
    expect(consistency).toContain('.today-next-strip {');
    expect(consistency).not.toContain('.today-next-strip::before');
    expect(consistency).not.toContain('.today-next-strip.category-work::before');
  });

  it('keeps the Today cleanup after category rails are removed globally', () => {
    expect(components).not.toContain('.event-card::before');
    expect(components).not.toContain('.event-card.category-work::before');
    expect(components).toContain('.event-card.category-work { background:');
  });

  it('reclaims the old rail gutter without shrinking touch targets', () => {
    expect(components).toContain('padding: 16px 18px 17px;');
    expect(responsive).toContain('padding: 12px 11px 13px;');
    expect(consistency).toContain('padding: 7px 2px 10px;');
    expect(consistency).toContain('padding: 6px 1px 8px;');
  });
});
