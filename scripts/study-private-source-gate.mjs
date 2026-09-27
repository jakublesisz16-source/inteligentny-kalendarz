import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const root = process.cwd();
const unix = (value) => value.split(sep).join('/');
const statePath = join(root, 'CURRENT_STATE.json');
const failures = [];
const fail = (message) => failures.push(message);

if (!existsSync(statePath)) {
  console.log('STUDY_PRIVATE_SOURCE_GATE_SKIPPED_PUBLIC');
  process.exit(0);
}

const state = JSON.parse(readFileSync(statePath, 'utf8'));
const expected = state.activeStudySourceFingerprint;
const sourceName = state.activeStudySource;
const fixtureRel = `private-fixtures/study/${sourceName}`;
const fixturePath = join(root, fixtureRel);
const auditRel = 'private-fixtures/study/active-profile-audit.json';
const auditPath = join(root, auditRel);

if (!sourceName || !expected?.sha256 || !Number.isFinite(Number(expected?.sizeBytes))) {
  fail('CURRENT_STATE active Study source fingerprint is incomplete');
} else if (!existsSync(fixturePath)) {
  fail(`missing exact active Study source fixture: ${fixtureRel}`);
} else {
  const bytes = readFileSync(fixturePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== Number(expected.sizeBytes)) fail(`active Study source size mismatch: ${bytes.byteLength} != ${expected.sizeBytes}`);
  if (sha256 !== String(expected.sha256).toLowerCase()) fail(`active Study source SHA-256 mismatch: ${sha256}`);
  if (basename(fixturePath) !== sourceName) fail(`active Study source filename mismatch: ${basename(fixturePath)} != ${sourceName}`);
}

if (!existsSync(auditPath)) {
  fail(`missing exact-source audit snapshot: ${auditRel}`);
} else {
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (audit?.source?.fileName !== sourceName) fail('active-profile audit source filename differs from CURRENT_STATE');
  if (audit?.source?.sha256 !== String(expected?.sha256 ?? '').toLowerCase()) fail('active-profile audit source SHA-256 differs from CURRENT_STATE');
  if (Number(audit?.source?.sizeBytes) !== Number(expected?.sizeBytes)) fail('active-profile audit source size differs from CURRENT_STATE');
  const raw = state.activeStudyQaProfile;
  const operational = state.activeStudyOperationalProfile;
  if (raw && JSON.stringify(audit?.currentProfile?.raw?.audit) !== JSON.stringify({
    selectedGroups: raw.selectedGroups,
    valid: true,
    validationErrors: [],
    candidateCount: raw.candidateCount,
    importableCount: raw.importableCount,
    readyCount: raw.readyCount,
    warningCount: raw.warningCount,
    incompleteCount: raw.incompleteCount,
    blockingCount: raw.blockingCount,
    conflictCount: raw.conflictCount,
    importableMonthCounts: raw.importableMonthCounts,
  })) fail('active-profile raw audit snapshot differs from CURRENT_STATE');
  if (operational && JSON.stringify(audit?.currentProfile?.operationalAfterRecurringPatternAssumptions?.audit) !== JSON.stringify({
    selectedGroups: operational.selectedGroups,
    valid: true,
    validationErrors: [],
    candidateCount: operational.candidateCount,
    importableCount: operational.importableCount,
    readyCount: operational.readyCount,
    warningCount: operational.warningCount,
    incompleteCount: operational.incompleteCount,
    blockingCount: operational.blockingCount,
    conflictCount: operational.conflictCount,
    importableMonthCounts: operational.importableMonthCounts,
  })) fail('active-profile operational audit snapshot differs from CURRENT_STATE');
}

const fixtureRoot = join(root, 'private-fixtures');
if (existsSync(fixtureRoot)) {
  const spreadsheetFiles = [];
  const scan = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) scan(full);
      else if (/\.(?:xls|xlsx)$/iu.test(name)) spreadsheetFiles.push(unix(relative(root, full)));
    }
  };
  scan(fixtureRoot);
  const unexpected = spreadsheetFiles.filter((rel) => rel !== fixtureRel);
  for (const rel of unexpected) fail(`unexpected retained spreadsheet fixture: ${rel}`);
}

if (failures.length) {
  for (const message of [...new Set(failures)]) console.error(`STUDY_PRIVATE_SOURCE_GATE_FAIL: ${message}`);
  process.exit(1);
}
console.log(`STUDY_PRIVATE_SOURCE_GATE_OK source=${fixtureRel} audit=${auditRel}`);
