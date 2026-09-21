export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReceiptSource = 'manual' | 'receipt';
export type FinanceCurrencyCode = 'PLN' | 'EUR' | 'HUF' | 'CZK' | 'GBP' | 'USD' | 'CHF' | 'RON' | 'DKK' | 'SEK' | 'NOK' | 'TRY' | 'JPY';
export type FinanceConversionSource = 'rate' | 'actual';

export interface FinanceTrip {
  id: string;
  name: string;
  currency?: FinanceCurrencyCode;
  exchangeRatePlnPerUnit?: number;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseNecessity = 'essential' | 'nonessential' | 'unknown';
export type ReceiptItemUnit = 'szt' | 'kg' | 'g' | 'mg' | 'l' | 'ml' | 'cl' | 'dl' | 'op';

export interface ExpenseProduct {
  id: string;
  name: string;
  originalName: string;
  normalizedKey: string;
  categoryId: string;
  necessity?: ExpenseNecessity;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseProductDraft {
  name: string;
  categoryId: string;
  necessity?: ExpenseNecessity;
}

export interface ReceiptItem {
  id: string;
  name: string;
  categoryId: string;
  amountMinor: number;
  quantity?: number;
  unit?: ReceiptItemUnit;
  unitPriceMinor?: number;
}

export interface Receipt {
  id: string;
  date: string;
  merchant: string;
  items: ReceiptItem[];
  totalMinor: number;
  source?: ReceiptSource;
  sourceFingerprint?: string;
  tripName?: string;
  originalCurrency?: FinanceCurrencyCode;
  originalAmountMinor?: number;
  exchangeRatePlnPerUnit?: number;
  conversionSource?: FinanceConversionSource;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItemDraft {
  id?: string;
  name: string;
  categoryId: string;
  amountMinor: number;
  quantity?: number;
  unit?: ReceiptItemUnit;
  unitPriceMinor?: number;
}

export interface ReceiptDraft {
  date: string;
  merchant: string;
  items: ReceiptItemDraft[];
  source?: ReceiptSource;
  sourceFingerprint?: string;
  tripName?: string;
  originalCurrency?: FinanceCurrencyCode;
  originalAmountMinor?: number;
  exchangeRatePlnPerUnit?: number;
  conversionSource?: FinanceConversionSource;
}
