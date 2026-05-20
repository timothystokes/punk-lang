// Templates — structured, unstructured, nesting, whitespace rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---------- Structured Templates ----------

test('an empty structured template is a valid value', () => {
  assert.equal(punk('{}'), '{}');
});

test('a single-item structured template prints as-is', () => {
  assert.equal(punk('{42}'),    '{42}');
  assert.equal(punk('{Sydney}'),'{Sydney}');
  assert.equal(punk('{"hi"}'),  '{"hi"}');
});

test('multiple items inside a structured template are space-separated', () => {
  assert.equal(punk('{1 2 3}'),       '{1 2 3}');
  assert.equal(punk('{a b c}'),       '{a b c}');
  assert.equal(punk('{1 a "x" {b}}'), '{1 a "x" {b}}');
});

test('any amount of whitespace between items collapses to one space on print', () => {
  assert.equal(punk('{1   2     3}'),     '{1 2 3}');
  assert.equal(punk('{\n1\n2\n3\n}'),     '{1 2 3}');
  assert.equal(punk('{  1\t2 \n 3  }'),   '{1 2 3}');
});

test('whitespace immediately inside the braces is just separator', () => {
  assert.equal(punk('{ 1 2 3 }'), '{1 2 3}');
});

// ---------- Unstructured Templates ----------

test('an empty unstructured template is a valid value', () => {
  assert.equal(punk('""'), '""');
});

test('an unstructured template preserves its characters verbatim', () => {
  assert.equal(punk('"Hello world"'),     '"Hello world"');
  assert.equal(punk('"a   b   c"'),       '"a   b   c"');
  assert.equal(punk('"line1\nline2"'),    '"line1\nline2"');
});

test('a structured template inside an unstructured template is a placeholder shape', () => {
  // Without `!`, the placeholder is not evaluated and prints as-is.
  assert.equal(punk('"Hello {name?}"'), '"Hello {name?}"');
});

// ---------- Nested Templates ----------

test('structured templates can contain other structured templates', () => {
  assert.equal(punk('{{1 2} {3 4}}'), '{{1 2} {3 4}}');
});

test('structured templates can contain unstructured templates', () => {
  assert.equal(punk('{"a" "b" "c"}'), '{"a" "b" "c"}');
});

test('unstructured templates can contain structured templates as placeholders', () => {
  assert.equal(punk('"date: {11}-{March}-{1984}"'),
                    '"date: {11}-{March}-{1984}"');
});

test('deeply nested structured templates round-trip', () => {
  assert.equal(punk('{{{a}}}'), '{{{a}}}');
});

// ---------- Mixed items inside structures ----------

test('a structured template can mix bare words, numbers, named things and templates', () => {
  assert.equal(punk('{Tim 42 colour:blue {1 2}}'),
                    '{Tim 42 colour:blue {1 2}}');
});

// ---------- Sad paths ----------

test('unclosed structured template is a syntax error', () => {
  punkThrows('{1 2 3');
});

test('unclosed unstructured template is a syntax error', () => {
  punkThrows('"Hello world');
});

test('mismatched closing brace is a syntax error', () => {
  punkThrows('1 2 3}');
});

test('a stray closing quote is a syntax error', () => {
  punkThrows('Hello world"');
});
