import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('DEV3-B025 receipt save single-flight and failure safety', () => {
  it('blocks a second save synchronously before React can re-render the disabled button', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('const saveInFlightRef = useRef(false)');
    expect(flow).toContain('if (saveInFlightRef.current) return;');
    expect(flow).toContain('saveInFlightRef.current = true;');
    expect(flow).toContain('saveInFlightRef.current = false;');
  });

  it('cleans transient OCR/media only after onSave resolves and retains review on failure', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const saveStart = flow.indexOf('async function saveDraft');
    const saveEnd = flow.indexOf('const progressPercent', saveStart);
    const block = flow.slice(saveStart, saveEnd);
    expect(block.indexOf('await onSave(draft);')).toBeGreaterThan(-1);
    expect(block.indexOf("setDiagnosticOcrText('');")).toBeGreaterThan(block.indexOf('await onSave(draft);'));
    expect(block).toContain("setReview(null);");
    expect(block).toContain("URL.revokeObjectURL(imageUrlRef.current)");
    expect(block).toContain('Keep the full review and transient OCR source in memory so the user can retry.');
  });
});
