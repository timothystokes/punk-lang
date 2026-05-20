// Boxes — the one mutable cell in Punk.
//
// From doc § "Boxes":
//   - `[name]` IS the box; no `:` binding form.
//   - Brought into existence by writing into it: `value->[name]!`.
//   - Read: `[name]->fn!` (box on the LEFT of `->`).
//   - Write: `value->[name]!` (box on the RIGHT of `->`).
//   - Same box can appear on both sides in one chain: read, transform, write.
//   - Boxes sit outside the normal namespace.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('write then read a box', () => {
  // Write 42 into [n], then pipe it through a function that returns it.
  assert.equal(
    punk('42->[n]!  [n]->(v:_){v?}!'),
    '{42}'
  );
});

test('overwriting a box replaces its contents', () => {
  assert.equal(
    punk('1->[n]!  2->[n]!  [n]->(v:_){v?}!'),
    '{2}'
  );
});

test('read-transform-write — counter increment', () => {
  // 0 into [c], then read+1 back twice.
  const src = `0->[c]!
    [c]->+'1->[c]!
    [c]->+'1->[c]!
    [c]->(v:_){v?}!`;
  assert.equal(punk(src), '{2}');
});

test('a box can hold any value, including a template', () => {
  assert.equal(
    punk('{a b c}->[xs]!  [xs]->(v:_){v?}!'),
    '{a b c}'
  );
});

test('boxes and ordinary names do not interact', () => {
  // n as a regular name; [n] as a box. They are different things.
  assert.equal(
    punk('n:1  2->[n]!  {n? [n]->(v:_){v?}!}'),
    '{{1} {2}}'
  );
});
