export type ReceiptSubtotalResolution =
  | 'items-final-consensus'
  | 'ocr-items-consensus'
  | 'ocr-final-consensus'
  | 'ocr-unconfirmed'
  | 'final-minus-deposit'
  | 'items-only';

export interface ReceiptFinancialEvidence {
  itemsTotalMinor: number;
  ocrSubtotalMinor?: number;
  depositTotalMinor?: number;
  finalTotalMinor?: number;
  paymentTotalMinor?: number;
}

export interface ReceiptFinancialReconciliation {
  reconciledSubtotalMinor?: number;
  subtotalResolution?: ReceiptSubtotalResolution;
  unexplainedDifferenceMinor?: number;
  paymentDifferenceMinor?: number;
  financiallyConsistent: boolean;
  subtotalCorrectedFromOcr: boolean;
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1;
}

export function reconcileReceiptFinancials(evidence: ReceiptFinancialEvidence): ReceiptFinancialReconciliation {
  const { itemsTotalMinor, ocrSubtotalMinor, depositTotalMinor, finalTotalMinor, paymentTotalMinor } = evidence;
  const hasItems = Number.isSafeInteger(itemsTotalMinor) && itemsTotalMinor > 0;
  const depositMinor = depositTotalMinor ?? 0;
  const finalGoodsMinor = finalTotalMinor !== undefined && finalTotalMinor >= depositMinor
    ? finalTotalMinor - depositMinor
    : undefined;

  let reconciledSubtotalMinor: number | undefined;
  let subtotalResolution: ReceiptSubtotalResolution | undefined;

  // Strongest repair: two independent equations agree on the goods subtotal.
  // This intentionally outranks a conflicting OCR subtotal without mutating raw OCR.
  if (hasItems && finalGoodsMinor !== undefined && closeEnough(itemsTotalMinor, finalGoodsMinor)) {
    reconciledSubtotalMinor = itemsTotalMinor;
    subtotalResolution = 'items-final-consensus';
  } else if (hasItems && ocrSubtotalMinor !== undefined && closeEnough(itemsTotalMinor, ocrSubtotalMinor)) {
    reconciledSubtotalMinor = itemsTotalMinor;
    subtotalResolution = 'ocr-items-consensus';
  } else if (ocrSubtotalMinor !== undefined && finalGoodsMinor !== undefined && closeEnough(ocrSubtotalMinor, finalGoodsMinor)) {
    reconciledSubtotalMinor = ocrSubtotalMinor;
    subtotalResolution = 'ocr-final-consensus';
  } else if (ocrSubtotalMinor !== undefined) {
    reconciledSubtotalMinor = ocrSubtotalMinor;
    subtotalResolution = 'ocr-unconfirmed';
  } else if (finalGoodsMinor !== undefined) {
    reconciledSubtotalMinor = finalGoodsMinor;
    subtotalResolution = 'final-minus-deposit';
  } else if (hasItems) {
    reconciledSubtotalMinor = itemsTotalMinor;
    subtotalResolution = 'items-only';
  }

  const unexplainedDifferenceMinor = finalTotalMinor !== undefined && hasItems
    ? itemsTotalMinor + depositMinor - finalTotalMinor
    : reconciledSubtotalMinor !== undefined && hasItems
      ? itemsTotalMinor - reconciledSubtotalMinor
      : undefined;
  const paymentDifferenceMinor = finalTotalMinor !== undefined && paymentTotalMinor !== undefined
    ? paymentTotalMinor - finalTotalMinor
    : undefined;
  const financiallyConsistent = (unexplainedDifferenceMinor === undefined || Math.abs(unexplainedDifferenceMinor) <= 1)
    && (paymentDifferenceMinor === undefined || Math.abs(paymentDifferenceMinor) <= 1);

  return {
    ...(reconciledSubtotalMinor === undefined ? {} : { reconciledSubtotalMinor }),
    ...(subtotalResolution === undefined ? {} : { subtotalResolution }),
    ...(unexplainedDifferenceMinor === undefined ? {} : { unexplainedDifferenceMinor }),
    ...(paymentDifferenceMinor === undefined ? {} : { paymentDifferenceMinor }),
    financiallyConsistent,
    subtotalCorrectedFromOcr: ocrSubtotalMinor !== undefined
      && reconciledSubtotalMinor !== undefined
      && !closeEnough(ocrSubtotalMinor, reconciledSubtotalMinor),
  };
}
