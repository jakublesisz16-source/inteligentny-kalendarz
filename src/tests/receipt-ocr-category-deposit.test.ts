import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDatabaseForTests, listExpenseCategories } from '../storage/database';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.1.0-dev.3 DEV3-B020 deposit category', () => {
  it('seeds eleven defaults including the deposit category', async () => {
    const categories = await listExpenseCategories();
    expect(categories).toHaveLength(11);
    expect(categories.some((category) => category.id === 'expense-category-deposit' && category.name === 'Kaucja / opakowania zwrotne')).toBe(true);
  });

  it('suggests the dedicated deposit category for a positive deposit item', async () => {
    const categories = await listExpenseCategories();
    expect(suggestCategoryId('But Plastik kaucja', [], categories)).toBe('expense-category-deposit');
  });

  it('does not duplicate a legacy custom equivalent deposit category', async () => {
    await deleteDatabaseForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 13);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('expenseCategories', { keyPath: 'id' });
        store.put({ id: 'legacy-kaucja', name: 'Kaucja', sortOrder: 0, createdAt: '', updatedAt: '' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    const categories = await listExpenseCategories();
    expect(categories.filter((category) => /kaucja|opakowania zwrotne/iu.test(category.name))).toHaveLength(1);
    expect(categories[0]?.id).toBe('legacy-kaucja');
  });
});
