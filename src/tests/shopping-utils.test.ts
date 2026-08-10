import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '../shopping/shopping.types';
import { normalizeShoppingName, normalizeShoppingQuantity, sortShoppingItems } from '../shopping/shopping.utils';

function item(input: Partial<ShoppingItem> & Pick<ShoppingItem, 'id' | 'name' | 'createdAt'>): ShoppingItem {
  return {
    isPurchased: false,
    updatedAt: input.createdAt,
    ...input,
  };
}

describe('shopping utils', () => {
  it('normalizes names and optional quantities', () => {
    expect(normalizeShoppingName('  Papier   kuchenny ')).toBe('Papier kuchenny');
    expect(normalizeShoppingQuantity(' 1   kg ')).toBe('1 kg');
    expect(normalizeShoppingQuantity('   ')).toBeUndefined();
  });

  it('sorts active oldest first and purchased newest first', () => {
    const sorted = sortShoppingItems([
      item({ id: 'a2', name: 'B', createdAt: '2026-08-02T10:00:00Z' }),
      item({ id: 'a1', name: 'A', createdAt: '2026-08-01T10:00:00Z' }),
      item({ id: 'p1', name: 'P1', createdAt: '2026-08-01T10:00:00Z', isPurchased: true, purchasedAt: '2026-08-05T10:00:00Z' }),
      item({ id: 'p2', name: 'P2', createdAt: '2026-08-01T10:00:00Z', isPurchased: true, purchasedAt: '2026-08-06T10:00:00Z' }),
    ]);
    expect(sorted.active.map((entry) => entry.id)).toEqual(['a1', 'a2']);
    expect(sorted.purchased.map((entry) => entry.id)).toEqual(['p2', 'p1']);
  });
});
