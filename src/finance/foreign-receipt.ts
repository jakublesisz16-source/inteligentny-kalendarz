import type { FinanceCurrencyCode, ReceiptDraft, ReceiptItemDraft } from '../shopping/expenses.types';
import { convertForeignMinorToPlnMinor } from '../shopping/expenses.utils';

function convertedMinor(value: number, ratePlnPerUnit: number, label: string): number {
  const converted = convertForeignMinorToPlnMinor(value, ratePlnPerUnit);
  if (converted === null) throw new Error(`Nie udało się przeliczyć ${label} na PLN.`);
  return converted;
}

function convertItem(item: ReceiptItemDraft, ratePlnPerUnit: number): ReceiptItemDraft {
  const amountMinor = convertedMinor(item.amountMinor, ratePlnPerUnit, `pozycji „${item.name}”`);
  const unitPriceMinor = item.unitPriceMinor === undefined
    ? undefined
    : convertForeignMinorToPlnMinor(item.unitPriceMinor, ratePlnPerUnit) ?? undefined;
  return {
    ...item,
    amountMinor,
    ...(unitPriceMinor === undefined ? {} : { unitPriceMinor }),
  };
}

/**
 * Receipt OCR has no currency selector of its own. Inside a foreign-currency trip
 * the scanned numeric values are interpreted in the trip currency, then stored in
 * PLN while preserving the original total and conversion metadata.
 */
export function convertForeignReceiptDraftToPln(
  draft: ReceiptDraft,
  currency: Exclude<FinanceCurrencyCode, 'PLN'>,
  ratePlnPerUnit: number,
): ReceiptDraft {
  const originalAmountMinor = draft.items.reduce((sum, item) => sum + item.amountMinor, 0);
  const targetTotalMinor = convertedMinor(originalAmountMinor, ratePlnPerUnit, 'sumy paragonu');
  const items = draft.items.map((item) => convertItem(item, ratePlnPerUnit));
  const convertedTotalMinor = items.reduce((sum, item) => sum + item.amountMinor, 0);
  const roundingDelta = targetTotalMinor - convertedTotalMinor;

  if (roundingDelta !== 0 && items.length) {
    let targetIndex = 0;
    for (let index = 1; index < items.length; index += 1) {
      if (items[index]!.amountMinor > items[targetIndex]!.amountMinor) targetIndex = index;
    }
    const adjusted = items[targetIndex]!.amountMinor + roundingDelta;
    if (!Number.isSafeInteger(adjusted) || adjusted <= 0) throw new Error('Nie udało się bezpiecznie rozliczyć zaokrąglenia kursu paragonu.');
    items[targetIndex] = { ...items[targetIndex]!, amountMinor: adjusted };
  }

  return {
    ...draft,
    items,
    originalCurrency: currency,
    originalAmountMinor,
    exchangeRatePlnPerUnit: ratePlnPerUnit,
    conversionSource: 'rate',
  };
}
