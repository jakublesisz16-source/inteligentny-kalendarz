import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.71 mobile Today readability', () => {
  it('keeps compact time ranges separated from the event title on phones', () => {
    expect(responsive).toContain('/* 1.2.0.71 - mobile Today work-card readability */');
    expect(responsive).toContain('grid-template-columns: 72px minmax(0, 1fr);');
    expect(responsive).toContain('column-gap: 12px;');
    expect(responsive).toContain('font-size: .82rem;');
  });

  it('keeps coworker rows calm and scannable instead of table-heavy', () => {
    expect(responsive).toContain('grid-template-columns: minmax(0, 1fr) max-content;');
    expect(responsive).toContain('border-top-color: rgba(63,130,146,.07);');
    expect(responsive).toContain('font-weight: 700;');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
