import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.73 compact mobile Calendar add action', () => {
  it('keeps explicit creation separate from selecting a day', () => {
    expect(calendar).toContain('className="button button-primary button-small calendar-mobile-explicit-add"');
    expect(calendar).toContain('onClick={() => onAdd(selectedDate)}>+ Dodaj</button>');
  });

  it('prevents the generic mobile button rule from stretching the header action', () => {
    expect(responsive).toContain('/* 1.2.0.73 - compact explicit add action in the mobile Calendar header */');
    expect(responsive).toContain('width: auto !important;');
    expect(responsive).toContain('flex: 0 0 auto;');
    expect(responsive).toContain('margin-left: auto;');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
