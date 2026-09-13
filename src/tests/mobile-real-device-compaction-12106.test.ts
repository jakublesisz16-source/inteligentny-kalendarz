import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const financeView = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const interfaceCss = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const comparison = readFileSync(new URL('../work/AvailabilityWorkComparisonPanel.tsx', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.106 real-device mobile compaction', () => {
  it('keeps receipt scanning visible in the mobile Finance actions row', () => {
    expect(financeView).toContain('finance-scan-receipt');
    expect(interfaceCss).toContain('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt');
    expect(interfaceCss).toContain('display: inline-flex !important;');
  });

  it('uses compact partition selects for Study group import on phones', () => {
    expect(studyView).toContain('study-import-group-dashboard');
    expect(studyView).toContain('setImportPartitionGroup');
    expect(studyView).toContain('Wybierz grupę importu:');
    expect(interfaceCss).toContain('.study-import-group-grid-desktop { display: none; }');
    expect(interfaceCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('compacts Work cards while keeping touch targets and summary facts readable', () => {
    expect(interfaceCss).toContain('.availability-dashboard-layout .availability-week-day');
    expect(interfaceCss).toContain('min-height: 42px;');
    expect(interfaceCss).toContain('.work-summary-facts.work-summary-facts-grid');
    expect(comparison).toContain('aby porównać ją z grafikiem');
  });

  it('is synchronized to 1.2.0.106', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
  });
});
