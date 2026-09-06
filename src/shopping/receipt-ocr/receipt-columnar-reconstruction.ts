/**
 * Reconstructs a receipt table when OCR returns column-major text instead of
 * row-major product lines. This happens on clean, narrow e-receipts where
 * Tesseract reads the whole "Nazwa" column, then "Ilość", "Cena" and
 * "Wartość". The reconstruction is deliberately evidence-driven:
 * - all four column headers must be present in order,
 * - product/quantity/unit-price counts must match,
 * - quantity x unit-price must confirm every gross line value,
 * - discount rows must reconcile gross + discount = net.
 *
 * If any structural check fails, the original OCR text is returned unchanged.
 * No merchant or product names are hard-coded here.
 */

export interface ReceiptColumnarReconstructionResult {
  text: string;
  applied: boolean;
  itemCount: number;
  discountCount: number;
}

interface ColumnarProductDescriptor {
  name: string;
  discountAfter: boolean;
}

interface QuantityCell {
  raw: string;
  quantity: number;
}

interface MoneyCell {
  raw: string;
  amountMinor: number;
  lineIndex: number;
}

function collapse(value: string): string {
  return value.replace(/[\t\u00a0]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function normalized(value: string): string {
  return collapse(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[Łł]/gu, 'L')
    .toLocaleUpperCase('pl-PL');
}

function isHeader(line: string, header: 'name' | 'quantity' | 'price' | 'value'): boolean {
  const value = normalized(line).replace(/[:;]+$/gu, '');
  if (header === 'name') return value === 'NAZWA';
  if (header === 'quantity') return value === 'ILOSC';
  if (header === 'price') return value === 'CENA';
  return value === 'WARTOSC';
}

function isBareDiscountLabel(line: string): boolean {
  return /^(?:OPUST|RABAT|KUPON|PROMOCJA|OBNIZKA|DISCOUNT)[:;.-]*$/u.test(normalized(line));
}

function isSummaryLabel(line: string): boolean {
  const value = normalized(line);
  return /^(?:OPUSTY\s+LACZNIE|SPRZEDA.{0,5}\s+OPODATKOWANA\s+[A-G]|PTU\s*[A-G](?:\s*\d{1,2}%?)?|SUMA\s+(?:PTU|VAT|PLN))\b/u.test(value);
}

function isProductNameCandidate(line: string): boolean {
  const value = collapse(line);
  if (!value || value.length > 100) return false;
  if (isBareDiscountLabel(value) || isSummaryLabel(value)) return false;
  const n = normalized(value);
  if (/^(?:PTU|PARAGON|NIP|REGON|NR\b|SUMA\b|DO\s+ZAPLATY|OPAKOWANIA\b)/u.test(n)) return false;
  return /[\p{L}]{2}/u.test(value);
}

function parseQuantityCell(line: string): QuantityCell | undefined {
  const value = collapse(line).replace(/×/gu, 'x');
  const match = /^([0-9]+(?:[,.][0-9]+)?)\s*(?:SZT\.?\s*)?[xX*]$/u.exec(value);
  if (!match?.[1]) return undefined;
  const quantity = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return undefined;
  return { raw: value.replace(/\s*[xX*]$/u, ' x'), quantity };
}

function parseMoneyCell(line: string, lineIndex: number, allowNegative: boolean): MoneyCell | undefined {
  const value = collapse(line)
    .replace(/[−–—]/gu, '-')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1');
  const match = /^(-?)(\d+)[,.](\d{2})(?:\s*(?:PLN|ZL))?$/iu.exec(value);
  if (!match) return undefined;
  if (match[1] && !allowNegative) return undefined;
  const whole = Number(match[2]);
  const fraction = Number(match[3]);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction) || fraction > 99) return undefined;
  const amountMinor = whole * 100 + fraction;
  return {
    raw: `${match[1] ? '-' : ''}${whole},${String(fraction).padStart(2, '0')}`,
    amountMinor: match[1] ? -amountMinor : amountMinor,
    lineIndex,
  };
}

function quantityTimesUnitMinor(quantity: number, unitPriceMinor: number): number {
  const thousandths = Math.round(quantity * 1000);
  return Math.round((thousandths * unitPriceMinor) / 1000);
}

function firstIndexAfter(lines: readonly string[], start: number, predicate: (line: string) => boolean): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (predicate(lines[index] ?? '')) return index;
  }
  return -1;
}

function buildProductDescriptors(lines: readonly string[], start: number, end: number): ColumnarProductDescriptor[] | undefined {
  const descriptors: ColumnarProductDescriptor[] = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (isSummaryLabel(line)) break;
    if (isBareDiscountLabel(line)) {
      const previous = descriptors[descriptors.length - 1];
      if (!previous || previous.discountAfter) return undefined;
      previous.discountAfter = true;
      continue;
    }
    if (!isProductNameCandidate(line)) continue;
    descriptors.push({ name: collapse(line), discountAfter: false });
  }
  return descriptors.length >= 2 && descriptors.length <= 80 ? descriptors : undefined;
}

function collectQuantities(lines: readonly string[], start: number, end: number): QuantityCell[] {
  const result: QuantityCell[] = [];
  for (let index = start; index < end; index += 1) {
    const cell = parseQuantityCell(lines[index] ?? '');
    if (cell) result.push(cell);
  }
  return result;
}

function collectMoney(lines: readonly string[], start: number, end: number, allowNegative: boolean): MoneyCell[] {
  const result: MoneyCell[] = [];
  for (let index = start; index < end; index += 1) {
    const cell = parseMoneyCell(lines[index] ?? '', index, allowNegative);
    if (cell) result.push(cell);
  }
  return result;
}

function summaryLabelsBetween(lines: readonly string[], start: number, end: number): string[] {
  const result: string[] = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (isSummaryLabel(line)) result.push(collapse(line));
  }
  return result;
}

function reconstructSeparatedColumnarReceiptText(rawText: string): ReceiptColumnarReconstructionResult {
  const originalLines = rawText.split(/\r?\n/gu).map(collapse).filter(Boolean);
  const unchanged = (): ReceiptColumnarReconstructionResult => ({ text: rawText, applied: false, itemCount: 0, discountCount: 0 });
  if (originalLines.length < 12) return unchanged();

  const nameHeader = originalLines.findIndex((line) => isHeader(line, 'name'));
  if (nameHeader < 0) return unchanged();
  const quantityHeader = firstIndexAfter(originalLines, nameHeader, (line) => isHeader(line, 'quantity'));
  const priceHeader = quantityHeader < 0 ? -1 : firstIndexAfter(originalLines, quantityHeader, (line) => isHeader(line, 'price'));
  const valueHeader = priceHeader < 0 ? -1 : firstIndexAfter(originalLines, priceHeader, (line) => isHeader(line, 'value'));
  if (!(nameHeader < quantityHeader && quantityHeader < priceHeader && priceHeader < valueHeader)) return unchanged();

  const descriptors = buildProductDescriptors(originalLines, nameHeader + 1, quantityHeader);
  if (!descriptors) return unchanged();
  const quantities = collectQuantities(originalLines, quantityHeader + 1, priceHeader);
  const unitPrices = collectMoney(originalLines, priceHeader + 1, valueHeader, false);
  if (quantities.length !== descriptors.length || unitPrices.length !== descriptors.length) return unchanged();

  const discountCount = descriptors.filter((descriptor) => descriptor.discountAfter).length;
  const requiredValueCells = descriptors.length + discountCount * 2;
  const values = collectMoney(originalLines, valueHeader + 1, originalLines.length, true);
  if (values.length < requiredValueCells) return unchanged();
  const itemValues = values.slice(0, requiredValueCells);

  const reconstructedItems: string[] = [];
  let cursor = 0;
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index]!;
    const quantity = quantities[index]!;
    const unitPrice = unitPrices[index]!;
    const gross = itemValues[cursor++];
    if (!gross || gross.amountMinor <= 0) return unchanged();
    const expectedGross = quantityTimesUnitMinor(quantity.quantity, unitPrice.amountMinor);
    if (Math.abs(expectedGross - gross.amountMinor) > 1) return unchanged();

    reconstructedItems.push(`${descriptor.name} ${quantity.raw} ${unitPrice.raw} ${gross.raw}`);
    if (descriptor.discountAfter) {
      const discount = itemValues[cursor++];
      const net = itemValues[cursor++];
      if (!discount || !net || discount.amountMinor >= 0 || net.amountMinor <= 0) return unchanged();
      if (Math.abs(gross.amountMinor + discount.amountMinor - net.amountMinor) > 1) return unchanged();
      reconstructedItems.push(`Opust ${discount.raw}`);
      reconstructedItems.push(net.raw);
    }
  }
  if (cursor !== requiredValueCells) return unchanged();

  const summaryLabels = summaryLabelsBetween(originalLines, nameHeader + 1, quantityHeader);
  const remainingValues = values.slice(requiredValueCells);
  const reconstructedSummary: string[] = [];
  let summaryConsumedThrough = itemValues[itemValues.length - 1]?.lineIndex ?? valueHeader;
  for (let index = 0; index < summaryLabels.length && index < remainingValues.length; index += 1) {
    const value = remainingValues[index]!;
    reconstructedSummary.push(`${summaryLabels[index]} ${value.raw}`);
    summaryConsumedThrough = value.lineIndex;
  }

  // Everything from the table header through the consumed right-hand values is
  // replaced by row-major lines. Lower receipt sections (final total, deposits,
  // payments, footer) stay untouched and continue through the ordinary parser.
  const prefix = originalLines.slice(0, nameHeader);
  const suffix = originalLines.slice(summaryConsumedThrough + 1);
  const text = [...prefix, ...reconstructedItems, ...reconstructedSummary, ...suffix].join('\n');
  return { text, applied: true, itemCount: descriptors.length, discountCount };
}


interface HybridRowDescriptor extends ColumnarProductDescriptor {
  quantity: QuantityCell;
  deposit: boolean;
  taxMarker?: string;
}

interface DiscountTriplet {
  gross: MoneyCell;
  discount: MoneyCell;
  net: MoneyCell;
}

function isHybridNameQuantityHeader(line: string): boolean {
  const value = normalized(line).replace(/[:;]+$/gu, '');
  return /\bNAZWA\b/u.test(value) && /\bILOSC\b/u.test(value) && !/^NAZWA$/u.test(value);
}

function hybridNameAndTaxMarker(value: string): { name: string; taxMarker?: string } {
  const tokens = collapse(value).split(/\s+/u).filter(Boolean);
  if (tokens.length < 2) return { name: collapse(value) };
  const raw = tokens[tokens.length - 1] ?? '';
  const token = normalized(raw).replace(/[^A-Z]/gu, '');
  const punctuationOnly = !token && /^[|Il!]+$/u.test(raw);
  const singleTax = /^[A-G]$/u.test(token) ? token : undefined;
  const doubledTax = /^([A-G])\1$/u.exec(token)?.[1];
  const taxLike = token === 'BRAK' || Boolean(singleTax) || Boolean(doubledTax);
  if (punctuationOnly || taxLike) tokens.pop();
  const taxMarker = singleTax ?? doubledTax;
  const name = collapse(tokens.join(' '));
  return taxMarker ? { name, taxMarker } : { name };
}

function parseHybridRowDescriptor(line: string): HybridRowDescriptor | undefined {
  const value = collapse(line).replace(/×/gu, 'x');
  const match = /^(.*?)\s+([0-9]+(?:[,.][0-9]+)?)\s*(?:SZT\.?\s*)?[xX*]$/u.exec(value);
  if (!match?.[1] || !match[2]) return undefined;
  const quantity = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return undefined;
  const descriptor = hybridNameAndTaxMarker(match[1]);
  if (!isProductNameCandidate(descriptor.name)) return undefined;
  return {
    name: descriptor.name,
    discountAfter: false,
    quantity: { raw: `${match[2]} x`, quantity },
    deposit: /\b(?:KAUCJ|DEPOZYT|OPAKOWAN(?:IE|IA)\s+ZWROTN)\w*/u.test(normalized(descriptor.name)),
    ...(descriptor.taxMarker ? { taxMarker: descriptor.taxMarker } : {}),
  };
}

function buildHybridRows(lines: readonly string[], start: number, end: number): HybridRowDescriptor[] | undefined {
  const rows: HybridRowDescriptor[] = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (isBareDiscountLabel(line)) {
      const previous = rows[rows.length - 1];
      if (!previous || previous.discountAfter || previous.deposit) return undefined;
      previous.discountAfter = true;
      continue;
    }
    const row = parseHybridRowDescriptor(line);
    if (row) rows.push(row);
  }
  return rows.length >= 3 && rows.length <= 80 ? rows : undefined;
}

function moneyRawFromMinor(amountMinor: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

function findDiscountTriplets(cells: readonly MoneyCell[]): DiscountTriplet[] {
  const result: DiscountTriplet[] = [];
  for (let index = 0; index + 2 < cells.length;) {
    const gross = cells[index]!;
    const discount = cells[index + 1]!;
    const net = cells[index + 2]!;
    if (gross.amountMinor > 0 && discount.amountMinor < 0 && net.amountMinor > 0
      && Math.abs(gross.amountMinor + discount.amountMinor - net.amountMinor) <= 1) {
      result.push({ gross, discount, net });
      index += 3;
      continue;
    }
    index += 1;
  }
  return result;
}

function continuationDiscountDescriptors(lines: readonly string[], start: number, end: number): ColumnarProductDescriptor[] {
  const result: ColumnarProductDescriptor[] = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (!isProductNameCandidate(line)) continue;
    const next = lines[index + 1] ?? '';
    if (!isBareDiscountLabel(next)) continue;
    result.push({ name: collapse(line), discountAfter: true });
    index += 1;
  }
  return result;
}

function compactEditDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex]! + 1, current[rightIndex - 1]! + 1, substitution);
    }
    previous = current;
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function namesCompatibleForOverlap(left: string, right: string): boolean {
  const a = normalized(left).replace(/[^A-Z0-9]+/gu, '');
  const b = normalized(right).replace(/[^A-Z0-9]+/gu, '');
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 8 && longer.length - shorter.length <= 2 && longer.startsWith(shorter)) return true;
  return Math.min(a.length, b.length) >= 10 && Math.abs(a.length - b.length) <= 2 && compactEditDistance(a, b) <= 2;
}

function isHybridTaxSummaryLabel(line: string): boolean {
  const value = normalized(line);
  return /^(?:SPRZEDA.{0,5}\s+OPODATKOWANA\s+(?:[A-G]|BRAK)|PTU\s*(?:[A-G]|BRAK)(?:\s*\d{1,2}%?)?)/u.test(value);
}

function normalizedHybridTaxLabel(line: string): string {
  const value = collapse(line);
  const n = normalized(value);
  const ptu = /^PTU\s*(BRAK|[A-G])\s*(\d{1,2})?%?/u.exec(n);
  if (ptu?.[1]) return `PTU ${ptu[1] === 'BRAK' ? 'brak' : ptu[1]}${ptu[2] ? ` ${ptu[2]}%` : ''}`;
  return value;
}

function reconstructHybridTaxSummary(
  lines: readonly string[],
  labelStart: number,
  moneyStart: number,
  pageBreak: number,
): string[] {
  const labels: string[] = [];
  for (let index = labelStart; index < moneyStart; index += 1) {
    const line = lines[index] ?? '';
    if (isHybridTaxSummaryLabel(line)) labels.push(normalizedHybridTaxLabel(line));
  }
  if (!labels.length) return [];
  const values = collectMoney(lines, moneyStart, pageBreak, false);
  if (!values.length) return [];
  const count = Math.min(labels.length, values.length);
  const selectedLabels = labels.slice(labels.length - count);
  const selectedValues = values.slice(values.length - count);
  return selectedLabels.map((label, index) => `${label} ${selectedValues[index]!.raw}`);
}

function reconstructPageTwoFinancials(lines: readonly string[], pageBreak: number): string[] | undefined {
  const page = lines.slice(pageBreak + 1);
  const sumPtuIndex = page.findIndex((line) => /^SUMA\s+(?:PTU|VAT)\b/u.test(normalized(line)));
  const sumPlnIndex = page.findIndex((line) => /^SUMA\s+PLN\b/u.test(normalized(line)));
  if (sumPlnIndex < 0) return undefined;

  const paymentLabelIndexes: Array<{ index: number; label: string }> = [];
  for (let index = sumPlnIndex + 1; index < page.length; index += 1) {
    const value = normalized(page[index] ?? '');
    if (/\bBON\b/u.test(value)) paymentLabelIndexes.push({ index, label: 'Bon' });
    else if (/^KARTA(?:\s+PLATNICZA)?\b/u.test(value)) paymentLabelIndexes.push({ index, label: 'Karta płatnicza' });
    else if (/^GOTOWKA\b/u.test(value)) paymentLabelIndexes.push({ index, label: 'Gotówka' });
  }
  if (!paymentLabelIndexes.length) return undefined;
  const firstPaymentLabel = paymentLabelIndexes[0]!.index;
  const summaryMoney = collectMoney(page, sumPlnIndex + 1, firstPaymentLabel, false);
  const summaryValuesNeeded = sumPtuIndex >= 0 && sumPtuIndex < sumPlnIndex ? 2 : 1;
  if (summaryMoney.length < summaryValuesNeeded) return undefined;
  const summaryLines: string[] = [];
  let cursor = 0;
  if (summaryValuesNeeded === 2) summaryLines.push(`Suma PTU ${summaryMoney[cursor++]!.raw}`);
  summaryLines.push(`Suma PLN ${summaryMoney[cursor++]!.raw}`);

  const paymentMoneyStart = paymentLabelIndexes[paymentLabelIndexes.length - 1]!.index + 1;
  const paymentMoney = collectMoney(page, paymentMoneyStart, page.length, false);
  if (paymentMoney.length < paymentLabelIndexes.length) return undefined;
  const selectedPaymentMoney = paymentMoney.slice(0, paymentLabelIndexes.length);
  const paymentTotalMinor = selectedPaymentMoney.reduce((sum, cell) => sum + cell.amountMinor, 0);
  const finalSummaryMinor = summaryMoney[summaryValuesNeeded - 1]!.amountMinor;
  if (Math.abs(paymentTotalMinor - finalSummaryMinor) > 1) return undefined;
  const paymentLines = paymentLabelIndexes.map((entry, index) => `${entry.label} ${selectedPaymentMoney[index]!.raw}`);

  const lastPaymentValueLine = selectedPaymentMoney[selectedPaymentMoney.length - 1]!.lineIndex;
  const footer = page.slice(lastPaymentValueLine + 1);
  return [...summaryLines, ...paymentLines, ...footer];
}

function reconstructHybridMultipageReceiptText(rawText: string): ReceiptColumnarReconstructionResult {
  const lines = rawText.split(/\r?\n/gu).map(collapse).filter(Boolean);
  const unchanged = (): ReceiptColumnarReconstructionResult => ({ text: rawText, applied: false, itemCount: 0, discountCount: 0 });
  if (lines.length < 20) return unchanged();

  const pageBreak = lines.findIndex((line) => line === '[[RECEIPT_PAGE_BREAK]]');
  if (pageBreak < 0) return unchanged();
  const hybridHeader = lines.findIndex((line, index) => index < pageBreak && isHybridNameQuantityHeader(line));
  if (hybridHeader < 0) return unchanged();
  const priceHeader = firstIndexAfter(lines, hybridHeader, (line) => isHeader(line, 'price'));
  const valueHeader = priceHeader < 0 ? -1 : firstIndexAfter(lines, priceHeader, (line) => isHeader(line, 'value'));
  if (!(hybridHeader < priceHeader && priceHeader < valueHeader && valueHeader < pageBreak)) return unchanged();

  const rows = buildHybridRows(lines, hybridHeader + 1, priceHeader);
  if (!rows) return unchanged();
  const unitPrices = collectMoney(lines, priceHeader + 1, valueHeader, false);
  if (!unitPrices.length || unitPrices.length > rows.length) return unchanged();
  const values = collectMoney(lines, valueHeader + 1, pageBreak, true);
  if (!values.length) return unchanged();

  const reconstructedItems: Array<{ name: string; gross: number; net: number; lines: string[] }> = [];
  let depositTotalMinor = 0;
  let discountCount = 0;
  let valueCursor = 0;
  let unitPriceCursor = 0;
  let missingUnitPriceRows = 0;
  let consumedThrough = valueHeader;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const grossCell = values[valueCursor++];
    if (!grossCell || grossCell.amountMinor <= 0) return unchanged();
    const unitPrice = unitPrices[unitPriceCursor];
    const expectedGross = unitPrice ? quantityTimesUnitMinor(row.quantity.quantity, unitPrice.amountMinor) : undefined;
    const grossDifference = expectedGross === undefined ? undefined : Math.abs(expectedGross - grossCell.amountMinor);
    const unitPriceConfirmed = grossDifference !== undefined && grossDifference <= 5;
    // OCR may lose exactly one unit-price cell while preserving quantity and
    // line value. In that case do not shift all later prices: keep the gross
    // value and let tax/receipt-level evidence review that one row.
    const grossMinor = unitPriceConfirmed && grossDifference! > 1 ? expectedGross! : grossCell.amountMinor;
    if (unitPriceConfirmed) unitPriceCursor += 1;
    else missingUnitPriceRows += 1;
    consumedThrough = grossCell.lineIndex;

    if (row.deposit) {
      if (row.discountAfter) return unchanged();
      depositTotalMinor += grossMinor;
      continue;
    }

    const taxSuffix = row.taxMarker ? ` ${row.taxMarker}` : '';
    const rowText = unitPriceConfirmed && unitPrice
      ? `${row.name} ${row.quantity.raw} ${unitPrice.raw} ${moneyRawFromMinor(grossMinor)}${taxSuffix}`
      : `${row.name} ${moneyRawFromMinor(grossMinor)}${row.taxMarker ? row.taxMarker : ''}|`;
    const output = [rowText];
    let netMinor = grossMinor;
    if (row.discountAfter) {
      const discount = values[valueCursor++];
      const net = values[valueCursor++];
      if (!discount || !net || discount.amountMinor >= 0 || net.amountMinor <= 0) return unchanged();
      if (Math.abs(grossMinor + discount.amountMinor - net.amountMinor) > 1) return unchanged();
      output.push(`Opust ${discount.raw}`, net.raw);
      netMinor = net.amountMinor;
      consumedThrough = net.lineIndex;
      discountCount += 1;
    }
    reconstructedItems.push({ name: row.name, gross: grossMinor, net: netMinor, lines: output });
  }

  if (unitPriceCursor !== unitPrices.length || missingUnitPriceRows > 1) return unchanged();

  const firstSummaryAfterValues = lines.findIndex((line, index) => index > consumedThrough && index < pageBreak && isSummaryLabel(line));
  if (firstSummaryAfterValues < 0) return unchanged();
  const continuation = continuationDiscountDescriptors(lines, consumedThrough + 1, firstSummaryAfterValues);
  let taxMoneyStart = firstSummaryAfterValues;
  if (continuation.length) {
    const remainingMoney = collectMoney(lines, firstSummaryAfterValues, pageBreak, true);
    const triplets = findDiscountTriplets(remainingMoney);
    if (triplets.length < continuation.length) return unchanged();
    const selectedTriplets = triplets.slice(0, continuation.length);
    selectedTriplets.forEach((triplet) => { taxMoneyStart = Math.max(taxMoneyStart, triplet.net.lineIndex + 1); });
    const overlapAnchor = reconstructedItems[reconstructedItems.length - 1];
    continuation.forEach((descriptor, index) => {
      const triplet = selectedTriplets[index]!;
      const overlapDuplicate = index === 0 && overlapAnchor
        && namesCompatibleForOverlap(overlapAnchor.name, descriptor.name)
        && Math.abs(overlapAnchor.gross - triplet.gross.amountMinor) <= 1
        && Math.abs(overlapAnchor.net - triplet.net.amountMinor) <= 1;
      if (overlapDuplicate) return;
      reconstructedItems.push({
        name: descriptor.name,
        gross: triplet.gross.amountMinor,
        net: triplet.net.amountMinor,
        lines: [`${descriptor.name} ${triplet.gross.raw}`, `Opust ${triplet.discount.raw}`, triplet.net.raw],
      });
      discountCount += 1;
    });
  }
  const reconstructedTax = reconstructHybridTaxSummary(lines, firstSummaryAfterValues, taxMoneyStart, pageBreak);

  const financialSuffix = reconstructPageTwoFinancials(lines, pageBreak);
  if (!financialSuffix) return unchanged();
  const finalSummary = financialSuffix.find((line) => /^Suma PLN\s/u.test(line));
  const finalToken = finalSummary?.split(/\s+/u).at(-1);
  const finalCell = finalToken ? parseMoneyCell(finalToken, 0, false) : undefined;
  if (!finalCell) return unchanged();
  const reconstructedGoodsMinor = reconstructedItems.reduce((sum, item) => sum + item.net, 0);
  // Permit only a tiny residual here because a later independent tax subtotal
  // may repair one damaged right-column value (the missing-unit-price case).
  if (Math.abs(reconstructedGoodsMinor + depositTotalMinor - finalCell.amountMinor) > 5) return unchanged();
  const itemLines = reconstructedItems.flatMap((item) => item.lines);
  if (itemLines.length < 2) return unchanged();
  const depositLines = depositTotalMinor > 0 ? [`OPAKOWANIA ZWROTNE SUMA ${moneyRawFromMinor(depositTotalMinor)}`] : [];
  const prefix = lines.slice(0, hybridHeader);
  const text = [...prefix, ...itemLines, ...depositLines, ...reconstructedTax, '[[RECEIPT_PAGE_BREAK]]', ...financialSuffix].join('\n');
  return { text, applied: true, itemCount: reconstructedItems.length, discountCount };
}

export function reconstructColumnarReceiptText(rawText: string): ReceiptColumnarReconstructionResult {
  const separated = reconstructSeparatedColumnarReceiptText(rawText);
  if (separated.applied) return separated;
  return reconstructHybridMultipageReceiptText(rawText);
}
