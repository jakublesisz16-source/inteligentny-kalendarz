export const PUBLIC_ROOT_FILES = new Set([
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vitest.public.config.ts',
  'CHANNEL_BUILD_INFO.json',
]);

export const PUBLIC_WORKFLOW_FILES = new Set([
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
]);

export const PUBLIC_SCRIPT_FILES = new Set([
  'scripts/production-audit.mjs',
  'scripts/public-package-gate.mjs',
  'scripts/public-surface-contract.mjs',
  'scripts/release-preflight.mjs',
  'scripts/release-safety-gate.mjs',
  'scripts/security-release-gate.mjs',
  'scripts/service-worker-gate.mjs',
  'scripts/source-hygiene-gate.mjs',
  'scripts/channel-fingerprint.mjs',
  'scripts/channel-contract-gate.mjs',
  'scripts/channel-monotonicity-gate.mjs',
  'scripts/study-mobile-smoke.mjs',
  'scripts/travel-release-gate.mjs',
  'scripts/visual-qa-capture.mjs',
]);

export const PRIVATE_ONLY_PUBLIC_TESTS = new Set([
  'src/tests/receipt-ocr-b029a-benchmark.test.ts',
  'src/tests/receipt-ocr-dev4a-gate1-fix2-candidate-safety.test.ts',
  'src/tests/receipt-ocr-dev4a-gate1-recovery1-value-column.test.ts',
  'src/tests/receipt-ocr-dev4a-gate2-ab-validation.test.ts',
  'src/tests/receipt-ocr-dev4a-gate3-production-selector.test.ts',
  'src/tests/receipt-ocr-dev4b-fix1-structured-geometry-selection.test.ts',
  'src/tests/receipt-ocr-dev4b-fix2-local-numeric-verification.test.ts',
  'src/tests/sync-preview-workflow-build280.test.ts',
  'src/tests/release-workflow-build281.test.ts',
]);

export const PUBLIC_PACKAGE_SCRIPTS = new Set([
  'dev', 'build', 'typecheck', 'test', 'check', 'preview',
  'security:release', 'security:public', 'security:dependencies',
  'visual:qa', 'travel:gate', 'release:preflight',
  'test:public', 'check:public', 'study:mobile-smoke', 'source:hygiene',
  'channel:contract', 'channel:monotonicity',
]);

export function isAllowedPublicPath(rel) {
  if (PUBLIC_ROOT_FILES.has(rel) || PUBLIC_WORKFLOW_FILES.has(rel) || PUBLIC_SCRIPT_FILES.has(rel)) return true;
  if (rel.startsWith('public/')) return true;
  if (rel.startsWith('src/')) {
    if (rel.startsWith('src/benchmarks/')) return false;
    if (PRIVATE_ONLY_PUBLIC_TESTS.has(rel)) return false;
    return true;
  }
  return false;
}

export const SYNC_PREVIEW_ROOT_FILES = new Set([
  'firebase.sync-lab.json',
  'SYNC_PREVIEW_INFO.json',
]);

export const SYNC_PREVIEW_WORKFLOW_FILES = new Set([
  '.github/workflows/firebase-sync-preview.yml',
]);

export function isAllowedSyncPreviewPath(rel) {
  return isAllowedPublicPath(rel) || SYNC_PREVIEW_ROOT_FILES.has(rel) || SYNC_PREVIEW_WORKFLOW_FILES.has(rel);
}

