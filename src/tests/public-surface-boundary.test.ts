import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const surfaceContract = readFileSync('scripts/public-surface-contract.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('PUBLIC surface boundary', () => {
  it('keeps private fixture-dependent receipt suites out of PUBLIC', () => {
    expect(surfaceContract).toContain("'src/tests/receipt-ocr-b029a-benchmark.test.ts'");
    expect(surfaceContract).toContain("'src/tests/receipt-ocr-dev4b-fix2-local-numeric-verification.test.ts'");
  });

  it('keeps provider-neutral sync regression coverage in PUBLIC', () => {
    expect(surfaceContract).not.toContain("'src/tests/sync-provider-boundary.test.ts'");
  });
});
