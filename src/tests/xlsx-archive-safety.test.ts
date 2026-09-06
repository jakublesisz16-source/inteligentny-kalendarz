import { describe, expect, it } from 'vitest';
import {
  MAX_XLSX_COMPRESSION_RATIO,
  MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES,
  validateXlsxArchiveSafety,
} from '../imports/xlsx/xlsx-archive-safety';

interface EntrySpec {
  name: string;
  compressed: number;
  uncompressed: number;
}

function u16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function u32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value, true); }

function archive(entries: EntrySpec[]): File {
  const encoder = new TextEncoder();
  const centralParts: Uint8Array[] = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const bytes = new Uint8Array(46 + name.length);
    const view = new DataView(bytes.buffer);
    u32(view, 0, 0x02014b50);
    u16(view, 4, 20);
    u16(view, 6, 20);
    u16(view, 8, 0);
    u16(view, 10, 8);
    u32(view, 20, entry.compressed);
    u32(view, 24, entry.uncompressed);
    u16(view, 28, name.length);
    bytes.set(name, 46);
    centralParts.push(bytes);
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const central = new Uint8Array(centralSize);
  let cursor = 0;
  for (const part of centralParts) { central.set(part, cursor); cursor += part.length; }

  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  u32(view, 0, 0x06054b50);
  u16(view, 8, entries.length);
  u16(view, 10, entries.length);
  u32(view, 12, central.length);
  u32(view, 16, 0);

  return new File([central, eocd], 'plan.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const required: EntrySpec[] = [
  { name: '[Content_Types].xml', compressed: 100, uncompressed: 500 },
  { name: '_rels/.rels', compressed: 80, uncompressed: 250 },
  { name: 'xl/workbook.xml', compressed: 120, uncompressed: 600 },
];

describe('XLSX archive safety preflight', () => {
  it('accepts a small structurally valid XLSX ZIP directory', async () => {
    const summary = await validateXlsxArchiveSafety(archive(required));
    expect(summary.entryCount).toBe(3);
    expect(summary.totalUncompressedBytes).toBe(1350);
  });

  it('rejects a compression-bomb-like entry before ExcelJS load', async () => {
    const dangerous = [...required, {
      name: 'xl/worksheets/sheet1.xml',
      compressed: 1024,
      uncompressed: 1024 * (MAX_XLSX_COMPRESSION_RATIO + 1),
    }];
    await expect(validateXlsxArchiveSafety(archive(dangerous))).rejects.toThrow(/współczynnik kompresji/i);
  });

  it('rejects an oversized uncompressed ZIP entry', async () => {
    const dangerous = [...required, {
      name: 'xl/sharedStrings.xml',
      compressed: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES / 2,
      uncompressed: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1,
    }];
    await expect(validateXlsxArchiveSafety(archive(dangerous))).rejects.toThrow(/pojedynczy wpis/i);
  });

  it('rejects a generic ZIP renamed to .xlsx', async () => {
    await expect(validateXlsxArchiveSafety(archive([{ name: 'hello.txt', compressed: 10, uncompressed: 10 }])))
      .rejects.toThrow(/brakuje wymaganego wpisu/i);
  });
});
