import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const engine = readFileSync(new URL('../shopping/receipt-ocr/ocr-engine.ts', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
const parser = readFileSync(new URL('../shopping/receipt-ocr/receipt-parser.ts', import.meta.url), 'utf8');
const productionSelector = readFileSync(new URL('../shopping/receipt-ocr/receipt-geometry-production-selector.ts', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../../public/service-worker.js', import.meta.url), 'utf8');
const productionAudit = readFileSync(new URL('../../scripts/production-audit.mjs', import.meta.url), 'utf8');

describe('DEV4-A geometry integration contracts', () => {
  it('requests text and blocks from the same Tesseract.js recognize job', () => {
    expect(engine).toContain("activeWorker.recognize(image, {}, { text: true, blocks: true })");
    const recognitionCalls = engine.match(/activeWorker\.recognize\(/gu) ?? [];
    expect(recognitionCalls).toHaveLength(1);
  });

  it('keeps geometry optional and falls back to text when blocks are unavailable', () => {
    expect(engine).toContain('if (!blocks?.length) return []');
    expect(engine).toContain("text: result.data.text ?? ''");
    expect(engine).toContain('...(geometry ? { geometry } : {})');
  });

  it('uses a fail-closed runtime selector with explicit primary fallback and item-only merge', () => {
    expect(flow).toContain('decideReceiptGeometryProductionSelection');
    expect(flow).toContain('let parsedBeforeMerchantRecovery = primaryParsedForGeometrySelection');
    expect(flow).toContain("geometrySelection.decision !== 'KEEP_PRIMARY'");
    expect(flow).toContain('applySelectedReceiptGeometryItems(primaryParsedForGeometrySelection, geometryParsed)');
    expect(flow).toContain("geometrySelection.decision === 'SELECT_STRUCTURED_GEOMETRY'");
    expect(flow).toContain("reason: 'merge-failed'");
    expect(flow).toContain('parsedBeforeMerchantRecovery = primaryParsedForGeometrySelection');
    expect(productionSelector).not.toMatch(/groundTruth|expectedItems|Biedronka|Lidl|Jeronimo/iu);
  });

  it('keeps private geometry debug data DEV-only and transient', () => {
    expect(flow).toContain('if (import.meta.env.DEV)');
    expect(flow).toContain('__IK_PRIVATE_RECEIPT_GEOMETRY__');
    expect(flow).toContain('delete debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__');
    expect(productionAudit).toContain('__IK_PRIVATE_RECEIPT_GEOMETRY__');
  });

  it('keeps the frozen production parser free of DEV4-A merchant/product hard-coding', () => {
    expect(parser).not.toMatch(/NapEner|Jeronimo|Biedronka|Ręcznik|Milla/iu);
  });

  it('keeps row-major and structured geometry results separate for live A/B diagnostics', () => {
    expect(flow).toContain('geometryRowMajorParsed');
    expect(flow).toContain('geometryReconstructedItemsTotalMinor');
    expect(flow).toContain('geometryStructuredTextGenerated');
    expect(flow).toContain('geometryStructuredCandidateAccepted');
    expect(flow).toContain('geometryStructuredCandidateRejectionReasons');
    expect(flow).toContain('geometrySelectionDecision');
    expect(flow).toContain('geometrySelectionReason');
    expect(flow).toContain('geometrySelected');
  });

  it('bumps only the shell cache revision for production JS changes', () => {
    expect(serviceWorker).toContain("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'");
    expect(serviceWorker).toContain("const CACHE_NAME = `${CACHE_PREFIX}v1.1.1`");
  });
});
