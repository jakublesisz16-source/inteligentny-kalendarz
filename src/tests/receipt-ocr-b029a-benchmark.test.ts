import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aggregateReceiptBenchmark,
  evaluateReceiptBenchmarkCase,
  matchBenchmarkItems,
  normalizeBenchmarkText,
  validateReceiptBenchmarkManifest,
  validateReceiptGroundTruth,
  type BenchmarkDetectedReceipt,
  type ReceiptBenchmarkCase,
  type ReceiptGroundTruth,
} from '../benchmarks/receipt-benchmark';

const benchmarkCase: ReceiptBenchmarkCase = {
  id: 'synthetic',
  title: 'Synthetic',
  sourceFile: 'sources/synthetic.png',
  rawOcrFile: 'raw-ocr/synthetic.txt',
  sourceType: 'photo-good',
  layoutType: 'linear',
  groundTruthFile: 'ground-truth/synthetic.json',
  tags: [],
  private: true,
  groundTruthVerified: true,
};

function groundTruth(items: ReceiptGroundTruth['items']): ReceiptGroundTruth {
  return { private: true, groundTruthVerified: true, items };
}

function detected(items: BenchmarkDetectedReceipt['items']): BenchmarkDetectedReceipt {
  return { items, reviewReconciled: false };
}

describe('DEV3-B029A private receipt benchmark harness', () => {
  it('validates the committed private manifest and unique verified case ids', () => {
    const file = path.join(process.cwd(), '_PRIVATE_HISTORY', 'benchmarks', 'b029a', 'manifest.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as { cases: ReceiptBenchmarkCase[] };
    expect(validateReceiptBenchmarkManifest(manifest.cases)).toEqual([]);
    expect(manifest.cases.length).toBeGreaterThanOrEqual(9);
  });

  it('rejects unverified or malformed ground truth', () => {
    expect(validateReceiptGroundTruth({ private: true, groundTruthVerified: true, items: [{ name: 'A', finalAmountMinor: 100 }] })).toEqual([]);
    expect(validateReceiptGroundTruth({ private: true, groundTruthVerified: true, date: '04/08/2026', items: [] })).toContain('ground truth date must use YYYY-MM-DD');
  });

  it('normalizes diacritics and common OCR bar/l confusion only for benchmark matching', () => {
    expect(normalizeBenchmarkText('Banan Łuz | 1l')).toBe('banan luz l 1l');
    expect(normalizeBenchmarkText('Łódź')).toBe('lodz');
    expect(normalizeBenchmarkText('bułka')).toBe('bulka');
    expect(normalizeBenchmarkText('Banan 1,5l')).toBe('banan 1 5l');
  });

  it('does not assign duplicate equal-amount ground truth items to one detected item', () => {
    const matches = matchBenchmarkItems(
      [
        { name: 'Milk A', finalAmountMinor: 500 },
        { name: 'Milk B', finalAmountMinor: 500 },
      ],
      [
        { name: 'Milk A', finalAmountMinor: 500 },
        { name: 'Milk B', finalAmountMinor: 500 },
      ],
    );
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((match) => match.detectedIndex)).size).toBe(2);
  });

  it('matches a conservative OCR name corruption when the amount is exact', () => {
    const matches = matchBenchmarkItems(
      [{ name: 'Banan Luz', finalAmountMinor: 224 }],
      [{ name: 'Banan Lu2', finalAmountMinor: 224 }],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.amountCorrect).toBe(true);
  });

  it('can match the item identity while separately failing the amount metric', () => {
    const result = evaluateReceiptBenchmarkCase(
      benchmarkCase,
      groundTruth([{ name: 'Banan Luz', finalAmountMinor: 224 }]),
      detected([{ name: 'Banan Luz', finalAmountMinor: 2240 }]),
    );
    expect(result.metrics.itemRecall).toBe(1);
    expect(result.metrics.itemAmountAccuracy).toBe(0);
    expect(result.errors).toContain('ITEM_AMOUNT_WRONG');
  });

  it('penalizes false fiscal/footer items through item precision', () => {
    const result = evaluateReceiptBenchmarkCase(
      benchmarkCase,
      groundTruth([{ name: 'Real Product', finalAmountMinor: 1000 }]),
      detected([
        { name: 'Real Product', finalAmountMinor: 1000 },
        { name: 'PTU C', finalAmountMinor: 500 },
        { name: 'SUMA', finalAmountMinor: 1500 },
      ]),
    );
    expect(result.metrics.itemRecall).toBe(1);
    expect(result.metrics.itemPrecision).toBeCloseTo(1 / 3, 6);
    expect(result.errors).toContain('ITEM_FALSE_POSITIVE');
  });

  it('marks false Zgodne when review arithmetic reconciles a structurally wrong receipt', () => {
    const expected: ReceiptGroundTruth = {
      private: true,
      groundTruthVerified: true,
      items: [{ name: 'Expected', finalAmountMinor: 1563 }],
      finalTotalMinor: 1563,
    };
    const current: BenchmarkDetectedReceipt = {
      items: [{ name: 'Wrong', finalAmountMinor: 300 }],
      finalTotalMinor: 300,
      reviewReconciled: true,
    };
    const result = evaluateReceiptBenchmarkCase(benchmarkCase, expected, current);
    expect(result.metrics.falseReconciled).toBe(true);
    expect(result.errors).toContain('FALSE_RECONCILIATION');
  });

  it('distinguishes safe unresolved merchant from a wrong confident merchant', () => {
    const expected: ReceiptGroundTruth = {
      private: true,
      groundTruthVerified: true,
      merchant: { displayName: 'Example Shop' },
      items: [],
    };
    const safe = evaluateReceiptBenchmarkCase(benchmarkCase, expected, {
      items: [],
      merchantConfidence: 'low',
      reviewReconciled: false,
    });
    const wrong = evaluateReceiptBenchmarkCase(benchmarkCase, expected, {
      merchant: 'Random Footer',
      merchantConfidence: 'high',
      items: [],
      reviewReconciled: false,
    });
    expect(safe.metrics.merchantIdentityCorrect).toBe(false);
    expect(safe.metrics.wrongConfidentMerchant).toBe(false);
    expect(wrong.metrics.wrongConfidentMerchant).toBe(true);
  });

  it('aggregates source/layout metrics and ranks failure classes', () => {
    const expected = groundTruth([{ name: 'A', finalAmountMinor: 100 }]);
    const pass = evaluateReceiptBenchmarkCase(benchmarkCase, expected, detected([{ name: 'A', finalAmountMinor: 100 }]));
    const fail = evaluateReceiptBenchmarkCase(
      { ...benchmarkCase, id: 'fail', sourceType: 'photo-poor', layoutType: 'marketing-tail' },
      expected,
      detected([]),
    );
    const aggregate = aggregateReceiptBenchmark([pass, fail]);
    expect(aggregate.overall.itemRecall).toBe(0.5);
    expect(aggregate.bySourceType['photo-good']?.cases).toBe(1);
    expect(aggregate.byLayoutType['marketing-tail']?.cases).toBe(1);
    expect(aggregate.failureClasses[0]?.count).toBeGreaterThan(0);
  });

  it('keeps private benchmark paths out of production imports', () => {
    const productionFiles = [
      'src/main.tsx',
      'src/shopping/receipt-ocr/ReceiptScanFlow.tsx',
      'src/shopping/receipt-ocr/ocr-engine.ts',
      'src/shopping/receipt-ocr/receipt-parser.ts',
    ];
    for (const relative of productionFiles) {
      const content = readFileSync(path.join(process.cwd(), relative), 'utf8');
      expect(content).not.toContain('_PRIVATE_HISTORY/benchmarks');
      expect(content).not.toContain('B029A-CORPUS');
      expect(content).not.toContain('DEV4A-GEOMETRY');
      expect(content).not.toContain('_PRIVATE_HISTORY/benchmarks/dev4a');
    }
  });
});
