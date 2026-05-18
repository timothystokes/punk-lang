import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings } from '../../src/v2/builtins.js';
import { formatValue } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src, e = env()) => formatValue(val(src, e));

// Make a temp directory that's cleaned up after each test.
function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'punk-import-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Run a Punk program with the working directory set to `dir` (so `./X` relative
// imports resolve there). Restore cwd afterward.
function runIn(dir, src) {
  const orig = process.cwd();
  process.chdir(dir);
  try { return val(src); } finally { process.chdir(orig); }
}

test('import! loads a punk file from a relative path', () => {
  withTmpDir((dir) => {
    fs.writeFileSync(path.join(dir, 'mymod.punk'),
      '{ greet:(name:_){Hello name?} answer:42 }');
    const r = runIn(dir, 'm:import!./mymod m.answer?');
    assert.equal(r.value, 42);
  });
});

test('imported function is callable through namespace path', () => {
  withTmpDir((dir) => {
    fs.writeFileSync(path.join(dir, 'mathy.punk'),
      '{ double:(n:_){*!{n? 2}} }');
    const r = runIn(dir, 'm:import!./mathy m.double!5');
    assert.equal(r.value, 10);
  });
});

test('module cache returns the same value on repeat imports', () => {
  withTmpDir((dir) => {
    fs.writeFileSync(path.join(dir, 'once.punk'), '{ n:1 }');
    const orig = process.cwd();
    process.chdir(dir);
    try {
      // First import, then mutate the file, then re-import — cache should
      // serve the original value both times.
      const e = env();
      const a = val('import!./once', e);
      fs.writeFileSync(path.join(dir, 'once.punk'), '{ n:999 }');
      const b = val('import!./once', e);
      assert.strictEqual(a, b);
      const r = val('a:import!./once a.n?', e);
      assert.equal(r.value, 1);
    } finally { process.chdir(orig); }
  });
});

test("module's private names do not leak to the importer", () => {
  withTmpDir((dir) => {
    fs.writeFileSync(path.join(dir, 'priv.punk'),
      'hidden:42 { exposed:7 }');
    const e = env();
    runIn(dir, 'm:import!./priv');
    // The top-level program returns its last value, so the file's "module
    // template" is just the trailing { exposed:7 }. `hidden` is not in the
    // caller's env.
    assert.throws(() => val('hidden?', e), /undefined name/);
  });
});

test('relative import inside an imported module resolves to that module dir', () => {
  withTmpDir((dir) => {
    const subDir = path.join(dir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'inner.punk'), '{ pi:3.14 }');
    fs.writeFileSync(path.join(dir, 'outer.punk'),
      'i:import!./sub/inner { circle:(r:_){*!{i.pi? r? r?}} }');
    const r = runIn(dir, 'o:import!./outer o.circle!2');
    assert.equal(r.value, 12.56);
  });
});

test('import! rejects non-text arg', () => {
  assert.throws(() => val('import!42'), /argument must be text/);
});

test('import! errors on unresolvable spec', () => {
  assert.throws(() => val('import!nonsense'), /cannot resolve module/);
});

test('import! errors on missing file', () => {
  assert.throws(() => val('import!./does-not-exist'), /cannot read/);
});

// Third-party package resolution (pkg.mod -> node_modules/<pkg>/lib/<mod>.punk).
test('import! resolves a third-party package via node_modules', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'punk-pkgimport-'));
  try {
    const pkgDir = path.join(dir, 'node_modules', 'mypkg');
    fs.mkdirSync(path.join(pkgDir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'mypkg', version: '0.0.0' }));
    fs.writeFileSync(path.join(pkgDir, 'lib', 'tools.punk'),
      '{ answer:42 }');
    const r = runIn(dir, 'm:import!mypkg.tools. m.answer?');
    assert.equal(r.value, 42);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
