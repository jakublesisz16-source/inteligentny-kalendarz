export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  isPurchased: boolean;
  createdAt: string;
  updatedAt: string;
  purchasedAt?: string;
}

export interface ShoppingItemDraft {
  name: string;
  quantity?: string;
}
