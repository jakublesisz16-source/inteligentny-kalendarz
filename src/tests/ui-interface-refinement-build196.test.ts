import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8');
describe('Build196 interface refinement', () => {
  it('loads after the compact mobile layer', () => {
    expect(index.trim().endsWith("@import './interface-refinement.css';")).toBe(true);
  });
  it('keeps compact layouts readable rather than shrinking key text', () => {
    expect(css).toContain('Readability floor: compact spacing, never microscopic information.');
    expect(css).toContain('.work-shift-main-line span,');
    expect(css).toContain('font-size: .74rem;');
  });
  it('flattens nested mobile surfaces in finance, study and settings', () => {
    expect(css).toContain('.finance-trips-overview');
    expect(css).toContain('.study-view .study-upload-dashboard');
    expect(css).toContain('.settings-collapsible-body .data-transfer-panel');
  });
  it('keeps Today add compact despite older important width rule', () => {
    expect(css).toContain('width: auto !important;');
    expect(css).toContain('min-width: 112px;');
  });
});
