import type { ParsedReceiptDraft, ReceiptOcrQuality } from './receipt-ocr.types';

export interface ReceiptStrictGateResult {
  parsed: ParsedReceiptDraft;
  merchantRejected: boolean;
  itemBlockRejected: boolean;
}

function goodsTargetMinor(parsed: ParsedReceiptDraft): number | undefined {
  if (parsed.declaredSubtotalMinor !== undefined) return parsed.declaredSubtotalMinor;
  if (parsed.declaredTotalMinor !== undefined && parsed.depositTotalMinor !== undefined) {
    return parsed.declaredTotalMinor - parsed.depositTotalMinor;
  }
  return parsed.declaredTotalMinor;
}

function warningExists(parsed: ParsedReceiptDraft, code: ParsedReceiptDraft['warnings'][number]['code']): boolean {
  return parsed.warnings.some((warning) => warning.code === code);
}

/**
 * Conservative review-only gate. It never invents OCR data. Weak single-source
 * fields are removed when the selected OCR candidate is globally damaged, while
 * later independent header recovery may still restore a merchant.
 */
export function applyReceiptStrictOcrGates(
  parsed: ParsedReceiptDraft,
  quality: ReceiptOcrQuality,
): ReceiptStrictGateResult {
  let next = parsed;
  let merchantRejected = false;
  let itemBlockRejected = false;

  const weakText = quality.score < 30 || (quality.score < 35 && quality.textScore < 35);
  const noisyText = quality.suspiciousTokens >= 4 || quality.suspiciousFinancialLines >= 2;
  if (parsed.merchant && parsed.merchantConfidence !== 'high' && weakText && (quality.score < 25 || quality.textScore < 30 || noisyText)) {
    merchantRejected = true;
    next = {
      ...next,
      merchantConfidence: 'low',
      warnings: warningExists(next, 'merchant-uncertain')
        ? next.warnings
        : [...next.warnings, { code: 'merchant-uncertain', message: 'Nazwa sklepu została odrzucona z powodu niskiej jakości OCR. Sprawdź ją na zdjęciu.' }],
    };
    delete next.merchant;
  }

  const target = goodsTargetMinor(next);
  const itemMismatch = target !== undefined
    && next.items.length > 0
    && Math.abs(next.detectedItemsTotalMinor - target) > 1;
  const weakItemBlock = quality.financialScore < 30 && quality.textScore < 25;
  if (itemMismatch && weakItemBlock) {
    itemBlockRejected = true;
    next = {
      ...next,
      items: [],
      detectedItemsTotalMinor: 0,
      warnings: warningExists(next, 'no-items')
        ? next.warnings
        : [...next.warnings, { code: 'no-items', message: 'Blok pozycji został odrzucony, ponieważ słaby OCR nie zgadza się z sumą paragonu. Dodaj pozycje ręcznie na podstawie zdjęcia.' }],
    };
  }

  return { parsed: next, merchantRejected, itemBlockRejected };
}
