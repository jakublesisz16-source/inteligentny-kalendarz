import 'fake-indexeddb/auto';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createExcelExportFile } from '../data-transfer/excel-export';
import {
  createCanonicalDataTransferDocument,
  createReceipt,
  deleteDatabaseForTests,
  listExpenseCategories,
  listExpenseProducts,
  listReceipts,
  resetDatabaseConnectionForTests,
  syncExpenseProductsFromReceipts,
  updateExpenseProduct,
} from '../storage/database';
import { buildExpenseProductIndex, resolveExpenseItemClassification } from '../shopping/expenses.utils';
import type { ExpenseNecessity, Receipt } from '../shopping/expenses.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function setAndReloadNecessity(productId: string, necessity: ExpenseNecessity) {
  const product = (await listExpenseProducts()).find((entry) => entry.id === productId)!;
  await updateExpenseProduct(product.id, {
    name: product.name,
    categoryId: product.categoryId,
    necessity,
  });
  resetDatabaseConnectionForTests();
  await Promise.resolve();
  const products = await syncExpenseProductsFromReceipts();
  return products.find((entry) => entry.id === productId)!;
}

function necessitiesForReceipts(receipts: Receipt[], products: Awaited<ReturnType<typeof listExpenseProducts>>) {
  const productByKey = buildExpenseProductIndex(products);
  return receipts.flatMap((receipt) => receipt.items.map((item) => resolveExpenseItemClassification(item, productByKey).necessity));
}

async function exportedNecessityLabels(): Promise<string[]> {
  const document = await createCanonicalDataTransferDocument();
  const file = await createExcelExportFile(document, new Date(2026, 8, 20, 12, 0));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet('Pozycje paragonów')!;
  const labels: string[] = [];
  for (let row = 2; row <= sheet.rowCount; row += 1) labels.push(String(sheet.getCell(`L${row}`).value ?? ''));
  return labels.sort();
}

describe('Build167 Finance necessity end-to-end persistence', () => {
  it('persists Do oceny -> Niezbędne/Zbędne across a database reconnect and keeps Month, Trip/detail resolver and XLSX export consistent', async () => {
    const categories = await listExpenseCategories();
    const food = categories.find((entry) => entry.id === 'expense-category-food')!;
    const name = 'Produkt neutralny test 167';

    await createReceipt({
      merchant: 'Sklep miesiąc',
      date: '2026-09-20',
      source: 'manual',
      items: [{ name, categoryId: food.id, amountMinor: 499 }],
    });
    await createReceipt({
      merchant: 'Sklep wyjazd',
      date: '2026-09-21',
      source: 'manual',
      tripName: 'Budapeszt',
      items: [{ name, categoryId: food.id, amountMinor: 599 }],
    });

    const [created] = await syncExpenseProductsFromReceipts();
    expect(created?.necessity).toBe('unknown');

    const afterEssentialReload = await setAndReloadNecessity(created!.id, 'essential');
    expect(afterEssentialReload.necessity).toBe('essential');
    const essentialReceipts = await listReceipts();
    expect(necessitiesForReceipts(essentialReceipts, await listExpenseProducts())).toEqual(['essential', 'essential']);
    expect(await exportedNecessityLabels()).toEqual(['Niezbędne', 'Niezbędne']);

    const afterNonessentialReload = await setAndReloadNecessity(created!.id, 'nonessential');
    expect(afterNonessentialReload.necessity).toBe('nonessential');
    const nonessentialReceipts = await listReceipts();
    expect(necessitiesForReceipts(nonessentialReceipts, await listExpenseProducts())).toEqual(['nonessential', 'nonessential']);
    expect(await exportedNecessityLabels()).toEqual(['Zbędne', 'Zbędne']);
  });
});
