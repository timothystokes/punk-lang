// IO built-ins — `print!`, `read!`, `write!`, `append!`, `exists!`.
//
// From doc § "Input and Output":
//   - `print!t` writes contents of t to stdout + newline; returns NULL.
//   - `read!path` returns a template of the file's lines.
//   - `write!{path t}` overwrites the file.
//   - `append!{path t}` appends to the file.
//   - `exists!path` returns TRUE if the file exists.
//
// Test strategy (per user): only assert parser-shape and return-value
// behaviour that doesn't require a working filesystem. Full IO behaviour
// is covered when the runtime is implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- print! — return value is NULL -------------------------------------

test('print! — returns NULL (effect-only)', () => {
  // The side effect of writing to stdout is not observed; only the
  // returned value is checked.
  assert.equal(punk('print!hello'), 'NULL');
});

test('print! — accepts a structured template arg', () => {
  // Parser should accept a brace-form arg; value is still NULL.
  assert.equal(punk('print!{hello world}'), 'NULL');
});

test('print! — accepts unstructured text', () => {
  assert.equal(punk('print!"hello"'), 'NULL');
});

// ---- parser shape for read/write/append/exists ------------------------
//
// We can at least confirm these are valid call shapes — i.e. they parse
// and resolve to something — without testing the IO itself. The real
// behavioural tests live with the implementation work.

test('exists! — call shape parses', () => {
  // Whatever the boolean result is, it should be TRUE or FALSE.
  const out = punk('exists!"/nonexistent/path/that/should/not/exist"');
  assert.ok(out === 'TRUE' || out === 'FALSE', `got ${out}`);
});

test('write! — call shape rejects malformed args', () => {
  // Missing braces around two args -> shape mismatch.
  punkThrows('write!');
});

test('append! — call shape rejects malformed args', () => {
  punkThrows('append!');
});

test('read! — call shape rejects malformed args', () => {
  punkThrows('read!');
});
