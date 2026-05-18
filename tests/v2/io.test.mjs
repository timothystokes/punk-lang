import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings, setIO, io } from '../../src/v2/builtins.js';
import { TRUE, FALSE, NULL, formatValue } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src, e = env()) => formatValue(val(src, e));

function tmpPath(name = 'punk') {
  return path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
}

// Wire up print capture / restore around each print test.
function withPrintCapture(fn) {
  const captured = [];
  const origPrint = io.print;
  setIO({ print: (line) => captured.push(line) });
  try { fn(captured); } finally { setIO({ print: origPrint }); }
}

// -- print -----------------------------------------------------------

test('print of text', () => {
  withPrintCapture((out) => {
    assert.equal(val('print!hello'), NULL);
    assert.deepEqual(out, ['hello']);
  });
});

test('print of template drops outer braces', () => {
  withPrintCapture((out) => {
    val('print!{Hello world}');
    assert.deepEqual(out, ['Hello world']);
  });
});

test('print of a number', () => {
  withPrintCapture((out) => {
    val('print!42');
    assert.deepEqual(out, ['42']);
  });
});

test('log is an alias for print', () => {
  withPrintCapture((out) => {
    val('log!{hi there}');
    assert.deepEqual(out, ['hi there']);
  });
});

test('pipeline to print', () => {
  withPrintCapture((out) => {
    val("greeting:{Hello world} greeting?->print!");
    assert.deepEqual(out, ['Hello world']);
  });
});

// -- write / read / exists / append ---------------------------------

test('write then read round-trips lines', () => {
  const p = tmpPath('rw');
  try {
    val(`write!{${p} {alpha beta gamma}}`);
    assert.equal(fmt(`read!${p}`), '{alpha beta gamma}');
  } finally { try { fs.unlinkSync(p); } catch {} }
});

test('exists returns FALSE for missing file, TRUE after write', () => {
  const p = tmpPath('ex');
  try {
    assert.equal(val(`exists!${p}`), FALSE);
    val(`write!{${p} hello}`);
    assert.equal(val(`exists!${p}`), TRUE);
  } finally { try { fs.unlinkSync(p); } catch {} }
});

test('append adds lines', () => {
  const p = tmpPath('app');
  try {
    val(`write!{${p} first}`);
    val(`append!{${p} second}`);
    val(`append!{${p} third}`);
    assert.equal(fmt(`read!${p}`), '{first second third}');
  } finally { try { fs.unlinkSync(p); } catch {} }
});

test('read of empty file is empty template', () => {
  const p = tmpPath('empty');
  try {
    fs.writeFileSync(p, '');
    assert.equal(fmt(`read!${p}`), '{}');
  } finally { try { fs.unlinkSync(p); } catch {} }
});

test('write of a single text value writes that text', () => {
  const p = tmpPath('one');
  try {
    val(`write!{${p} hello}`);
    assert.equal(fs.readFileSync(p, 'utf8'), 'hello\n');
  } finally { try { fs.unlinkSync(p); } catch {} }
});

// -- errors ----------------------------------------------------------

test('read needs text path', () => {
  assert.throws(() => val('read!42'), /path must be text/);
});

test('write needs 2 args', () => {
  assert.throws(() => val('write!hello'), /expected 2 arguments/);
});
