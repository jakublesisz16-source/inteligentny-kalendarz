import { describe, expect, it } from 'vitest';
import { analyzeReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-source-quality';

describe('1.1.0-dev.3 DEV3-B020 source quality gate', () => {
  it('keeps PDF source quality high independently of OCR raster scaling', () => {
    expect(analyzeReceiptSourceQuality('pdf', 200, 500)).toEqual({ level: 'high', score: 100, warnings: [] });
  });

  it('marks an extremely narrow 190 x 920 photo as very-low quality', () => {
    const quality = analyzeReceiptSourceQuality('photo', 190, 920);
    expect(quality.level).toBe('very-low');
    expect(quality.score).toBeLessThan(35);
    expect(quality.warnings.join(' ')).toMatch(/oryginalne zdjęcie|PDF/iu);
  });

  it('does not punish a normal phone photo as low-resolution source', () => {
    const quality = analyzeReceiptSourceQuality('photo', 1080, 5312);
    expect(['high', 'medium']).toContain(quality.level);
  });

  it('is deterministic', () => {
    expect(analyzeReceiptSourceQuality('photo', 689, 919)).toEqual(analyzeReceiptSourceQuality('photo', 689, 919));
  });
});
