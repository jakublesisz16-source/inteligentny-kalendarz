import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeScheduleDiffChangeTypes } from '../study/study-diff';
import type { ScheduleDiffItem } from '../study/study.types';

const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const diffView = readFileSync(new URL('../study/ScheduleDiffView.tsx', import.meta.url), 'utf8');
const database = readFileSync(new URL('../storage/database.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

function changedItem(id: string, changeTypes: ScheduleDiffItem['changeTypes']): ScheduleDiffItem {
  return {
    id,
    kind: 'CHANGED',
    changeTypes,
    changes: [],
    resolution: 'APPLY',
  };
}

describe('1.2.0.111 study plan freshness and diff summary', () => {
  it('shows the active plan import time and latest persisted comparison summary', () => {
    expect(database).toContain('getLatestAppliedScheduleUpdateSession');
    expect(studyView).toContain('Status aktualnego planu studiów');
    expect(studyView).toContain('Zaimportowano');
    expect(studyView).toContain('Ostatnie porównanie');
    expect(studyView).toContain('latestAppliedUpdate?.newFileHash === activeImport.fileHash');
  });

  it('breaks changed lessons down by time, date, location, group and details', () => {
    expect(summarizeScheduleDiffChangeTypes([
      changedItem('one', ['CHANGED_TIME', 'CHANGED_LOCATION']),
      changedItem('two', ['CHANGED_TIME', 'CHANGED_GROUP']),
      changedItem('three', ['CHANGED_DATE', 'CHANGED_DETAILS']),
    ])).toEqual({ time: 2, date: 1, location: 1, group: 1, details: 1 });
    expect(diffView).toContain('W zmienionych zajęciach:');
    expect(diffView).toContain('Godziny');
    expect(diffView).toContain('Lokalizacje');
    expect(diffView).toContain('Grupy');
  });

  it('keeps the status compact on desktop and mobile without a schema migration', () => {
    expect(styles).toContain('1.2.0.111 - compact study plan freshness and readable update breakdown.');
    expect(styles).toContain('.study-plan-freshness');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
