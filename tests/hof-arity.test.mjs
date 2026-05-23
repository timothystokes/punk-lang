// HOF callback arity — new uniform model.
//
// From the data-processing redesign:
//
//   map:(fn:_ items:_)
//
// where `fn` is either:
//   (item:_)            — receives the item only
//   (item:_ index:_)    — receives item + 1-based index
//
// The historical "name" slot is REMOVED. To get the name in the
// callback, write `item.:?` (works because path-`.:?` returns the name
// of the slot). The item arg is the ORIGINAL slot — Named-ness is
// preserved — so `item.tokens?` works on `Jan:{tokens:850 pizzas:6}`.
//
// each/filter/find/count follow the same pattern.
// sort still gets a 2-arg comparator `(a:_ b:_)` — unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---------- map! ----------

test('map! — single-arg `(item:_)` callback', () => {
  assert.equal(
    punk('map!{(n:_){X!{n? 10}}~ {1 2 3}}'),
    '{10 20 30}'
  );
});

test('map! — two-arg `(item:_ index:_)` callback uses index', () => {
  assert.equal(
    punk('map!{(v:_ i:_){{i? v?}}~ {a b c}}'),
    '{{1 a} {2 b} {3 c}}'
  );
});

test('map! — item arg preserves Named, so item.:? gets the name', () => {
  assert.equal(
    punk('map!{(item:_){item.:?}~ {x:1 y:2 z:3}}'),
    '{x y z}'
  );
});

test('map! — item arg preserves Named, so item.field? works', () => {
  assert.equal(
    punk(`
      ms:{Jan:{tokens:850} Feb:{tokens:870} Mar:{tokens:830}}
      map!{(m:_){m.tokens?}~ ms?}
    `),
    '{850 870 830}'
  );
});

test('map! — 3-slot callback is an arity error', () => {
  punkThrows('map!{(v:_ i:_ k:_){v?} {1 2 3}}');
});

test('map! — 0-slot callback is an arity error', () => {
  punkThrows('map!{(){42} {1 2 3}}');
});

// ---------- filter! ----------

test('filter! — single-arg predicate', () => {
  assert.equal(
    punk('filter!{(n:_){>!{n? 2}}~ {1 2 3 4 5}}'),
    '{3 4 5}'
  );
});

test('filter! — two-arg predicate with index', () => {
  // keep odd-indexed (1, 3, 5)
  assert.equal(
    punk(`
      odd:(n:_){=!{%!{n? 2} 1}}~
      filter!{(v:_ i:_){odd!i?}~ {a b c d e}}
    `),
    '{a c e}'
  );
});

test('filter! — 3-slot predicate is an arity error', () => {
  punkThrows('filter!{(v:_ i:_ k:_){TRUE} {1 2 3}}');
});

// ---------- each! ----------

test('each! — single-arg callback runs for side effects, returns NULL', () => {
  assert.equal(
    punk('each!{(v:_){v?} {1 2 3}}'),
    'NULL'
  );
});

test('each! — 3-slot callback is an arity error', () => {
  punkThrows('each!{(v:_ i:_ k:_){v?} {1 2 3}}');
});

// ---------- partial form `map'fn` ----------

test("partial — `map'(item:_){...}` is a unary list transformer", () => {
  const src = `double:map'(n:_){X!{n? 2}}~
double!{1 2 3}`;
  assert.equal(punk(src), '{2 4 6}');
});

test("partial — `map'(item:_ index:_){...}` works with index", () => {
  const src = `tag:map'(v:_ i:_){{i? v?}}~
tag!{a b c}`;
  assert.equal(punk(src), '{{1 a} {2 b} {3 c}}');
});
