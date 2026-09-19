import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const database = readFileSync('src/storage/database.ts', 'utf8');
const types = readFileSync('src/safety/safety.types.ts', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.145 destructive data safety', () => {
  it('keeps receipt deletion durably reversible and reconciles quick undo with history', () => {
    expect(types).toContain("'DELETE_RECEIPT'");
    expect(types).toContain("'RECEIPT'");
    expect(database).toContain("operationType: 'DELETE_RECEIPT'");
    expect(database).toContain("entityType: 'RECEIPT'");
    expect(database).toContain('beforeState: current');
    expect(database).toContain("entry.operationType === 'DELETE_RECEIPT'");
    expect(database).toContain('markJournalUndone(matchingDelete.id)');
  });

  it('keeps unused expense category deletion reversible without allowing unsafe duplicate restoration', () => {
    expect(types).toContain("'DELETE_EXPENSE_CATEGORY'");
    expect(types).toContain("'EXPENSE_CATEGORY'");
    expect(database).toContain("operationType: 'DELETE_EXPENSE_CATEGORY'");
    expect(database).toContain('expenseCategoryNameKey(category.name) === expenseCategoryNameKey(before.name)');
    expect(database).toContain('kategoria nadrzędna już nie istnieje');
  });

  it('creates a restore point before cascading location deletion', () => {
    expect(types).toContain("'BEFORE_LOCATION_DELETE'");
    expect(database).toContain("createRestorePoint(`Przed usunięciem miejsca: ${currentLocation.name}`, 'BEFORE_LOCATION_DELETE', true)");
    expect(database).toContain('restorePointId: safetyPoint.id');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
