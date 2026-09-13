import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

function fail(message) {
  console.error(`LOCAL_RELEASE_FAIL: ${message}`);
  process.exit(1);
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    fail(`${command} ${args.join(' ')} failed${detail ? `\n${detail}` : ''}`);
  }
  return (result.stdout ?? '').trim();
}

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail(`${label} failed`);
}

if (!existsSync(resolve(root, '.git'))) fail('run this command inside the Git repository root');

const branch = capture('git', ['branch', '--show-current']);
if (branch !== 'main') fail(`current branch is "${branch || '(detached)'}"; switch to main before release`);

const statusBefore = capture('git', ['status', '--porcelain', '--untracked-files=normal']);
if (statusBefore) {
  console.error(statusBefore);
  fail('working tree is not clean. Commit or discard changes in GitHub Desktop first');
}

run('RELEASE PREFLIGHT', 'npm', ['run', 'release:preflight']);
run('PUBLIC REPOSITORY SAFETY', 'npm', ['run', 'security:public']);
run('TYPECHECK + PUBLIC TESTS + PRODUCTION BUILD', 'npm', ['run', 'check:public']);

const statusAfter = capture('git', ['status', '--porcelain', '--untracked-files=normal']);
if (statusAfter) {
  console.error(statusAfter);
  fail('checks changed tracked files. Review them before pushing');
}

console.log('\nLOCAL_RELEASE_OK');
console.log('Możesz kliknąć "Push origin" w GitHub Desktop.');
console.log('Po pushu GitHub Actions wykona końcową kontrolę i audit zależności.');
