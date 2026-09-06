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
  listReceipts,
  restoreDeletedReceipt,
  updateExpenseCategory,
  updateReceipt,
} from '../storage/database';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.1.0-dev.1 expense storage', () => {
  it('seeds default categories exactly once and supports category CRUD', async () => {
    const first = await listExpenseCategories();
    const second = await listExpenseCategories();
    expect(first).toHaveLength(11);
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id));
    expect(first.map((entry) => entry.name)).toEqual([
      'Jedzenie', 'Napoje', 'Dom / Chemia', 'Higiena / Kosmetyki', 'Zdrowie',
      'Ubrania', 'Elektronika', 'Transport', 'Rozrywka', 'Kaucja / opakowania zwrotne', 'Inne',
    ]);

    const custom = await createExpenseCategory('  Zwierzęta  ');
    expect(custom.name).toBe('Zwierzęta');
    await expect(createExpenseCategory('zwierzęta')).rejects.toThrow('już istnieje');
    await expect(createExpenseCategory('   ')).rejects.toThrow('nazwę kategorii');

    const renamed = await updateExpenseCategory(custom.id, 'Pupil');
    expect(renamed.id).toBe(custom.id);
    expect(renamed.name).toBe('Pupil');
    await deleteExpenseCategory(custom.id);
    expect((await listExpenseCategories()).some((entry) => entry.id === custom.id)).toBe(false);
  });

  it('creates, persists, updates and deletes receipts with recalculated totals', async () => {
    const category = (await listExpenseCategories())[0]!;
    const created = await createReceipt({
      merchant: '  Biedronka ',
      date: '2026-08-15',
      items: [
        { name: ' Mleko ', categoryId: category.id, amountMinor: 449 },
        { name: 'Chleb', categoryId: category.id, amountMinor: 599 },
      ],
    });
    expect(created.merchant).toBe('Biedronka');
    expect(created.totalMinor).toBe(1048);
    expect((await getReceipt(created.id))?.totalMinor).toBe(1048);
    expect(await listReceipts()).toHaveLength(1);

    const updated = await updateReceipt(created.id, {
      merchant: 'Lidl',
      date: created.date,
      items: [{ id: created.items[0]!.id, name: 'Mleko', categoryId: category.id, amountMinor: 500 }],
    });
    expect(updated.totalMinor).toBe(500);
    expect(updated.items[0]!.id).toBe(created.items[0]!.id);

    await expect(createReceipt({ merchant: 'X', date: '2026-08-15', items: [{ name: 'Błąd', categoryId: category.id, amountMinor: 0 }] })).rejects.toThrow('prawidłową kwotę');
    await deleteReceipt(created.id);
    expect(await listReceipts()).toEqual([]);
  });


  it('restores the exact deleted receipt for temporary undo and blocks duplicate restore', async () => {
    const category = (await listExpenseCategories())[0]!;
    const created = await createReceipt({ merchant: 'Lidl', date: '2026-08-15', items: [{ name: 'Mleko', categoryId: category.id, amountMinor: 449 }] });
    const snapshot = structuredClone(created);
    await deleteReceipt(created.id);
    expect(await getReceipt(created.id)).toBeUndefined();
    await restoreDeletedReceipt(snapshot);
    expect(await getReceipt(created.id)).toEqual(snapshot);
    await expect(restoreDeletedReceipt(snapshot)).rejects.toThrow('już istnieje');
  });

  it('blocks deletion of a category referenced by a receipt', async () => {
    const category = (await listExpenseCategories())[0]!;
    await createReceipt({ merchant: 'Sklep', date: '2026-08-15', items: [{ name: 'Produkt', categoryId: category.id, amountMinor: 100 }] });
    await expect(deleteExpenseCategory(category.id)).rejects.toThrow('używana przez zapisane paragony');
  });
});
