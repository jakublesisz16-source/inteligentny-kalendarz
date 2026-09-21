import type { FinanceCurrencyCode } from '../expenses.types';
import { parseReceiptQuantity } from '../expenses.utils';
import type { ParsedReceiptDraft, ParsedReceiptItem, ReceiptAdjustmentDraft, ReceiptParseWarning } from './receipt-ocr.types';
import { resolveReceiptMerchant } from './receipt-parser';

export const MAX_RECEIPT_JSON_BYTES = 4 * 1024 * 1024;

interface JsonRecord { [key: string]: unknown }

export interface StructuredReceiptJsonResult {
  parsed: ParsedReceiptDraft;
  currency: FinanceCurrencyCode;
  format: 'structured-e-receipt-json';
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`JSON paragonu nie zawiera prawidłowego pola „${field}”.`);
  return value;
}

function requiredRecord(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`JSON paragonu nie zawiera prawidłowego pola „${field}”.`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function minorInteger(value: unknown, field: string, allowZero = true): number {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`JSON paragonu ma nieprawidłową wartość „${field}”.`);
  }
  return value;
}

function cleanHtmlText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/giu, '\n')
    .replace(/<\/div\s*>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&amp;/giu, '&')
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .trim();
}

function cleanStructuredItemName(value: string, vatId?: string): string {
  let name = value.replace(/\s+/gu, ' ').trim();
  if (vatId) {
    const escaped = vatId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    name = name.replace(new RegExp(`\\s+${escaped}\\s*$`, 'iu'), '').trim();
  }
  return name;
}

function isoCalendarDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T/u.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function supportedCurrency(value: unknown): FinanceCurrencyCode {
  const currency = optionalString(value)?.toUpperCase();
  const supported = new Set<FinanceCurrencyCode>(['PLN', 'EUR', 'HUF', 'CZK', 'GBP', 'USD', 'CHF', 'RON', 'DKK', 'SEK', 'NOK', 'TRY', 'JPY']);
  if (!currency || !supported.has(currency as FinanceCurrencyCode)) {
    throw new Error(`JSON paragonu używa nieobsługiwanej waluty${currency ? `: ${currency}` : ''}.`);
  }
  return currency as FinanceCurrencyCode;
}

function extractHeaderText(header: unknown[]): string {
  for (const entry of header) {
    if (!isRecord(entry) || !isRecord(entry.headerText)) continue;
    const lines = optionalString(entry.headerText.headerTextLines);
    if (lines) return cleanHtmlText(lines);
  }
  return '';
}

function extractDate(header: unknown[], body: unknown[]): { date?: string; confidence: 'high' | 'low' } {
  let headerDate: string | undefined;
  for (const entry of header) {
    if (!isRecord(entry) || !isRecord(entry.headerData)) continue;
    headerDate = isoCalendarDate(entry.headerData.date);
    if (headerDate) break;
  }
  let footerDate: string | undefined;
  for (const entry of body) {
    if (!isRecord(entry) || !isRecord(entry.fiscalFooter)) continue;
    footerDate = isoCalendarDate(entry.fiscalFooter.date);
    if (footerDate) break;
  }
  if (headerDate && footerDate && headerDate !== footerDate) {
    throw new Error('JSON paragonu zawiera sprzeczne daty nagłówka i stopki.');
  }
  const date = headerDate ?? footerDate;
  return date ? { date, confidence: 'high' } : { confidence: 'low' };
}

interface ItemBuilder {
  item: ParsedReceiptItem;
  baseAmountMinor: number;
  discountMinor: number;
  vatId?: string;
}

export function parseStructuredReceiptJsonText(rawText: string): StructuredReceiptJsonResult {
  if (!rawText.trim()) throw new Error('Plik JSON paragonu jest pusty.');
  let root: unknown;
  try {
    root = JSON.parse(rawText);
  } catch {
    throw new Error('Plik nie jest prawidłowym JSON-em paragonu.');
  }
  const document = requiredRecord(root, 'root');
  const header = requiredArray(document.header, 'header');
  const body = requiredArray(document.body, 'body');
  if (!body.length) throw new Error('JSON paragonu nie zawiera sekcji fiskalnej.');

  const headerText = extractHeaderText(header);
  const merchantResolution = headerText ? resolveReceiptMerchant(headerText) : undefined;
  const structuredMerchantAccepted = Boolean(merchantResolution?.merchant && merchantResolution.decision === 'accepted');
  const dateResolution = extractDate(header, body);
  const warnings: ReceiptParseWarning[] = [];
  if (!merchantResolution?.merchant) warnings.push({ code: 'merchant-uncertain', message: 'Nie rozpoznano nazwy sklepu z danych JSON.' });
  if (!dateResolution.date) warnings.push({ code: 'date-missing', message: 'Nie znaleziono daty paragonu w danych JSON.' });

  const items: ItemBuilder[] = [];
  const adjustments: ReceiptAdjustmentDraft[] = [];
  let currentItem: ItemBuilder | undefined;
  let detectedDiscountMinor = 0;
  let declaredDiscountMinor: number | undefined;
  let depositTotalMinor = 0;
  let fiscalTotalMinor: number | undefined;
  let finalTotalMinor: number | undefined;
  let paymentTotalMinor = 0;
  let hasPayment = false;
  let taxTotalMinor: number | undefined;
  let currency: FinanceCurrencyCode | undefined;

  for (const rawEntry of body) {
    if (!isRecord(rawEntry)) continue;

    if (isRecord(rawEntry.sellLine)) {
      const line = rawEntry.sellLine;
      if (line.isStorno === true) throw new Error('JSON zawiera pozycję storno, której ten importer jeszcze bezpiecznie nie obsługuje.');
      const rawName = optionalString(line.name);
      if (!rawName) throw new Error('JSON zawiera pozycję bez nazwy.');
      const vatId = optionalString(line.vatId);
      const name = cleanStructuredItemName(rawName, vatId);
      if (!name) throw new Error('JSON zawiera pozycję bez czytelnej nazwy.');
      const baseAmountMinor = minorInteger(line.total, `wartość pozycji „${name}”`, false);
      const unitPriceMinor = minorInteger(line.price, `cena pozycji „${name}”`, false);
      const quantityText = optionalString(line.quantity);
      const quantity = quantityText ? parseReceiptQuantity(quantityText) : null;
      if (quantity === null || quantity <= 0) throw new Error(`JSON zawiera nieprawidłową ilość pozycji „${name}”.`);
      const expectedBaseMinor = Math.round(quantity * unitPriceMinor);
      if (Math.abs(expectedBaseMinor - baseAmountMinor) > 1) {
        throw new Error(`JSON zawiera niespójną ilość, cenę i wartość pozycji „${name}”.`);
      }
      const item: ParsedReceiptItem = {
        rawText: `${name} | ${quantityText} × ${unitPriceMinor} = ${baseAmountMinor}`,
        name,
        amountMinor: baseAmountMinor,
        baseAmountMinor,
        ...(vatId ? { taxMarker: vatId } : {}),
        financialResolution: 'quantity-unit-total-consensus',
        quantity,
        unitPriceMinor,
        confidence: 'high',
        warnings: [],
      };
      currentItem = { item, baseAmountMinor, discountMinor: 0, ...(vatId ? { vatId } : {}) };
      items.push(currentItem);
      continue;
    }

    if (isRecord(rawEntry.discountLine)) {
      const line = rawEntry.discountLine;
      if (!currentItem) throw new Error('JSON zawiera rabat bez poprzedzającej pozycji.');
      if (line.isDiscount !== true || line.isStorno === true) {
        throw new Error('JSON zawiera korektę pozycji, której importer nie może bezpiecznie sklasyfikować jako rabat.');
      }
      const valueMinor = minorInteger(line.value, 'wartość rabatu', false);
      const baseMinor = minorInteger(line.base, 'podstawa rabatu', false);
      const currentBeforeDiscount = currentItem.baseAmountMinor - currentItem.discountMinor;
      if (Math.abs(baseMinor - currentItem.baseAmountMinor) > 1 && Math.abs(baseMinor - currentBeforeDiscount) > 1) {
        throw new Error(`Rabat w JSON-ie nie zgadza się z pozycją „${currentItem.item.name}”.`);
      }
      const discountVatId = optionalString(line.vatId);
      if (discountVatId && currentItem.vatId && discountVatId !== currentItem.vatId) {
        throw new Error(`Rabat w JSON-ie ma inną stawkę PTU niż pozycja „${currentItem.item.name}”.`);
      }
      currentItem.discountMinor += valueMinor;
      const finalAmountMinor = currentItem.baseAmountMinor - currentItem.discountMinor;
      if (finalAmountMinor <= 0) throw new Error(`Rabaty przekraczają wartość pozycji „${currentItem.item.name}”.`);
      currentItem.item.amountMinor = finalAmountMinor;
      currentItem.item.discountMinor = currentItem.discountMinor;
      detectedDiscountMinor += valueMinor;
      adjustments.push({ rawText: `Rabat: ${currentItem.item.name}`, amountMinor: -valueMinor, kind: 'discount' });
      continue;
    }

    if (isRecord(rawEntry.discountSummary)) {
      declaredDiscountMinor = minorInteger(rawEntry.discountSummary.discounts, 'suma rabatów');
      continue;
    }

    if (isRecord(rawEntry.pack)) {
      const pack = rawEntry.pack;
      if (pack.isNegative === true) throw new Error('JSON zawiera zwrot opakowania, którego importer nie może zapisać jako dodatni wydatek.');
      const total = minorInteger(pack.total, 'wartość kaucji', false);
      const price = minorInteger(pack.price, 'cena kaucji', false);
      const quantityText = optionalString(pack.quantity);
      const quantity = quantityText ? parseReceiptQuantity(quantityText) : null;
      if (quantity === null || quantity <= 0 || Math.abs(Math.round(quantity * price) - total) > 1) {
        throw new Error('JSON zawiera niespójną ilość, cenę i wartość kaucji.');
      }
      depositTotalMinor += total;
      continue;
    }

    if (isRecord(rawEntry.vatSummary)) {
      const summaryCurrency = supportedCurrency(rawEntry.vatSummary.currency);
      if (currency && currency !== summaryCurrency) throw new Error('JSON zawiera sprzeczne waluty sekcji fiskalnych.');
      currency = summaryCurrency;
      const rates = requiredArray(rawEntry.vatSummary.vatRatesSummary, 'vatRatesSummary');
      taxTotalMinor = rates.reduce<number>((sum, rate, index) => {
        const record = requiredRecord(rate, `vatRatesSummary[${index}]`);
        return sum + minorInteger(record.vatAmount, `VAT ${index + 1}`);
      }, 0);
      continue;
    }

    if (isRecord(rawEntry.sumInCurrency)) {
      const summaryCurrency = supportedCurrency(rawEntry.sumInCurrency.currency);
      if (currency && currency !== summaryCurrency) throw new Error('JSON zawiera sprzeczne waluty sekcji fiskalnych.');
      currency = summaryCurrency;
      const fiscal = minorInteger(rawEntry.sumInCurrency.fiscalTotal, 'suma fiskalna', false);
      const final = minorInteger(rawEntry.sumInCurrency.totalWithPacks, 'suma z kaucjami', false);
      if (fiscalTotalMinor !== undefined && fiscalTotalMinor !== fiscal) throw new Error('JSON zawiera więcej niż jedną sprzeczną sumę fiskalną.');
      if (finalTotalMinor !== undefined && finalTotalMinor !== final) throw new Error('JSON zawiera więcej niż jedną sprzeczną sumę końcową.');
      fiscalTotalMinor = fiscal;
      finalTotalMinor = final;
      continue;
    }

    if (isRecord(rawEntry.payment)) {
      const payment = rawEntry.payment;
      const paymentCurrency = optionalString(payment.currency) ? supportedCurrency(payment.currency) : currency;
      if (paymentCurrency && currency && paymentCurrency !== currency) throw new Error('JSON zawiera płatność w innej walucie niż paragon.');
      if (paymentCurrency) currency = paymentCurrency;
      const amount = minorInteger(payment.amount, 'kwota płatności');
      paymentTotalMinor += payment.reszta === true ? -amount : amount;
      hasPayment = true;
      continue;
    }
  }

  if (!items.length) throw new Error('JSON paragonu nie zawiera żadnych pozycji sprzedaży.');
  if (!currency) throw new Error('JSON paragonu nie określa waluty.');
  if (fiscalTotalMinor === undefined || finalTotalMinor === undefined) {
    throw new Error('JSON paragonu nie zawiera kompletnej sumy fiskalnej i końcowej.');
  }

  const parsedItems = items.map((builder) => builder.item);
  const detectedItemsTotalMinor = parsedItems.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  if (detectedItemsTotalMinor !== fiscalTotalMinor) {
    throw new Error('Pozycje JSON nie zgadzają się z sumą fiskalną paragonu.');
  }
  if (fiscalTotalMinor + depositTotalMinor !== finalTotalMinor) {
    throw new Error('Suma fiskalna i kaucje JSON nie zgadzają się z kwotą końcową.');
  }
  if (hasPayment && paymentTotalMinor !== finalTotalMinor) {
    throw new Error('Płatności JSON nie zgadzają się z kwotą końcową paragonu.');
  }
  if (declaredDiscountMinor !== undefined && declaredDiscountMinor !== detectedDiscountMinor) {
    throw new Error('Rabaty pozycji JSON nie zgadzają się z łączną wartością rabatów.');
  }

  const parsed: ParsedReceiptDraft = {
    ...(merchantResolution?.merchant ? { merchant: merchantResolution.merchant } : {}),
    // Structured e-receipt header text is source data, not OCR. Once the generic
    // merchant resolver accepts a concrete label, confidence describes extraction
    // from this structured source and can be high. OCR keeps its original, more
    // conservative confidence semantics.
    merchantConfidence: structuredMerchantAccepted ? 'high' : merchantResolution?.confidence ?? 'low',
    ...(dateResolution.date ? { date: dateResolution.date } : {}),
    dateConfidence: dateResolution.confidence,
    items: parsedItems,
    declaredTotalMinor: finalTotalMinor,
    ocrSubtotalMinor: fiscalTotalMinor,
    ...(taxTotalMinor === undefined ? {} : { taxTotalMinor }),
    declaredSubtotalMinor: fiscalTotalMinor,
    ...(depositTotalMinor > 0 ? { depositTotalMinor } : {}),
    finalPayableMinor: finalTotalMinor,
    ...(hasPayment ? { paymentTotalMinor } : {}),
    unexplainedDifferenceMinor: detectedItemsTotalMinor + depositTotalMinor - finalTotalMinor,
    subtotalResolution: 'items-final-consensus',
    ...(declaredDiscountMinor === undefined ? {} : { declaredDiscountTotalMinor: -declaredDiscountMinor }),
    detectedItemsTotalMinor,
    adjustments,
    warnings: [
      ...warnings,
      ...((merchantResolution?.warnings ?? []).filter((warning) => !(structuredMerchantAccepted && warning.code === 'merchant-uncertain'))),
    ],
  };

  return { parsed, currency, format: 'structured-e-receipt-json' };
}

export async function parseStructuredReceiptJsonFile(file: File): Promise<StructuredReceiptJsonResult> {
  if (file.size > MAX_RECEIPT_JSON_BYTES) throw new Error('JSON paragonu jest zbyt duży. Maksymalny rozmiar pliku to 4 MB.');
  return parseStructuredReceiptJsonText(await file.text());
}
