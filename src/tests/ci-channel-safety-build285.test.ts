import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n?/g, '\n');
const preflight = readFileSync('scripts/release-preflight.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('Build285 channel-aware CI package safety', () => {
  it('routes exact known surfaces to their bounded package gates', () => {
    expect(ci).toContain("JSON.parse(fs.readFileSync('CHANNEL_BUILD_INFO.json','utf8')).surface");
    expect(ci).toContain('sync-preview) npm run security:sync-preview');
    expect(ci).toContain('public-stable) npm run security:public');
  });

  it('fails closed instead of guessing when channel identity is unknown', () => {
    expect(ci).toContain('Unknown channel surface: $SURFACE');
    expect(ci).toContain('exit 1');
    expect(preflight).toContain("CI channel safety routing must fail closed for unknown surfaces");
  });
});
