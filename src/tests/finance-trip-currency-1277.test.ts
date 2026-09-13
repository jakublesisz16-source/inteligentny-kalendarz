import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFinanceTrip,
  createReceipt,
  deleteDatabaseForTests,
  listExpenseCategories,
  listFinanceTrips,
  updateFinanceTripCurrency,
  updateReceipt,
} from '../storage/database';
import { convertForeignMinorToPlnMinor, formatCurrencyAmountMinor } from '../shopping/expenses.utils';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.77 Finance trip currencies', () => {
  it('persists a trip default currency and optional PLN rate without a schema bump', async () => {
    const trip = await createFinanceTrip('Praga', { currency: 'HUF', exchangeRatePlnPerUnit: 0.0103 });
    expect(trip.currency).toBe('HUF');
    expect(trip.exchangeRatePlnPerUnit).toBe(0.0103);

    const updated = await updateFinanceTripCurrency(trip.id, 'EUR', 4.25);
    expect(updated.currency).toBe('EUR');
    expect(updated.exchangeRatePlnPerUnit).toBe(4.25);
    expect((await listFinanceTrips())[0]?.currency).toBe('EUR');
  });

  it('keeps the original foreign amount while the receipt total stays in PLN', async () => {
    const category = (await listExpenseCategories())[0];
    expect(category).toBeTruthy();
    const originalAmountMinor = 1_250_000; // 12 500 HUF in the generic 1/100 storage scale.
    const rate = 0.0103;
    const amountMinor = convertForeignMinorToPlnMinor(originalAmountMinor, rate);
    expect(amountMinor).toBe(12_875);

    const receipt = await createReceipt({
      date: '2026-09-12',
      merchant: 'Budapest étterem',
      source: 'manual',
      tripName: 'Praga',
      originalCurrency: 'HUF',
      originalAmountMinor,
      exchangeRatePlnPerUnit: rate,
      conversionSource: 'rate',
      items: [{ name: 'Kolacja', categoryId: category!.id, amountMinor: amountMinor! }],
    });

    expect(receipt.totalMinor).toBe(12_875);
    expect(receipt.originalCurrency).toBe('HUF');
    expect(receipt.originalAmountMinor).toBe(originalAmountMinor);
    expect(receipt.conversionSource).toBe('rate');
    expect(formatCurrencyAmountMinor(originalAmountMinor, 'HUF')).toContain('12');
  });

  it('recalculates the effective rate if a foreign transaction PLN value is edited later', async () => {
    const category = (await listExpenseCategories())[0]!;
    const receipt = await createReceipt({
      date: '2026-09-12',
      merchant: 'Metro Budapest',
      source: 'manual',
      tripName: 'Praga',
      originalCurrency: 'HUF',
      originalAmountMinor: 500_000,
      exchangeRatePlnPerUnit: 0.01,
      conversionSource: 'actual',
      items: [{ name: 'Bilet', categoryId: category.id, amountMinor: 5_000 }],
    });

    const edited = await updateReceipt(receipt.id, {
      date: receipt.date,
      merchant: receipt.merchant,
      ...(receipt.source ? { source: receipt.source } : {}),
      ...(receipt.tripName ? { tripName: receipt.tripName } : {}),
      items: [{ id: receipt.items[0]!.id, name: 'Bilet', categoryId: category.id, amountMinor: 5_250 }],
    });

    expect(edited.originalAmountMinor).toBe(500_000);
    expect(edited.totalMinor).toBe(5_250);
    expect(edited.exchangeRatePlnPerUnit).toBe(0.0105);
  });
});
