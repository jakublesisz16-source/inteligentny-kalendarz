import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const finance = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const spreadsheet = readFileSync('src/imports/xlsx/spreadsheet-reader.ts', 'utf8');
const pdf = readFileSync('src/imports/pdf/pdf-reader.ts', 'utf8');
const excelExport = readFileSync('src/data-transfer/excel-export.ts', 'utf8');

function staticImportGraph(entry: string) {
  const visited = new Set<string>();
  const packages = new Set<string>();
  const stack = [resolve(entry)];
  const importPattern = /^\s*import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]\s*;?/gm;
  const sideEffectPattern = /^\s*import\s*['"]([^'"]+)['"]\s*;?/gm;

  function resolveLocal(from: string, specifier: string): string | null {
    const base = resolve(dirname(from), specifier);
    const candidates = extname(base)
      ? [base]
      : [
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.js`,
          `${base}.jsx`,
          `${base}.css`,
          join(base, 'index.ts'),
          join(base, 'index.tsx'),
        ];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  while (stack.length) {
    const file = stack.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    const specifiers = new Set<string>();
    for (const pattern of [importPattern, sideEffectPattern]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) if (match[1]) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const local = resolveLocal(file, specifier);
        if (local) stack.push(local);
      } else {
        packages.add(specifier);
      }
    }
  }

  return { visited, packages };
}

describe('Build224 measured lazy-loading boundaries', () => {
  it('code-splits non-startup heavy views from App', () => {
    expect(app).toContain("lazy(async () =>");
    expect(app).toContain("import('../finance/FinanceView')");
    expect(app).toContain("import('../study/StudyView')");
    expect(app).toContain("import('../work/WorkView')");
    expect(app).not.toContain("import { FinanceView } from '../finance/FinanceView'");
    expect(app).not.toContain("import { StudyView } from '../study/StudyView'");
    expect(app).not.toContain("import { WorkView } from '../work/WorkView'");
    expect(app).toContain('<Suspense fallback={<LazyViewFallback />}>');
  });

  it('loads the receipt scan surface only after the scanner is opened', () => {
    expect(finance).toContain("import('../shopping/receipt-ocr/ReceiptScanFlow')");
    expect(finance).not.toContain("import { ReceiptScanFlow } from '../shopping/receipt-ocr/ReceiptScanFlow'");
    expect(finance).toContain('Uruchamiam skaner...');
  });

  it('loads only the selected spreadsheet reader when a file is actually read', () => {
    expect(spreadsheet).toContain("await import('./xls-reader')");
    expect(spreadsheet).toContain("await import('./xlsx-reader')");
    expect(spreadsheet).not.toMatch(/^import .*['"]\.\/xls-reader['"]/m);
    expect(spreadsheet).not.toMatch(/^import .*['"]\.\/xlsx-reader['"]/m);
  });

  it('loads PDF.js only when a work PDF is actually parsed', () => {
    expect(pdf).toContain("import('pdfjs-dist')");
    expect(pdf).toContain("import('pdfjs-dist/build/pdf.worker.min.mjs?url')");
    expect(pdf).not.toMatch(/^import .* from ['"]pdfjs-dist['"]/m);
  });

  it('loads ExcelJS export runtime only after Excel export is requested', () => {
    expect(excelExport).toContain("import type ExcelJS from 'exceljs'");
    expect(excelExport).toContain("await import('exceljs')");
    expect(excelExport).not.toMatch(/^import ExcelJS.*from ['"]exceljs['"]/m);
  });

  it('keeps heavy vendors and heavy views out of the startup static import graph', () => {
    const graph = staticImportGraph('src/main.tsx');
    expect([...graph.packages].some((name) => name.startsWith('exceljs'))).toBe(false);
    expect([...graph.packages].some((name) => name.startsWith('pdfjs-dist'))).toBe(false);
    expect([...graph.visited].some((file) => file.endsWith('/finance/FinanceDashboardView.tsx'))).toBe(false);
    expect([...graph.visited].some((file) => file.endsWith('/study/StudyView.tsx'))).toBe(false);
    expect([...graph.visited].some((file) => file.endsWith('/work/WorkView.tsx'))).toBe(false);
    expect([...graph.visited].some((file) => file.endsWith('/shopping/receipt-ocr/ReceiptScanFlow.tsx'))).toBe(false);
  });
});
