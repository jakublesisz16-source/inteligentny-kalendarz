import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');
const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build235 mobile Receipt Scanner save reachability', () => {
  it('treats Receipt Scanner as a real modal so bottom navigation cannot cover its actions', () => {
    expect(flow).toContain("body.classList.add('modal-open')");
    expect(flow).toContain("body.classList.remove('modal-open')");
    expect(flow).toContain('modalOpenCount');
    expect(responsive).toContain('body.modal-open .bottom-nav');
    expect(responsive).toContain('visibility: hidden');
    expect(components).toContain('.receipt-scan-backdrop { position: fixed; inset: 0; z-index: 260;');
  });

  it('keeps one sticky bottom save path inside the mobile safe area', () => {
    expect(review).not.toContain('receipt-review-mobile-save');
    expect(responsive).not.toContain('.receipt-review-mobile-save { display: inline-flex;');
    expect(responsive).toContain('scroll-padding-bottom: calc(68px + max(12px,env(safe-area-inset-bottom)))');
    expect(responsive).toContain('.receipt-review-actions { bottom: 0;');
    expect(responsive).toContain('padding: 10px 10px max(10px,env(safe-area-inset-bottom))');
  });

  it('keeps the 1.2.0 release line and schema 14', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
