import type { ReceiptOcrSourceType, ReceiptSourceQuality } from './receipt-ocr.types';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function analyzeReceiptSourceQuality(
  sourceType: ReceiptOcrSourceType,
  width: number,
  height: number,
): ReceiptSourceQuality {
  if (sourceType === 'pdf') return { level: 'high', score: 100, warnings: [] };

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { level: 'very-low', score: 0, warnings: ['Nie udało się wiarygodnie ocenić rozdzielczości źródła.'] };
  }

  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const pixels = width * height;
  const aspect = longEdge / Math.max(1, shortEdge);

  let score = 100;
  if (shortEdge < 220) score -= 70;
  else if (shortEdge < 320) score -= 52;
  else if (shortEdge < 480) score -= 32;
  else if (shortEdge < 700) score -= 15;

  if (pixels < 250_000) score -= 20;
  else if (pixels < 500_000) score -= 10;

  if (aspect > 8) score -= 10;
  else if (aspect > 5) score -= 5;

  score = clamp(score);
  const level: ReceiptSourceQuality['level'] = score >= 80 ? 'high' : score >= 60 ? 'medium' : score >= 35 ? 'low' : 'very-low';
  const warnings: string[] = [];
  if (level === 'very-low') warnings.push('Zdjęcie ma zbyt mało szczegółów do pewnego odczytu cen. Jeśli możesz, wybierz oryginalne zdjęcie lub PDF.');
  else if (level === 'low') warnings.push('Zdjęcie ma ograniczoną rozdzielczość. Sprawdź dokładnie rozpoznane ceny i nazwy.');

  return { level, score, warnings };
}
