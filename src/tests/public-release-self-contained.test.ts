import { describe, expect, it } from 'vitest';
import { sourceText } from './helpers/source-text';

const releaseSafety = sourceText('scripts/release-safety-gate.mjs');
const sourceAudit = sourceText('src/tests/study-source-audit.optional.test.ts');
const releaseMetadata = sourceText('src/tests/release-metadata-contract.test.ts');

describe('public release self-containment', () => {
  it('does not require private CURRENT_STATE metadata in the sanitized public tree', () => {
    expect(releaseSafety).toContain('const selectedGroups = currentState.activeStudyQaProfile?.selectedGroups;');
    expect(releaseSafety).toContain('const identityGroups = currentState.activeStudyIdentity?.selectedGroups;');
    expect(releaseSafety).not.toContain('assert(Array.isArray(currentState?.activeStudyQaProfile?.selectedGroups)');
  });

  it('keeps optional real-source audit usable without private checkpoint metadata', () => {
    expect(sourceAudit).toContain("existsSync('CURRENT_STATE.json')");
    expect(sourceAudit).toContain(': null;');
    expect(sourceAudit).toContain('if (state?.activeStudySourceFingerprint?.sha256?.toLowerCase() === hash)');
  });

  it('keeps public CI independent from private checkpoint-only metadata files', () => {
    expect(releaseMetadata).toContain("const metadataExists = ['CURRENT_STATE.json', 'BUILD_INFO.json'].every((path) => existsSync(path));");
    expect(releaseMetadata).toContain('if (!metadataExists) return;');
    expect(releaseMetadata).toContain("if (!existsSync('CURRENT_STATE.json') || !existsSync('CURRENT_PROJECT_RULES.md')) return;");
  });
});
