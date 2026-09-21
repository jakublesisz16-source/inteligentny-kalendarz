import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createReceipt,
  deleteDatabaseForTests,
  getReceipt,
  listExpenseCategories,
  listExpenseProducts,
  syncExpenseProductsFromReceipts,
  updateExpenseProduct,
  updateReceiptItemCategory,
} from '../storage/database';

describe('Build165 finance category persistence consistency', () => {
  beforeEach(async () => { await deleteDatabaseForTests(); });

  it('synchronizes the canonical product even when the receipt item already stores the requested category', async () => {
    const categories = await listExpenseCategories();
    const food = categories.find((entry) => entry.id === 'expense-category-food')!;
    const drinks = categories.find((entry) => entry.id === 'expense-category-drinks')!;
    const receipt = await createReceipt({
      merchant: 'Sklep',
      date: '2026-09-20',
      source: 'receipt',
      items: [{ name: 'Mleko testowe 1l', categoryId: food.id, amountMinor: 499 }],
    });
    const [product] = await syncExpenseProductsFromReceipts();
    await updateExpenseProduct(product!.id, { name: product!.name, categoryId: drinks.id, necessity: 'essential' });

    await updateReceiptItemCategory(receipt.id, receipt.items[0]!.id, food.id);

    expect((await getReceipt(receipt.id))!.items[0]!.categoryId).toBe(food.id);
    expect((await listExpenseProducts())[0]!.categoryId).toBe(food.id);
  });
});
