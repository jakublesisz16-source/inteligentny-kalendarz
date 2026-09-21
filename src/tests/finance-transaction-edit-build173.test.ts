import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createFinanceTrip,
  createReceipt,
  deleteDatabaseForTests,
  listExpenseCategories,
  updateReceipt,
} from '../storage/database';

beforeEach(async () => { await deleteDatabaseForTests(); });

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.173 Finance transaction edit integrity', () => {
  it('preserves foreign-currency metadata when a transaction is moved or detached from a trip', async () => {
    const category = (await listExpenseCategories())[0]!;
    await createFinanceTrip('Budapeszt', { currency: 'HUF', exchangeRatePlnPerUnit: 0.0102 });
    await createFinanceTrip('Wiedeń', { currency: 'EUR', exchangeRatePlnPerUnit: 4.25 });
    const receipt = await createReceipt({
      date: '2026-09-18',
      merchant: 'Metro',
      source: 'manual',
      tripName: 'Budapeszt',
      originalCurrency: 'HUF',
      originalAmountMinor: 500_000,
      exchangeRatePlnPerUnit: 0.0102,
      conversionSource: 'rate',
      items: [{ name: 'Bilet', categoryId: category.id, amountMinor: 5_100 }],
    });

    const moved = await updateReceipt(receipt.id, {
      date: receipt.date,
      merchant: receipt.merchant,
      ...(receipt.source ? { source: receipt.source } : {}),
      tripName: 'Wiedeń',
      items: receipt.items,
    });
    expect(moved.tripName).toBe('Wiedeń');
    expect(moved.originalCurrency).toBe('HUF');
    expect(moved.originalAmountMinor).toBe(500_000);

    const detached = await updateReceipt(moved.id, {
      date: moved.date,
      merchant: moved.merchant,
      ...(moved.source ? { source: moved.source } : {}),
      items: moved.items,
    });
    expect(detached.tripName).toBeUndefined();
    expect(detached.originalCurrency).toBe('HUF');
    expect(detached.originalAmountMinor).toBe(500_000);
  });

  it('uses a controlled trip selector instead of accepting a free-form phantom trip name', () => {
    expect(dashboard).toContain('<select value={editReceipt.tripName ?? \'\'}');
    expect(dashboard).toContain('<option value="">Bez wyjazdu</option>');
    expect(dashboard).toContain('tripDefinitions.map((trip) => <option key={trip.id}');
    expect(dashboard).toContain('targetTripIsKnown');
    expect(dashboard).toContain('setEditReceipt(persistedTrip ? { ...form, tripName: persistedTrip.name } : form)');
    expect(dashboard).toContain('Wybierz istniejący wyjazd albo ustaw „Bez wyjazdu”.');
    expect(dashboard).not.toContain('finance-trip-suggestions');
  });

  it('makes the storage currency of editable line amounts explicit and preserves source metadata', () => {
    expect(dashboard).toContain('<span>Kwota (PLN)</span>');
    expect(dashboard).toContain('finance-receipt-edit-currency-context');
    expect(dashboard).toContain('Kwota i waluta źródłowa pozostają bez zmian');
    expect(dashboard).toContain('originalCurrency: receipt.originalCurrency');
    expect(dashboard).toContain('originalAmountMinor: receipt.originalAmountMinor');
  });

  it('keeps legacy trip assignments preservable but not freely creatable in the editor', () => {
    expect(dashboard).toContain('originalTripName?: string');
    expect(dashboard).toContain('starsze przypisanie');
    expect(dashboard).toContain('tripIdentity(originalTripName) === tripIdentity(targetTripName)');
  });

  it('keeps the editor compact on mobile and does not change the database schema', () => {
    expect(components).toContain('1.2.0.173 - Transaction edit keeps trip assignment and foreign-currency context explicit.');
    expect(responsive).toContain('1.2.0.173 - Transaction edit remains explicit without widening the phone modal.');
    expect(responsive).toContain('.finance-receipt-edit-currency-context { grid-template-columns: 1fr; }');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
