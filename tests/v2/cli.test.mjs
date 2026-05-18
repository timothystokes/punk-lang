// CLI / REPL smoke tests.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, '..', '..', 'src', 'v2', 'cli.js');

function runCli(args, stdin = '') {
  const r = spawnSync('node', [CLI, ...args], {
    input: stdin, encoding: 'utf8',
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function withTmpFile(content, fn) {
  const p = path.join(os.tmpdir(), `punk-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.punk`);
  fs.writeFileSync(p, content);
  try { return fn(p); } finally { try { fs.unlinkSync(p); } catch {} }
}

test('CLI runs a file and prints final value', () => {
  withTmpFile('+!{1 2 3}\n', (file) => {
    const { stdout, status } = runCli([file]);
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '6');
  });
});

test('CLI runs a test file: passes silently when asserts pass', () => {
  withTmpFile('assert!{3 +!{1 2}}\nassert!{6 +!{1 2 3}}\n', (file) => {
    const { stdout, stderr, status } = runCli([file]);
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '');
    assert.equal(stderr.trim(), '');
  });
});

test('CLI runs a test file: exits non-zero when an assert fails', () => {
  withTmpFile('assert!{99 +!{1 2}}\n', (file) => {
    const { stderr, status } = runCli([file]);
    assert.notEqual(status, 0);
    assert.match(stderr, /expected 99, got 3/);
  });
});

test('CLI prints via log!', () => {
  withTmpFile('log!hello\n', (file) => {
    const { stdout, status } = runCli([file]);
    assert.equal(status, 0);
    assert.match(stdout, /^hello$/m);
  });
});

test('REPL keeps state across inputs', () => {
  const { stdout, status } = runCli([], 'x:42\nlog!x?\n');
  assert.equal(status, 0);
  assert.match(stdout, /\b42\b/);
});
