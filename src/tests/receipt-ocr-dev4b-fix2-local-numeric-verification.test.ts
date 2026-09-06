import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OcrRecognitionResult, ParsedReceiptDraft, ReceiptOcrGeometry } from '../shopping/receipt-ocr/receipt-ocr.types';
import {
  evaluateReceiptLocalNumericVerificationShadow,
  extractReceiptLocalNumericCandidate,
  planReceiptLocalNumericVerification,
  promoteReceiptLocalNumericVerification,
  type PlanReceiptLocalNumericVerificationInput,
  type ReceiptLocalNumericVerificationEvidence,
} from '../shopping/receipt-ocr/receipt-local-numeric-verification';
import {
  assessReceiptGeometryStructuredCandidate,
  reconstructReceiptTextFromGeometry,
  type ReceiptGeometryReconstructionResult,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

interface Snapshot {
  geometry: ReceiptOcrGeometry;
  structuredParsed: ParsedReceiptDraft;
  structuredCandidateAccepted: boolean;
  productionSelection: {
    decision: 'SELECT_RECOVERY' | 'SELECT_STRUCTURED_GEOMETRY' | 'KEEP_PRIMARY';
    primaryItemCount: number;
  };
  valueRecovery: { attempted: boolean; used: boolean };
}

function loadFixture(name: string): Snapshot {
  return JSON.parse(readFileSync(
    new URL(`../../_PRIVATE_HISTORY/benchmarks/dev4b/fix2/cases/${name}/browser-live.json`, import.meta.url),
    'utf8',
  )) as Snapshot;
}

const target = loadFixture('biedronka-260806');
const recoveryControl = loadFixture('biedronka-260804');
const weakStructureControl = loadFixture('biedronka-260811');
const photoPoorControl = loadFixture('lidl-260625');
const quantityControl = loadFixture('lidl-260808');

function cloneGeometry(geometry: ReceiptOcrGeometry): ReceiptOcrGeometry {
  return { ...geometry, tokens: geometry.tokens.map((token) => ({ ...token, bbox: { ...token.bbox } })) };
}

function cloneParsed(parsed: ParsedReceiptDraft): ParsedReceiptDraft {
  return {
    ...parsed,
    items: parsed.items.map((item) => ({ ...item, warnings: [...item.warnings] })),
    adjustments: parsed.adjustments.map((entry) => ({ ...entry })),
    warnings: parsed.warnings.map((entry) => ({ ...entry })),
  };
}

function cloneReconstruction(value: ReceiptGeometryReconstructionResult): ReceiptGeometryReconstructionResult {
  return {
    ...value,
    rows: value.rows.map((row) => ({ ...row, bbox: { ...row.bbox }, tokens: [...row.tokens] })),
    items: value.items.map((item) => ({ ...item, sourceRowIndices: [...item.sourceRowIndices], evidence: [...item.evidence] })),
    rejectedRows: value.rejectedRows.map((row) => ({ ...row })),
  };
}

function inputFrom(snapshot: Snapshot): PlanReceiptLocalNumericVerificationInput {
  const reconstruction = reconstructReceiptTextFromGeometry(snapshot.geometry);
  const assessment = assessReceiptGeometryStructuredCandidate(reconstruction, snapshot.structuredParsed);
  return {
    geometry: snapshot.geometry,
    reconstruction,
    geometryCandidate: snapshot.structuredParsed,
    structuredAssessment: assessment,
    primaryItemCount: snapshot.productionSelection.primaryItemCount,
    productionDecision: snapshot.productionSelection.decision,
    recoveryAttempted: snapshot.valueRecovery.attempted,
    recoveryUsed: snapshot.valueRecovery.used,
  };
}

function targetInput(): PlanReceiptLocalNumericVerificationInput {
  return inputFrom(target);
}

function goodEvidence(plan = planReceiptLocalNumericVerification(targetInput())): ReceiptLocalNumericVerificationEvidence[] {
  return plan.cells.map((cell) => ({
    cellId: cell.id,
    rawText: cell.itemName.includes('PestoGusto') ? '7.55' : '3,15',
    candidate: cell.itemName.includes('PestoGusto')
      ? { raw: '7.55', minor: 755, confidence: 74.286369, ambiguous: false }
      : { raw: '3,15', minor: 315, confidence: 96.74395, ambiguous: false },
  }));
}

describe('DEV4-B-FIX2 local numeric verification planning', () => {
  it('triggers on the confirmed 06.08 complete-but-financially-inconsistent receipt', () => {
    const plan = planReceiptLocalNumericVerification(targetInput());
    expect(plan).toMatchObject({
      eligible: true,
      independentGoodsTotalMinor: 7665,
      beforeItemsTotalMinor: 7713,
      beforeDifferenceMinor: 48,
      suspectCellCount: 2,
    });
    expect(plan.cells.map((cell) => [cell.itemName, cell.primaryRaw, cell.primaryMinor])).toEqual([
      ['PestoGustoBel190g', '7,99', 799],
      ['Banan Luz', '3,19', 319],
    ]);
  });

  it('does not trigger when the receipt is financially consistent', () => {
    const input = targetInput();
    input.geometryCandidate = cloneParsed(input.geometryCandidate);
    input.geometryCandidate.ocrSubtotalMinor = input.reconstruction.itemsTotalMinor;
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'financially-consistent' });
  });

  it('does not trigger when structured geometry is rejected', () => {
    const input = targetInput();
    input.structuredAssessment = { ...input.structuredAssessment!, accepted: false, rejectionReasons: ['low-completeness'] };
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'structured-candidate-rejected' });
  });

  it('does not trigger with unresolved item rows', () => {
    const input = targetInput();
    input.reconstruction = cloneReconstruction(input.reconstruction);
    delete input.reconstruction.items[0]!.finalAmountMinor;
    input.reconstruction.completeItemCount -= 1;
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'reconstruction-incomplete' });
  });

  it('does not trigger with a quantity-unresolved item', () => {
    const input = targetInput();
    input.reconstruction = cloneReconstruction(input.reconstruction);
    input.reconstruction.items[0]!.unresolvedReason = 'quantity-unresolved';
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'reconstruction-incomplete' });
  });

  it('fails closed on source-row reuse / page-isolation ambiguity', () => {
    const input = targetInput();
    input.reconstruction = cloneReconstruction(input.reconstruction);
    input.reconstruction.items[1]!.sourceRowIndices = [...input.reconstruction.items[0]!.sourceRowIndices];
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'source-row-reuse' });
  });

  it('does not trigger when geometry has fewer items than primary', () => {
    const input = inputFrom(weakStructureControl);
    input.productionDecision = 'KEEP_PRIMARY';
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'structure-not-competitive' });
  });

  it('does not trigger without an independent goods total', () => {
    const input = targetInput();
    input.geometryCandidate = cloneParsed(input.geometryCandidate);
    delete input.geometryCandidate.ocrSubtotalMinor;
    delete input.geometryCandidate.depositTotalMinor;
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'independent-goods-total-missing' });
  });

  it('fails closed when more than two value cells are suspicious', () => {
    const input = targetInput();
    input.geometry = cloneGeometry(input.geometry);
    const valueAnchor = input.reconstruction.columns!.anchors.value!;
    const candidate = input.geometry.tokens.find((token) => {
      const center = (token.bbox.x0 + token.bbox.x1) / 2;
      return token.page === 1 && token.bbox.y0 === 1440 && Math.abs(center - valueAnchor) < 100;
    });
    expect(candidate).toBeDefined();
    candidate!.confidence = 20;
    input.reconstruction = reconstructReceiptTextFromGeometry(input.geometry);
    input.structuredAssessment = assessReceiptGeometryStructuredCandidate(input.reconstruction, input.geometryCandidate);
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'too-many-suspects', suspectCellCount: 3 });
  });

  it('derives each crop from the suspect token geometry and keeps it before the footer boundary', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const boundary = input.reconstruction.rows[input.reconstruction.itemSectionEndRowIndex!];
    expect(boundary).toBeDefined();
    for (const cell of plan.cells) {
      expect(cell.crop.x0).toBeLessThan(cell.tokenBbox.x0);
      expect(cell.crop.x1).toBeGreaterThan(cell.tokenBbox.x1);
      expect(cell.crop.y0).toBeLessThan(cell.tokenBbox.y0);
      expect(cell.crop.y1).toBeGreaterThan(cell.tokenBbox.y1);
      expect(cell.crop.y1).toBeLessThan(boundary!.bbox.y0);
      expect(cell.pixelCount).toBeLessThan(50_000);
    }
  });

  it('does not steal the existing SELECT_RECOVERY path', () => {
    const input = inputFrom(recoveryControl);
    expect(input.productionDecision).toBe('SELECT_RECOVERY');
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'production-path-selected' });
  });

  it('does not steal SELECT_STRUCTURED_GEOMETRY', () => {
    const input = targetInput();
    input.productionDecision = 'SELECT_STRUCTURED_GEOMETRY';
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'production-path-selected' });
  });

  it('leaves the poor Lidl photo for review instead of expanding the experiment', () => {
    const input = inputFrom(photoPoorControl);
    input.productionDecision = 'KEEP_PRIMARY';
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'geometry-source' });
  });

  it('leaves the Lidl quantity corruption outside FIX2 scope', () => {
    const input = inputFrom(quantityControl);
    input.productionDecision = 'KEEP_PRIMARY';
    expect(planReceiptLocalNumericVerification(input)).toMatchObject({ eligible: false, reason: 'geometry-source' });
  });
});

describe('DEV4-B-FIX2 local OCR candidate extraction', () => {
  function result(tokens: Array<{ text: string; confidence: number }>, confidence = 80): OcrRecognitionResult {
    return {
      text: tokens.map((token) => token.text).join(' '),
      confidence,
      geometry: {
        source: 'local-numeric-verification',
        imageWidth: 200,
        imageHeight: 100,
        tokens: tokens.map((token, index) => ({
          ...token,
          page: 1,
          bbox: { x0: 10 + index * 50, y0: 10, x1: 50 + index * 50, y1: 50 },
          source: 'local-numeric-verification',
        })),
      },
    };
  }

  it('extracts a single money-like candidate', () => {
    expect(extractReceiptLocalNumericCandidate(result([{ text: '7.55', confidence: 91 }]))).toEqual({ raw: '7.55', minor: 755, confidence: 91, ambiguous: false });
  });

  it('rejects letter-heavy local OCR', () => {
    expect(extractReceiptLocalNumericCandidate(result([{ text: 'T,SS', confidence: 99 }]))).toBeUndefined();
  });

  it('rejects an absurd local amount', () => {
    expect(extractReceiptLocalNumericCandidate(result([{ text: '999999,99', confidence: 99 }]))).toBeUndefined();
  });

  it('marks close competing numeric candidates ambiguous instead of using the receipt total as tie-breaker', () => {
    expect(extractReceiptLocalNumericCandidate(result([
      { text: '7,55', confidence: 91 },
      { text: '7,59', confidence: 86 },
    ]))).toMatchObject({ raw: '7,55', minor: 755, ambiguous: true });
  });
});

describe('DEV4-B-FIX2 shadow substitution safety', () => {
  it('accepts the two independently stronger CLI-reference values only in shadow and reaches 76.65', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, goodEvidence(plan));
    expect(result.productionApplied).toBe(false);
    expect(result.acceptedReplacementCount).toBe(2);
    expect(result.cells.every((cell) => cell.shadowAccepted)).toBe(true);
    expect(result.before).toMatchObject({ itemsTotalMinor: 7713, independentGoodsTotalMinor: 7665, differenceMinor: 48, financiallyConsistent: false });
    expect(result.afterShadow).toMatchObject({ itemsTotalMinor: 7665, independentGoodsTotalMinor: 7665, differenceMinor: 0, financiallyConsistent: true });
    expect(result.shadowReconstruction?.items).toHaveLength(11);
    expect(result.shadowReconstruction?.completeItemCount).toBe(11);
  });

  it('rejects a lower-quality reread', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const evidence = goodEvidence(plan);
    evidence[0] = { ...evidence[0]!, candidate: { raw: '7,55', minor: 755, confidence: 40, ambiguous: false } };
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, evidence);
    expect(result.cells[0]).toMatchObject({ decision: 'local-evidence-not-stronger', shadowAccepted: false });
  });

  it('rejects an ambiguous reread even if one candidate would close the total', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const evidence = goodEvidence(plan);
    evidence[0] = { ...evidence[0]!, candidate: { raw: '7,55', minor: 755, confidence: 95, ambiguous: true } };
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, evidence);
    expect(result.cells[0]).toMatchObject({ decision: 'ambiguous-candidate', shadowAccepted: false });
  });

  it('does not synthesize a missing value from the independent total', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, []);
    expect(result.acceptedReplacementCount).toBe(0);
    expect(result.afterShadow.itemsTotalMinor).toBe(7713);
  });

  it('rejects a strong but financially-worsening local value after selecting it by OCR evidence alone', () => {
    const input = targetInput();
    const plan = planReceiptLocalNumericVerification(input);
    const evidence = goodEvidence(plan);
    evidence[0] = { ...evidence[0]!, candidate: { raw: '9,55', minor: 955, confidence: 99, ambiguous: false } };
    evidence[1] = { cellId: plan.cells[1]!.id, rawText: '' };
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, evidence);
    expect(result.cells[0]).toMatchObject({ decision: 'financial-mismatch-not-improved', shadowAccepted: false });
    expect(result.afterShadow.itemsTotalMinor).toBe(7713);
  });

  it('never changes the production geometry object or production decision in experiment mode', () => {
    const input = targetInput();
    const originalTokenTexts = input.geometry.tokens.map((token) => token.text);
    const plan = planReceiptLocalNumericVerification(input);
    const result = evaluateReceiptLocalNumericVerificationShadow(input.geometry, input.reconstruction, plan, goodEvidence(plan));
    expect(input.geometry.tokens.map((token) => token.text)).toEqual(originalTokenTexts);
    expect(result.productionApplied).toBe(false);
    expect(target.productionSelection.decision).toBe('KEEP_PRIMARY');
  });

  it('is merchant-agnostic because the planner consumes geometry/financial evidence, not merchant names', () => {
    const first = targetInput();
    const second = targetInput();
    first.geometryCandidate = { ...first.geometryCandidate, merchant: 'Sklep Alfa' };
    second.geometryCandidate = { ...second.geometryCandidate, merchant: 'Dowolny Sprzedawca' };
    expect(planReceiptLocalNumericVerification(first).cells.map((cell) => cell.id)).toEqual(planReceiptLocalNumericVerification(second).cells.map((cell) => cell.id));
  });
});

describe('DEV4-B-FIX2 runtime budget contract', () => {
  it('keeps the browser flow bounded to one local OCR call per planned cell with no full-image retry', () => {
    const source = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    expect(source).toContain("'local-numeric-verification'");
    expect(source).toContain('for (let index = 0; index < numericPlan.cells.length; index += 1)');
    expect(source).toContain('numericVerificationPasses += 1');
    expect(source).toContain('promoteReceiptLocalNumericVerification({');
    expect(source).toContain('numericVerificationProduction.productionApplied');
    expect(source).not.toContain("shouldRetryReceiptOcr(localResult");
  });
});


describe('DEV4-B-FIX2-GATE1 production promotion', () => {
  function productionEvidence(plan: ReturnType<typeof planReceiptLocalNumericVerification>): ReceiptLocalNumericVerificationEvidence[] {
    return plan.cells.map((cell) => ({
      cellId: cell.id,
      rawText: cell.itemName.includes('PestoGusto') ? '7,55' : '3,15',
      candidate: cell.itemName.includes('PestoGusto')
        ? { raw: '7,55', minor: 755, confidence: 96, ambiguous: false }
        : { raw: '3,15', minor: 315, confidence: 90, ambiguous: false },
    }));
  }

  function promotionFixture(evidenceFactory = productionEvidence) {
    const plannerInput = targetInput();
    const plan = planReceiptLocalNumericVerification(plannerInput);
    const shadow = evaluateReceiptLocalNumericVerificationShadow(
      plannerInput.geometry,
      plannerInput.reconstruction,
      plan,
      evidenceFactory(plan),
    );
    const preShadowCandidate = parseReceiptText(plannerInput.reconstruction.text);
    const shadowCandidate = shadow.shadowReconstruction ? parseReceiptText(shadow.shadowReconstruction.text) : undefined;
    const primary = cloneParsed(preShadowCandidate);
    return { plannerInput, plan, shadow, preShadowCandidate, shadowCandidate, primary };
  }

  it('promotes against the exact raw browser primary text with a damaged deposit summary terminator', () => {
    const fixture = promotionFixture();
    const primary = parseReceiptText([
      'Biedronka',
      'Codziennie niskie ceny',
      'BIEDRONKA "CODZIENNIE NISKIE CENY" 7864',
      '61-131 POZNAN UL. POLANKA 2/02 3',
      'JERONIMO MARTINS POLSKA S.A.',
      '62-025 KOSTRZYN UL.ZNIWNA 5',
      'NIP 7791011327',
      'nr: 367975',
      'PARAGON FISKALNY',
      'Nazwa PTU Ilość Cena Wartość',
      'LoDiuDuoWan-Tru120ml (©; 1x 1,49 1,49',
      'FrytZigźag900g [e 1x 10,39 10,39',
      'PierogiRuskie800g | e, 1x 7,49 7,49',
      'Jaja W Wyb M10Oszt c 1x 13,49 13,49',
      'SokMandarynRivPet1l C 1X 47/9 4,79',
      'WodaNgPrimavera1l A 2x 1,49 2,98',
      'Tost Maślany 500g C 1x 3,99 3,99',
      'Fil Z Piersi K kg Cc 0,602x 25,49 15,34',
      'PestoZielones$K190g B 1x 5,99 5,99',
      'PestoGustoBel190g B 1x 7,99 7,99',
      'Banan Luz C 0,450 x 6,99 3,19',
      'Sprzedaż opodatkowana A 2,98',
      'Sprzedaż opodatkowana B 13,54',
      'Sprzedaż opodatkowana C 60,13',
      'PTU A 23% 0,56',
      'PTU B 8% 1,00',
      'PTU C 5% 2,86',
      'Suma PTU 4,42',
      'Suma PLN 76,65',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'But Plastik kaucja 3X 0,50 1,50',
      'OPAKOWANIA ZWBOTNE SIIMA 1 50)',
      'DO ZAPŁATY 78,15 PLN',
      'Bon 4.00',
      'Karta płatnicza 74,15',
      'Numer transakcji 5110',
      'Numer 1864260806511012',
      'Numer kasy 12',
      'Numer kasjera 13',
      'Data 06/08/2026 18:24:06',
    ].join('\n'));

    expect(primary).toMatchObject({
      ocrSubtotalMinor: 7665,
      depositTotalMinor: 150,
      finalPayableMinor: 7815,
      paymentTotalMinor: 7815,
      detectedItemsTotalMinor: 7713,
      unexplainedDifferenceMinor: 48,
    });

    const result = promoteReceiptLocalNumericVerification({
      primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    });

    expect(result).toMatchObject({
      productionApplied: true,
      reason: 'applied',
      verifiedItemsTotalMinor: 7665,
      depositTotalMinor: 150,
      finalPayableMinor: 7815,
      paymentTotalMinor: 7815,
      unexplainedDifferenceMinor: 0,
    });
  });

  it('promotes the confirmed 06.08 browser values only after full goods + deposit + payment reconciliation', () => {
    const fixture = promotionFixture();
    expect(fixture.preShadowCandidate).toMatchObject({
      ocrSubtotalMinor: 7665,
      depositTotalMinor: 150,
      finalPayableMinor: 7815,
      paymentTotalMinor: 7815,
      detectedItemsTotalMinor: 7713,
      unexplainedDifferenceMinor: 48,
    });
    const result = promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    });
    expect(result).toMatchObject({
      productionApplied: true,
      reason: 'applied',
      verifiedItemsTotalMinor: 7665,
      depositTotalMinor: 150,
      finalPayableMinor: 7815,
      paymentTotalMinor: 7815,
      unexplainedDifferenceMinor: 0,
    });
    expect(result.parsed?.detectedItemsTotalMinor).toBe(7665);
    expect(result.parsed?.items.find((item) => item.name.includes('PestoGusto'))?.amountMinor).toBe(755);
    expect(result.parsed?.items.find((item) => item.name === 'Banan Luz')?.amountMinor).toBe(315);
    expect(result.parsed?.items.find((item) => item.name.includes('PestoZielone'))?.amountMinor).toBe(599);
    expect(result.parsed?.items.find((item) => item.name.includes('Fil Z Piersi'))?.amountMinor).toBe(1534);
  });

  it('does not apply a partial 1/2 local correction set', () => {
    const fixture = promotionFixture((plan) => {
      const evidence = productionEvidence(plan);
      evidence[1] = { cellId: plan.cells[1]!.id, rawText: '' };
      return evidence;
    });
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false, reason: 'partial-replacement' });
  });

  it('does not apply when both local candidates improve but do not close the goods mismatch', () => {
    const fixture = promotionFixture((plan) => plan.cells.map((cell) => ({
      cellId: cell.id,
      rawText: cell.itemName.includes('PestoGusto') ? '7,57' : '3,15',
      candidate: cell.itemName.includes('PestoGusto')
        ? { raw: '7,57', minor: 757, confidence: 96, ambiguous: false }
        : { raw: '3,15', minor: 315, confidence: 90, ambiguous: false },
    })));
    expect(fixture.shadow.acceptedReplacementCount).toBe(2);
    expect(fixture.shadow.afterShadow.differenceMinor).toBe(2);
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false, reason: 'shadow-financial-mismatch' });
  });

  it('requires one actual local OCR pass for every suspect cell', () => {
    const fixture = promotionFixture();
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 1,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false, reason: 'pass-count-unsafe' });
  });

  it('does not steal SELECT_RECOVERY or SELECT_STRUCTURED_GEOMETRY', () => {
    const fixture = promotionFixture();
    for (const productionDecision of ['SELECT_RECOVERY', 'SELECT_STRUCTURED_GEOMETRY'] as const) {
      expect(promoteReceiptLocalNumericVerification({
        primary: fixture.primary,
        preShadowCandidate: fixture.preShadowCandidate,
        originalReconstruction: fixture.plannerInput.reconstruction,
        shadowCandidate: fixture.shadowCandidate,
        plan: fixture.plan,
        shadow: fixture.shadow,
        passCount: 2,
        productionDecision,
      })).toMatchObject({ productionApplied: false, reason: 'production-path-selected' });
    }
  });

  it('fails closed if safe deposit evidence disappears after local item OCR', () => {
    const fixture = promotionFixture();
    const shadowCandidate = cloneParsed(fixture.shadowCandidate!);
    delete shadowCandidate.depositTotalMinor;
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false });
  });

  it('fails closed on deposit/footer conflict instead of choosing the balancing value', () => {
    const fixture = promotionFixture();
    const shadowCandidate = cloneParsed(fixture.shadowCandidate!);
    shadowCandidate.depositTotalMinor = 100;
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false, reason: 'footer-evidence-regression' });
  });

  it('fails closed when payments no longer reconcile with final payable', () => {
    const fixture = promotionFixture();
    const shadowCandidate = cloneParsed(fixture.shadowCandidate!);
    shadowCandidate.paymentTotalMinor = 7700;
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false });
  });

  it('fails closed on source-row ownership regression', () => {
    const fixture = promotionFixture();
    fixture.shadow.shadowReconstruction = cloneReconstruction(fixture.shadow.shadowReconstruction!);
    fixture.shadow.shadowReconstruction.items[1]!.sourceRowIndices = [...fixture.shadow.shadowReconstruction.items[0]!.sourceRowIndices];
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate: fixture.shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    })).toMatchObject({ productionApplied: false, reason: 'shadow-source-row-reuse' });
  });

  it('does not synthesize deposit or item money from final-goods differences', () => {
    const fixture = promotionFixture();
    const shadowCandidate = cloneParsed(fixture.shadowCandidate!);
    delete shadowCandidate.depositTotalMinor;
    shadowCandidate.finalPayableMinor = 7815;
    shadowCandidate.paymentTotalMinor = 7815;
    expect(promoteReceiptLocalNumericVerification({
      primary: fixture.primary,
      preShadowCandidate: fixture.preShadowCandidate,
      originalReconstruction: fixture.plannerInput.reconstruction,
      shadowCandidate,
      plan: fixture.plan,
      shadow: fixture.shadow,
      passCount: 2,
      productionDecision: 'KEEP_PRIMARY',
    }).productionApplied).toBe(false);
  });

  it('keeps GATE1 merchant-agnostic and contains no receipt-specific price repair literals', () => {
    const source = readFileSync(new URL('../shopping/receipt-ocr/receipt-local-numeric-verification.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Biedronka|Lidl|PestoGusto|Banan Luz|Polanka/iu);
    expect(source).not.toContain('48 gr');
    expect(source).not.toContain('difference is 0.48');
  });
});
