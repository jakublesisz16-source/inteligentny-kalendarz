import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const finance = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');

describe('Build184 mobile navigation safety and Finance readability', () => {
  it('keeps the bottom navigation fully above phone content', () => {
    expect(styles).toContain('/* 1.2.0.184 - Finance gets clearer phone spacing and typography. */');
    expect(styles).not.toContain('--mobile-nav-viewport-lift');
  });

  it('starts a newly selected main view at the top', () => {
    expect(app).toContain('function changeView(nextView: AppView)');
    expect(app).toContain("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })");
    expect(app).toContain('<Navigation activeView={view} onChange={changeView} />');
  });

  it('keeps mobile Finance labels and summaries readable', () => {
    expect(finance).toContain('finance-scan-receipt-short');
    expect(finance).toContain('finance-scan-receipt-long');
    expect(styles).toContain('.finance-scan-receipt-long { display: none; }');
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('-webkit-line-clamp: 2;');
  });
});
