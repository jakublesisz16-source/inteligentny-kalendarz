import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modal = readFileSync('src/ui/Modal.tsx', 'utf8');
const quickExpense = readFileSync('src/finance/FinanceQuickExpenseModal.tsx', 'utf8');
const finance = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');
const indexHtml = readFileSync('index.html', 'utf8');

describe('1.2.0.92 mobile modal action safety', () => {
  it('marks the document while a modal is open so bottom navigation cannot cover actions', () => {
    expect(modal).toContain("body.classList.add('modal-open')");
    expect(modal).toContain("body.classList.remove('modal-open')");
    expect(modal).toContain('modalOpenCount');
    expect(responsive).toContain('body.modal-open .bottom-nav');
    expect(responsive).toContain('visibility: hidden');
    expect(responsive).toContain('pointer-events: none');
  });

  it('bounds mobile modals to the dynamic viewport and keeps the header sticky', () => {
    expect(responsive).toContain('max-height: calc(100dvh - max(8px, env(safe-area-inset-top)))');
    expect(responsive).toContain('overscroll-behavior: contain');
    expect(responsive).toContain('.modal-mobile-header-save');
    expect(responsive).toContain('display: inline-flex');
    expect(indexHtml).toContain('interactive-widget=resizes-content');
  });

  it('keeps quick expense save reachable from the sticky modal header', () => {
    expect(quickExpense).toContain('form="finance-quick-expense-form"');
    expect(quickExpense).toContain('modal-mobile-header-save finance-mobile-header-save');
    expect(quickExpense).toContain('id="finance-quick-expense-form"');
    expect(responsive).toContain('.finance-quick-expense-form .modal-actions');
    expect(responsive).toContain('display: none !important');
  });

  it('also exposes mobile header save for long Finance edit forms', () => {
    expect(finance).toContain('form="finance-receipt-edit-form"');
    expect(finance).toContain('id="finance-receipt-edit-form"');
    expect(finance).toContain('form="finance-product-editor-form"');
    expect(finance).toContain('id="finance-product-editor-form"');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
