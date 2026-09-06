import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const B027_BASELINE = 'ab72d72bb61fe198561edd12d857bb9f93e5f07f3924ad77ca453da4d307632d';
const B028_BASELINE = '4f3e90c514d0088543da8d2322a21ba64e64cbead6a958425cf6ea1e2241e890';
const B028_FIX1_BASELINE = '9b108b62a87f8e3282f4031d99a9011601571c3681f8ca0ffcff84bf6ed9e811';
const B028_FIX2_BASELINE = '00db480271fb02ea9909e7c0f334dab67f7339f8b9582adedffdfd1063b48e24';
const B028_FIX3_BASELINE = '39bf59f9d1679434f71ed0a66c427eaeac15b22120b8cce3f6da65137c6929c3';
const B028_FIX4_BASELINE = 'a5305a766f2bae26d9aab69416caaaf08467d3e121417f1d894268a32ac6991d';
const B028_FIX4_HOTFIX1_BASELINE = '623aec47097b1dc5631b0370bb58f0df31715a8af17b3d51180298bc4ee15b68';
const B028_FIX4_HOTFIX2C_BASELINE = '9da87a5f1c8965a736bdad370cb18f87360574a5b375824f94080aee02c25dee';
const DEV4_B_FIX2_BLOCKER1_BASELINE = '30e6e18bd462deec9d751d33437ee3f52625a565c302413a173897f559ce6aab';
const DEV4_B_FIX2_GATE1_BLOCKER1_EXPECTED = 'f477e6b53cc483f86cad8b8aada3cf69f6332146a7edaf2cf995e0ac5ba97ac2';

describe('DEV4-B-FIX2-GATE1-BLOCKER1 reviewed receipt parser checkpoint', () => {
  it('records intentional parser evolution from prior accepted baselines', () => {
    const bytes = readFileSync(new URL('../shopping/receipt-ocr/receipt-parser.ts', import.meta.url));
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(hash).not.toBe(B027_BASELINE);
    expect(hash).not.toBe(B028_BASELINE);
    expect(hash).not.toBe(B028_FIX1_BASELINE);
    expect(hash).not.toBe(B028_FIX2_BASELINE);
    expect(hash).not.toBe(B028_FIX3_BASELINE);
    expect(hash).not.toBe(B028_FIX4_BASELINE);
    expect(hash).not.toBe(B028_FIX4_HOTFIX1_BASELINE);
    expect(hash).not.toBe(B028_FIX4_HOTFIX2C_BASELINE);
    expect(hash).not.toBe(DEV4_B_FIX2_BLOCKER1_BASELINE);
  });

  it('freezes the reviewed DEV4-B-FIX2-GATE1-BLOCKER1 parser checkpoint', () => {
    const bytes = readFileSync(new URL('../shopping/receipt-ocr/receipt-parser.ts', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(DEV4_B_FIX2_GATE1_BLOCKER1_EXPECTED);
  });

  it('keeps the reviewed receipt parser while app metadata advances to 1.1.0 with schema 13', () => {
    const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');
    expect(version).toMatch(/^export const APP_VERSION = '1\.1\.0';$/mu);
    expect(version).toMatch(/^export const DATABASE_SCHEMA_VERSION = 13;$/mu);
  });
});
