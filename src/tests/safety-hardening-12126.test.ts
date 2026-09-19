import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const database = readFileSync('src/storage/database.ts', 'utf8');
const center = readFileSync('src/safety/SafetyCenter.tsx', 'utf8');
const types = readFileSync('src/safety/safety.types.ts', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.145 safety center hardening', () => {
  it('creates a restore point before permanently deleting one trash item', () => {
    expect(types).toContain("'PERMANENT_DELETE_TRASH'");
    expect(types).toContain("'BEFORE_PERMANENT_TRASH_DELETE'");
    expect(database).toContain("createRestorePoint(`Przed trwałym usunięciem z Kosza: ${item.displayName}`, 'BEFORE_PERMANENT_TRASH_DELETE', true)");
    expect(database).toContain("operationType: 'PERMANENT_DELETE_TRASH'");
    expect(database).toContain('restorePointId: safety.id');
  });

  it('keeps manual restore points user-manageable instead of pinning them forever', () => {
    expect(center).toContain("createRestorePoint(restoreName || 'Ręczny punkt przywracania', 'MANUAL')");
    expect(center).not.toContain("'MANUAL', false, true");
    expect(center).toContain('Usunąć punkt przywracania');
    expect(database).toContain("if (point.pinned) throw new Error(\'Ten punkt jest chroniony przez aplikację i nie może zostać usunięty.\');");
  });

  it('fails closed for restore points from a different database schema', () => {
    expect(database).toContain('point.schemaVersion !== point.snapshot.databaseSchemaVersion');
    expect(database).toContain('point.snapshot.databaseSchemaVersion < DATABASE_SCHEMA_VERSION');
    expect(database).toContain('nie można go bezpiecznie przywrócić bezpośrednio');
    expect(center).toContain("!compatible ? ' - archiwalny' : ''");
    expect(center).toContain("compatible ? 'Przywróć' : 'Archiwalny'");
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
