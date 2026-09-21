import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

function rule(selector: string): string {
  const start = css.lastIndexOf(`${selector} {`);
  if (start < 0) return '';
  const end = css.indexOf('}', start);
  return end < 0 ? '' : css.slice(start, end + 1);
}

describe('1.2.0.41 today outline correction', () => {
  it('keeps the month cell surface unchanged and marks only the date number', () => {
    const todayCell = rule('.calendar-day.today:not(.selected)');
    expect(todayCell).toContain('border-color: var(--line)');
    expect(todayCell).not.toContain('background:');
    expect(rule('.calendar-day.today .day-number')).toContain('border: 1px solid');
  });

  it('does not tint the current week column', () => {
    expect(css).not.toContain('.calendar-week-column.today:not(.selected) {\n  background-color:');
    expect(rule('.calendar-week-day-heading.today strong')).toContain('border: 1px solid');
  });

  it('bumps only the app package version, not the database schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
