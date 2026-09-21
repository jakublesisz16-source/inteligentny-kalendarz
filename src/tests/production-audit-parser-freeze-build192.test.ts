import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const REVIEWED_PARSER_HASH = 'ee12277995df1ef21c458b7b24bbbc0b9bac62ed00439a558b0bbdf325f1e4ba';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function canonicalHash(text: string): string {
  return createHash('sha256').update(Buffer.from(text.replace(/\r\n?/g, '\n'), 'utf8')).digest('hex');
}

describe('Build192 production audit parser freeze synchronization', () => {
  it('keeps production audit pinned to the reviewed parser source', () => {
    const parser = source('../shopping/receipt-ocr/receipt-parser.ts');
    const audit = source('../../scripts/production-audit.mjs');
    expect(canonicalHash(parser)).toBe(REVIEWED_PARSER_HASH);
    expect(audit).toContain(`const expectedParserHash = '${REVIEWED_PARSER_HASH}'`);
  });

  it('normalizes line endings before production parser hashing', () => {
    const audit = source('../../scripts/production-audit.mjs');
    expect(audit).toContain("readFileSync(parserPath, 'utf8').replace(/\\r\\n?/g, '\\n')");
    expect(audit).toContain("createHash('sha256').update(Buffer.from(parserSource, 'utf8')).digest('hex')");
  });
});
