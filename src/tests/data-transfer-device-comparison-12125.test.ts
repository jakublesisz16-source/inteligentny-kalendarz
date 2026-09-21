import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('src/data-transfer/DataTransferPanel.tsx', 'utf8');
const database = readFileSync('src/storage/database.ts', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.146 safer data-transfer decision preview', () => {
  it('captures the current device summary before allowing import confirmation', () => {
    expect(database).toContain('export async function getCurrentDataTransferSummary(): Promise<BackupSummary>');
    expect(panel).toContain('getCurrentDataTransferSummary()');
    expect(panel).toContain('Promise.all([inspectDataTransferText(text), getCurrentDataTransferSummary()])');
  });

  it('shows device-to-file comparison and warns about reductions', () => {
    expect(panel).toContain('Co zostanie zastąpione');
    expect(panel).toContain('Na urządzeniu → w pliku');
    expect(panel).toContain('data-transfer-reduction-warning');
    expect(panel).toContain('Punkt przywracania pozwoli wrócić do stanu sprzed importu.');
  });

  it('keeps the comparison compact on desktop and mobile', () => {
    expect(components).toContain('.data-transfer-comparison-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(responsive).toContain('.data-transfer-comparison-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(responsive).toContain('.data-transfer-comparison-grid { grid-template-columns: 1fr; }');
  });

  it('keeps schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
