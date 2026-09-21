import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const releaseSafety = readFileSync('scripts/release-safety-gate.mjs', 'utf8');
const sourceAudit = readFileSync('src/tests/study-source-audit.optional.test.ts', 'utf8');
const buildMetadataSync = readFileSync('src/tests/build-metadata-sync-12129.test.ts', 'utf8');
const versioningWorkflow = readFileSync('src/tests/versioning-workflow-12133.test.ts', 'utf8');

describe('public release self-containment', () => {
  it('does not require private CURRENT_STATE metadata in the sanitized public tree', () => {
    expect(releaseSafety).toContain('if (currentState) assert(Array.isArray(currentState.activeStudyQaProfile?.selectedGroups)');
    expect(releaseSafety).not.toContain('assert(Array.isArray(currentState?.activeStudyQaProfile?.selectedGroups)');
  });

  it('keeps optional real-source audit usable without private checkpoint metadata', () => {
    expect(sourceAudit).toContain("existsSync('CURRENT_STATE.json')");
    expect(sourceAudit).toContain(": null;");
    expect(sourceAudit).toContain('if (state?.activeStudySourceFingerprint?.sha256?.toLowerCase() === hash)');
  });

  it('keeps public CI independent from private checkpoint-only metadata files', () => {
    expect(buildMetadataSync).toContain("existsSync('BUILD_INFO.json')");
    expect(buildMetadataSync).toContain('if (buildInfo)');
    expect(versioningWorkflow).toContain('hasPrivateCheckpointMetadata');
    expect(versioningWorkflow).toContain('if (state && buildInfo)');
  });
});
