import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expenseCategoryIconName } from '../shopping/ExpenseCategoryIcon';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.1.0-dev.2 FIX3 expense category icons', () => {
  it('maps stable built-in category ids to semantic icons', () => {
    expect(expenseCategoryIconName({ id: 'expense-category-food' })).toBe('food');
    expect(expenseCategoryIconName({ id: 'expense-category-health' })).toBe('health');
    expect(expenseCategoryIconName({ id: 'expense-category-transport' })).toBe('transport');
    expect(expenseCategoryIconName({ id: 'expense-category-deposit' })).toBe('deposit');
    expect(expenseCategoryIconName({ id: 'expense-category-other' })).toBe('other');
  });

  it('uses a neutral fallback for custom categories', () => {
    expect(expenseCategoryIconName({ id: 'custom-holidays' })).toBe('other');
  });

  it('renders category icons in the expenses dashboard without changing persisted category data', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    const categoryTypes = source('../shopping/expenses.types.ts');
    expect(expenses).toContain("import { ExpenseCategoryIcon } from './ExpenseCategoryIcon';");
    expect(expenses).toContain('<ExpenseCategoryIcon category={category} />');
    expect(expenses).toContain('expense-category-analytics-row');
    expect(categoryTypes).not.toContain('iconName');
    expect(categoryTypes).not.toContain('iconType');
  });

  it('keeps category icons decorative and names, amounts and percentages textual', () => {
    const icons = source('../shopping/ExpenseCategoryIcon.tsx');
    const expenses = source('../shopping/ExpensesView.tsx');
    expect(icons).toContain('aria-hidden="true"');
    expect(expenses).toContain('<strong>{entry.name}</strong>');
    expect(expenses).toContain('entry.sharePercent.toFixed(1)');
    expect(expenses).toContain('formatMoneyMinor(entry.totalMinor)');
  });

  it('keeps the compact expand-collapse category flow from FIX1', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    expect(expenses).toContain('categoryAnalytics.slice(0, 4)');
    expect(expenses).toContain('Pokaż wszystkie kategorie');
    expect(expenses).toContain('Zwiń kategorie');
  });
});
