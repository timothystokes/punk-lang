// importJS! / JS-interop tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { tokenize } from '../src/tokenize.js';
import { parse } from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { defaultBindings } from '../src/builtins.js';
import { formatValue } from '../src/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src) => formatValue(val(src));

test('importJS! loads a node builtin and returns a jsobj', () => {
  // path.sep is a string; reaching it via path query should yield text.
  assert.equal(fmt('p:importJS!path p.sep?'), path.sep);
});

test('importJS! function call: path.join!{a b}', () => {
  assert.equal(fmt("p:importJS!path p.join!{a b c}"), path.join('a','b','c'));
});

test('importJS! function call with single text arg', () => {
  // path.basename!"some/file.txt" — use a tmpl since regex-literal is unwieldy.
  assert.equal(fmt("p:importJS!path p.basename!a/b/file.txt"), 'file.txt');
});

test('JS array round-trips via index step', () => {
  // os.cpus() returns an array of objects; index into it.
  const src = 'os:importJS!os arr:os.cpus!{} arr.1.model?';
  const r = val(src);
  assert.equal(r.kind, 'text');
  assert.ok(r.value.length > 0);
});

test('JS object property: os.platform!{} returns the platform string', () => {
  const r = val('os:importJS!os os.platform!{}');
  assert.equal(r.kind, 'text');
  assert.equal(r.value, os.platform());
});

test('importJS! errors on unknown module', () => {
  assert.throws(() => val('importJS!definitely-not-a-real-pkg'),
    /cannot load 'definitely-not-a-real-pkg'/);
});

test('JS function called from Punk converts tmpl arg to JS array', () => {
  // Use a temp file we wrote with fs.writeFileSync then read back.
  const tmpPath = path.join(os.tmpdir(), `punk-js-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, 'hi from punk\n');
  try {
    const r = val(`fs:importJS!fs fs.readFileSync!{${tmpPath} utf8}`);
    assert.equal(r.kind, 'text');
    assert.equal(r.value, 'hi from punk\n');
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});
