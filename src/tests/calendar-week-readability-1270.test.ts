import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.70 compact week event readability', () => {
  it('does not reserve event content height for the resize handle', () => {
    expect(css).toContain('/* 1.2.0.70 - resize handle no longer reserves content space in short events */');
    expect(css).not.toContain('.calendar-week-event.resizable { padding-bottom:');
    expect(css).toContain('.calendar-week-resize-handle');
    expect(css).toContain('height: 10px;');
  });

  it('keeps compact hour events readable without changing their geometry', () => {
    expect(css).toContain('.calendar-week-shell.compact-density .calendar-week-event span { font-size: .55rem;');
    expect(css).toContain('font-size: .64rem;');
    expect(css).toContain('white-space: nowrap;');
    expect(css).toContain('text-overflow: ellipsis;');
  });

  it('keeps the database schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
