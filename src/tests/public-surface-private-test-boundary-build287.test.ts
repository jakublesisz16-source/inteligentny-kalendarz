import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const surfaceContract = readFileSync('scripts/public-surface-contract.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('Build287 PUBLIC test boundary', () => {
  it('keeps the private release-workflow test out of PUBLIC', () => {
    expect(surfaceContract).toContain("'src/tests/release-workflow-simplification-build286.test.ts'");
  });

  it('does not classify the provider-neutral runtime regression as private-only', () => {
    expect(surfaceContract).not.toContain("'src/tests/sync-provider-boundary-build286.test.ts'");
  });
});
