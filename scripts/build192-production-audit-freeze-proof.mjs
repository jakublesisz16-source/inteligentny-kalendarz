import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const canonical = (text) => text.replace(/\r\n?/g, '\n');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

const parser = canonical(read('src/shopping/receipt-ocr/receipt-parser.ts'));
const parserHash = createHash('sha256').update(Buffer.from(parser, 'utf8')).digest('hex');
const audit = read('scripts/production-audit.mjs');
const freeze = read('src/tests/receipt-final-parser-freeze.test.ts');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');

check('receipt parser remains on reviewed Build191 checkpoint', parserHash === 'ee12277995df1ef21c458b7b24bbbc0b9bac62ed00439a558b0bbdf325f1e4ba');
check('production audit expects current reviewed parser hash', audit.includes(`const expectedParserHash = '${parserHash}'`));
check('production audit canonicalizes CRLF/LF before hashing', audit.includes("readFileSync(parserPath, 'utf8').replace(/\\r\\n?/g, '\\n')"));
check('production audit hashes canonical UTF-8 parser bytes', audit.includes("createHash('sha256').update(Buffer.from(parserSource, 'utf8')).digest('hex')"));
check('parser freeze records same reviewed hash', freeze.includes(`BUILD191_PARSER_EXPECTED = '${parserHash}'`));
check('app metadata remains synchronized on a four-part version', /APP_VERSION = '\d+\.\d+\.\d+\.\d+'/.test(version) && /APP_BUILD = '\d+'/.test(build));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build192 production-audit freeze proof PASS ${checks.length}/${checks.length}`);
