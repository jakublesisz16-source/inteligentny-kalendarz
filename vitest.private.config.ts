import { defineConfig } from 'vitest/config';

const privateFixtureTests = [
  'src/tests/receipt-ocr-b029a-benchmark.test.ts',
  'src/tests/receipt-ocr-dev4a-gate1-fix2-candidate-safety.test.ts',
  'src/tests/receipt-ocr-dev4a-gate1-recovery1-value-column.test.ts',
  'src/tests/receipt-ocr-dev4a-gate2-ab-validation.test.ts',
  'src/tests/receipt-ocr-dev4a-gate3-production-selector.test.ts',
  'src/tests/receipt-ocr-dev4b-fix1-structured-geometry-selection.test.ts',
  'src/tests/receipt-ocr-dev4b-fix2-local-numeric-verification.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: privateFixtureTests,
  },
});
