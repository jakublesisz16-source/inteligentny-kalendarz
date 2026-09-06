export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  categoryId: string;
  amountMinor: number;
}

export interface Receipt {
  id: string;
  date: string;
  merchant: string;
  items: ReceiptItem[];
  totalMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItemDraft {
  id?: string;
  name: string;
  categoryId: string;
  amountMinor: number;
}

export interface ReceiptDraft {
  date: string;
  merchant: string;
  items: ReceiptItemDraft[];
}
