import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFinanceTrip, deleteDatabaseForTests, deleteFinanceTrip, listFinanceTrips } from '../storage/database';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.76 persistent finance trips', () => {
  it('persists an empty trip independently from receipts without a schema bump', async () => {
    const created = await createFinanceTrip('  Budapeszt  ');
    expect(created.name).toBe('Budapeszt');
    expect((await listFinanceTrips()).map((trip) => trip.name)).toEqual(['Budapeszt']);

    const duplicate = await createFinanceTrip('budapeszt');
    expect(duplicate.id).toBe(created.id);
    expect(await listFinanceTrips()).toHaveLength(1);

    await deleteFinanceTrip(created.id);
    expect(await listFinanceTrips()).toEqual([]);
  });
});
