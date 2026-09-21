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

describe('1.2.0.66 today coworker separators', () => {
  it('adds subtle separators between consecutive coworker rows in Today', () => {
    const separator = rule('.today-plan-panel .event-coworker-line + .event-coworker-line');
    expect(separator).toContain('border-top: 1px solid rgba(63,130,146,.10)');
    expect(separator).toContain('padding-top: 6px');
  });

  it('keeps database schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
