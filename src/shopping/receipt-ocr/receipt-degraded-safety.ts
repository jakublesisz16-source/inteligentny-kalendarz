import type { ParsedReceiptDraft, ReceiptOcrQuality, ReceiptSourceQuality } from './receipt-ocr.types';

function sumItems(items: ParsedReceiptDraft['items']): number {
  return items.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
}

/**
 * Very-low-resolution photos are allowed through OCR, but the review must not
 * present a large set of weak, contradictory guesses as if it were complete.
 * Keep only structurally supported items when source/text/financial evidence all
 * agree that the scan is unsafe. This is transient review safety only.
 */
export function applyReceiptDegradedSafety(
  parsed: ParsedReceiptDraft,
  sourceQuality: ReceiptSourceQuality | undefined,
  quality: ReceiptOcrQuality,
): ParsedReceiptDraft {
  if (sourceQuality?.level !== 'very-low') return parsed;

  const hasFinancialConflict = parsed.warnings.some((warning) => warning.code === 'sum-mismatch' || warning.code === 'total-missing');
  const hasHeavyOcrDamage = quality.textScore < 35 && (quality.suspiciousTokens >= 3 || quality.suspiciousFinancialLines >= 2);
  if (!hasFinancialConflict && !hasHeavyOcrDamage) return parsed;

  const keptItems = parsed.items.filter((item) => (
    item.confidence === 'high'
    && item.warnings.length === 0
    && item.financialResolution !== 'fallback'
  ));

  const degradedWarning = {
    code: 'degraded-source' as const,
    message: 'Źródło ma bardzo niską jakość. Zachowano tylko pozycje z silnym potwierdzeniem strukturalnym; pozostałe sprawdź ręcznie na zdjęciu.',
  };
  const warnings = parsed.warnings.some((warning) => warning.code === 'degraded-source')
    ? parsed.warnings
    : [...parsed.warnings, degradedWarning];

  // Under the same degraded-safety trigger, header OCR is not trustworthy
  // enough to auto-accept a merchant candidate. A random word must never be
  // shown as an OK store name on a very-low-resolution source. Keep the field
  // empty and explicitly low-confidence so the user can fill it from the image.
  const safeBase: ParsedReceiptDraft = { ...parsed, merchantConfidence: 'low' };
  delete safeBase.merchant;

  if (keptItems.length === parsed.items.length) {
    return {
      ...safeBase,
      items: parsed.items.map((item) => ({
        ...item,
        confidence: item.confidence === 'high' ? 'medium' as const : item.confidence,
        warnings: item.warnings.includes('Bardzo niska jakość źródła - sprawdź tę pozycję ręcznie.')
          ? item.warnings
          : [...item.warnings, 'Bardzo niska jakość źródła - sprawdź tę pozycję ręcznie.'],
      })),
      warnings,
    };
  }

  return {
    ...safeBase,
    items: keptItems,
    detectedItemsTotalMinor: sumItems(keptItems),
    warnings,
  };
}
