import type { ExpenseCategory } from './expenses.types';

export type ExpenseCategoryIconName =
  | 'food'
  | 'drinks'
  | 'home'
  | 'hygiene'
  | 'health'
  | 'clothes'
  | 'electronics'
  | 'transport'
  | 'entertainment'
  | 'deposit'
  | 'other';

const BUILT_IN_CATEGORY_ICONS: Record<string, ExpenseCategoryIconName> = {
  'expense-category-food': 'food',
  'expense-category-drinks': 'drinks',
  'expense-category-home': 'home',
  'expense-category-hygiene': 'hygiene',
  'expense-category-health': 'health',
  'expense-category-clothes': 'clothes',
  'expense-category-electronics': 'electronics',
  'expense-category-transport': 'transport',
  'expense-category-entertainment': 'entertainment',
  'expense-category-deposit': 'deposit',
  'expense-category-other': 'other',
};

export function expenseCategoryIconName(category: Pick<ExpenseCategory, 'id'>): ExpenseCategoryIconName {
  return BUILT_IN_CATEGORY_ICONS[category.id] ?? 'other';
}

function ExpenseCategoryGlyph({ name }: { name: ExpenseCategoryIconName }) {
  switch (name) {
    case 'food':
      return (
        <>
          <path d="M6 3v7M9 3v7M6 6.5h3M7.5 10v11" />
          <path d="M15 3v18M15 3c3.2 1.5 4.5 4 4.5 7.5H15" />
        </>
      );
    case 'drinks':
      return (
        <>
          <path d="M7 4h9l-1 16H8L7 4Z" />
          <path d="M9 8h6M15 5l3-2" />
        </>
      );
    case 'home':
      return (
        <>
          <path d="m3.5 10 8.5-7 8.5 7" />
          <path d="M5.5 9v11h13V9M10 20v-6h4v6" />
        </>
      );
    case 'hygiene':
      return (
        <path d="M12 3.2c2.8 3.6 5 6.2 5 9.4a5 5 0 0 1-10 0c0-3.2 2.2-5.8 5-9.4Z" />
      );
    case 'health':
      return (
        <>
          <path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6v-6Z" />
        </>
      );
    case 'clothes':
      return (
        <path d="m8.5 4 3.5 2 3.5-2 4 3.5-2.7 3.2-2-1.4V21H9.2V9.3l-2 1.4L4.5 7.5 8.5 4Z" />
      );
    case 'electronics':
      return (
        <>
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M9 20h6M12 16v4" />
        </>
      );
    case 'transport':
      return (
        <>
          <path d="M5 15.5 6.8 9h10.4l1.8 6.5v3H5v-3Z" />
          <path d="M7 9l1.5-3h7L17 9M8 18.5v2M16 18.5v2" />
          <circle cx="8.5" cy="14.5" r="1" />
          <circle cx="15.5" cy="14.5" r="1" />
        </>
      );
    case 'entertainment':
      return (
        <>
          <path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z" />
        </>
      );
    case 'deposit':
      return (
        <>
          <path d="M9 3h6v3l2 3v10H7V9l2-3V3Z" />
          <path d="M9 7h6M9.5 13h5" />
        </>
      );
    case 'other':
      return (
        <>
          <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
  }
}

interface ExpenseCategoryIconProps {
  category: Pick<ExpenseCategory, 'id'>;
  className?: string;
}

export function ExpenseCategoryIcon({ category, className }: ExpenseCategoryIconProps) {
  const iconName = expenseCategoryIconName(category);
  return (
    <span className={`expense-category-icon${className ? ` ${className}` : ''}`} aria-hidden="true" data-expense-category-icon={iconName}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <ExpenseCategoryGlyph name={iconName} />
      </svg>
    </span>
  );
}
