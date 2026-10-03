import { describe, expect, it } from 'vitest';
import { isAllowedPublicPath } from '../../scripts/public-surface-contract.mjs';

describe('Build287 PUBLIC test boundary', () => {
  it('keeps the private release-workflow test out of PUBLIC', () => {
    expect(isAllowedPublicPath('src/tests/release-workflow-simplification-build286.test.ts')).toBe(false);
  });

  it('keeps provider-neutral runtime regression coverage in PUBLIC', () => {
    expect(isAllowedPublicPath('src/tests/sync-provider-boundary-build286.test.ts')).toBe(true);
  });
});
