import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createExpenseCategory,
  createReceipt,
  deleteDatabaseForTests,
  deleteExpenseCategory,
  deleteReceipt,
  getReceipt,
  listExpenseCategories,
  restoreDeletedReceipt,
  updateExpenseCategory,
  updateReceipt,
} from '../storage/database';
import {
  aggregateExpensesByCategoryTree,
  expenseCategoryDescendantIds,
  expenseCategoryPath,
  filterReceiptHistory,
} from '../shopping/expenses.utils';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.23 finance data model', () => {
  it('adds one-level subcategories without changing the database schema', async () => {
    const food = (await listExpenseCategories()).find((category) => category.id === 'expense-category-food')!;
    const dairy = await createExpenseCategory('Nabiał', food.id);
    expect(dairy.parentId).toBe(food.id);
    expect(expenseCategoryPath(await listExpenseCategories(), dairy.id)).toBe('Jedzenie - Nabiał');

    await expect(createExpenseCategory('Jogurty', dairy.id)).rejects.toThrow('jeden poziom podkategorii');
    await expect(deleteExpenseCategory(food.id)).rejects.toThrow('ma podkategorie');
  });

  it('prevents moving a category with children under another parent', async () => {
    const categories = await listExpenseCategories();
    const food = categories.find((category) => category.id === 'expense-category-food')!;
    const home = categories.find((category) => category.id === 'expense-category-home')!;
    await createExpenseCategory('Nabiał', food.id);
    await expect(updateExpenseCategory(food.id, food.name, home.id)).rejects.toThrow('z podkategoriami');
  });

  it('aggregates child spending into the root category and filters a root with descendants', async () => {
    const food = (await listExpenseCategories()).find((category) => category.id === 'expense-category-food')!;
    const dairy = await createExpenseCategory('Nabiał', food.id);
    const receipt = await createReceipt({
      source: 'manual',
      merchant: 'Sklep',
      date: '2026-09-07',
      items: [
        { name: 'Chleb', categoryId: food.id, amountMinor: 500 },
        { name: 'Mleko', categoryId: dairy.id, amountMinor: 400 },
      ],
    });
    const categories = await listExpenseCategories();
    const tree = aggregateExpensesByCategoryTree([receipt], categories, '2026-09');
    const foodAggregate = tree.find((entry) => entry.categoryId === food.id)!;
    expect(foodAggregate.totalMinor).toBe(900);
    expect(foodAggregate.children).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: dairy.id, totalMinor: 400 })]));

    const ids = expenseCategoryDescendantIds(categories, food.id);
    expect(ids).toEqual(expect.arrayContaining([food.id, dairy.id]));
    expect(filterReceiptHistory([receipt], { categoryIds: ids })).toHaveLength(1);
  });

  it('preserves source, createdAt and existing item ids during edit and exact undo restore', async () => {
    const category = (await listExpenseCategories())[0]!;
    const created = await createReceipt({
      source: 'receipt',
      merchant: 'Biedronka',
      date: '2026-09-07',
      items: [{ name: 'Mleko', categoryId: category.id, amountMinor: 449 }],
    });
    const snapshot = structuredClone(created);
    const updated = await updateReceipt(created.id, {
      merchant: 'Biedronka',
      date: created.date,
      items: [{ id: created.items[0]!.id, name: 'Mleko 3,2%', categoryId: category.id, amountMinor: 499 }],
    });
    expect(updated.source).toBe('receipt');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.items[0]!.id).toBe(created.items[0]!.id);

    const persisted = await getReceipt(created.id);
    expect(persisted?.source).toBe('receipt');

    const updatedSnapshot = structuredClone(updated);
    await deleteReceipt(updated.id);
    await restoreDeletedReceipt(updatedSnapshot);
    expect(await getReceipt(updated.id)).toEqual(updatedSnapshot);
    expect(snapshot.id).toBe(updated.id);
  });
});
