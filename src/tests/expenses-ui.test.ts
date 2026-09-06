import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.1.0-dev.2 FIX1 expenses UI contract', () => {
  it('keeps shopping list as the default internal section and exposes Wydatki', () => {
    const shopping = source('../shopping/ShoppingView.tsx');
    expect(shopping).toContain("useState<'LIST' | 'EXPENSES'>('LIST')");
    expect(shopping).toContain('>Lista</button>');
    expect(shopping).toContain('>Wydatki</button>');
    expect(shopping).toContain('<ExpensesView />');
  });

  it('keeps manual receipt create/edit/delete independent from the OCR flow', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    expect(expenses).toContain('+ Paragon');
    expect((expenses.match(/\+ Paragon/g) ?? []).length).toBe(1);
    expect(expenses).not.toContain('+ Dodaj paragon');
    expect(expenses).toContain('Zapisz paragon');
    expect(expenses).toContain('Edytuj');
    expect(expenses).toContain('Usuń');
    expect(expenses).toContain('Poprzedni miesiąc');
    expect(expenses).toContain('Następny miesiąc');
    expect(expenses).toContain('Skanuj paragon');
    expect(expenses).toContain('openNewReceipt');
    expect(expenses).toContain('openReceiptScan');
    expect(expenses).not.toContain('fetch(');
  });
  it('keeps modal focus stable while controlled fields rerender', () => {
    const modal = source('../ui/Modal.tsx');
    expect(modal).toContain('const onCloseRef = useRef(onClose);');
    expect(modal).toContain('onCloseRef.current = onClose;');
    expect(modal).toContain('onCloseRef.current();');
    expect(modal).not.toContain('}, [onClose]);');
  });

  it('shows detailed local analytics and an accessible six-month chart without external chart libraries', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    expect(expenses).toContain('Wydatki - ostatnie 6 miesięcy');
    expect(expenses).toContain('Średni paragon');
    expect(expenses).toContain('vs poprzedni miesiąc');
    expect(expenses).toContain('Największe wydatki');
    expect(expenses).toContain('Najczęściej pojawiające się');
    expect(expenses).toContain('aria-label="Wydatki w ostatnich sześciu miesiącach"');
    expect(expenses).toContain('<svg');
    expect(expenses).not.toContain('Chart.js');
    expect(expenses).not.toContain('recharts');
    expect(expenses).not.toContain('d3');
  });

  it('keeps the high-priority dashboard compact and expands secondary detail on demand', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    const shopping = source('../shopping/ShoppingView.tsx');
    expect(expenses.indexOf('+ Paragon')).toBeLessThan(expenses.indexOf('expense-metrics-grid'));
    expect(expenses).toContain('categoryAnalytics.slice(0, 4)');
    expect(expenses).toContain('filteredReceipts.slice(0, 3)');
    expect(expenses).toContain('merchantAnalytics.slice(0, 3)');
    expect(expenses).toContain("showAllProducts ? 10 : 5");
    expect(expenses).toContain('Pokaż wszystkie kategorie');
    expect(expenses).toContain('Pokaż wszystkie paragony');
    expect(expenses).toContain('Pokaż wszystkie sklepy');
    expect(expenses).toContain('Więcej o produktach');
    expect(expenses).not.toContain('Najważniejsze wyniki');
    expect(shopping).toContain("shopping-view-expenses");
  });

  it('keeps interactive chart values, local receipt search/filtering and temporary undo alongside OCR', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    expect(expenses).toContain('expense-chart-tooltip');
    expect(expenses).toContain('onMouseEnter');
    expect(expenses).toContain('onFocus');
    expect(expenses).toContain('onClick={() => activate(point.monthKey)}');
    expect(expenses).toContain('Szukaj w paragonach');
    expect(expenses).toContain('Sklep lub produkt');
    expect(expenses).toContain('filterReceiptHistory');
    expect(expenses).toContain('Wyczyść filtry');
    expect(expenses).toContain('Paragon usunięty.');
    expect(expenses).toContain('Cofnij');
    expect(expenses).toContain('Date.now() + 8000');
    expect(expenses).toContain('ReceiptScanFlow');
  });

});
