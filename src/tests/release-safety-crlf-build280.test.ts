import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gate = readFileSync('scripts/release-safety-gate.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('Build280 release safety gate line endings', () => {
  it('normalizes source files before multiline safety checks', () => {
    expect(gate).toContain("readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\\r\\n?/g, '\\n')");
    expect(gate).toContain("readFileSync(url, 'utf8').replace(/\\r\\n?/g, '\\n')");
  });

  it('keeps the mobile drag handoff assertion enabled', () => {
    expect(gate).toContain('active mobile drag can miss local touchmove during listener handoff');
  });
});
