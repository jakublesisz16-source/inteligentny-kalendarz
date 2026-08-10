import type { ShoppingItem } from './shopping.types';

export function normalizeShoppingName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeShoppingQuantity(value?: string): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

export function sortShoppingItems(items: ShoppingItem[]): { active: ShoppingItem[]; purchased: ShoppingItem[] } {
  const active = items
    .filter((item) => !item.isPurchased)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const purchased = items
    .filter((item) => item.isPurchased)
    .slice()
    .sort((a, b) => (b.purchasedAt ?? b.updatedAt).localeCompare(a.purchasedAt ?? a.updatedAt) || a.id.localeCompare(b.id));
  return { active, purchased };
}
