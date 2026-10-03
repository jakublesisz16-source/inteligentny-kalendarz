import {
  listExpenseCategories,
  listFinanceTrips,
  listReceipts,
  syncExpenseProductsFromReceipts,
} from '../storage/database';
import type { ExpenseCategory, ExpenseProduct, FinanceTrip, Receipt } from '../shopping/expenses.types';

export interface FinanceWarmData {
  categories: ExpenseCategory[];
  products: ExpenseProduct[];
  receipts: Receipt[];
  trips: FinanceTrip[];
}

let warmSnapshot: FinanceWarmData | null = null;
let warmPromise: Promise<FinanceWarmData> | null = null;
let warmGeneration = 0;

async function readFinanceWarmData(): Promise<FinanceWarmData> {
  const [categories, receipts, trips, products] = await Promise.all([
    listExpenseCategories(),
    listReceipts(),
    listFinanceTrips(),
    syncExpenseProductsFromReceipts(),
  ]);
  return { categories, products, receipts, trips };
}

function startFinanceWarmLoad(generation: number): Promise<FinanceWarmData> {
  const promise = readFinanceWarmData()
    .then((snapshot) => {
      if (generation === warmGeneration) warmSnapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      if (generation === warmGeneration) warmPromise = null;
    });
  warmPromise = promise;
  return promise;
}

export function getFinanceWarmSnapshot(): FinanceWarmData | null {
  return warmSnapshot;
}

export function preloadFinanceData(): Promise<FinanceWarmData> {
  if (warmSnapshot) return Promise.resolve(warmSnapshot);
  if (warmPromise) return warmPromise;
  return startFinanceWarmLoad(warmGeneration);
}

export function refreshFinanceWarmData(): Promise<FinanceWarmData> {
  warmGeneration += 1;
  warmSnapshot = null;
  warmPromise = null;
  return startFinanceWarmLoad(warmGeneration);
}
