// HOF callback arity — new uniform model.
//
// From the data-processing redesign:
//
//   map:([fn] [items])
//
// where `fn` is either:
//   ([item])            — receives the item only
//   ([item] [index])    — receives item + 1-based index
//
// The historical "name" slot is REMOVED. To get the name in the
// callback, write `item.:?` (works because path-`.:?` returns the name
// of the slot). The item arg is the ORIGINAL slot — Named-ness is
// preserved — so `item.tokens?` works on `Jan:{tokens:850 pizzas:6}`.
//
// each/filter/find/count follow the same pattern.
// sort still gets a 2-arg comparator `([a] [b])` — unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---------- map! ----------

test('map! — single-arg `([item])` callback', () => {
  assert.equal(
    punk('map!{([n]){X!{n? 10}}~ {1 2 3}}'),
    '{10 20 30}'
  );
});

test('map! — two-arg `([item] [index])` callback uses index', () => {
  assert.equal(
    punk('map!{([v] [i]){{i? v?}}~ {a b c}}'),
    '{{1 a} {2 b} {3 c}}'
  );
});

test('map! — item arg preserves Named, so item.:? gets the name', () => {
  assert.equal(
    punk('map!{([item]){item.:?}~ {x:1 y:2 z:3}}'),
    '{x y z}'
  );
});

test('map! — item arg preserves Named, so item.field? works', () => {
  assert.equal(
    punk(`
      ms:{Jan:{tokens:850} Feb:{tokens:870} Mar:{tokens:830}}
      map!{([m]){m.tokens?}~ ms?}
    `),
    '{850 870 830}'
  );
});

test('map! — 3-slot callback is an arity error', () => {
  punkThrows('map!{([v] [i] [k]){v?} {1 2 3}}');
});

test('map! — 0-slot callback is an arity error', () => {
  punkThrows('map!{(){42} {1 2 3}}');
});

// ---------- filter! ----------

test('filter! — single-arg predicate', () => {
  assert.equal(
    punk('filter!{([n]){>!{n? 2}}~ {1 2 3 4 5}}'),
    '{3 4 5}'
  );
});

test('filter! — two-arg predicate with index', () => {
  // keep odd-indexed (1, 3, 5)
  assert.equal(
    punk(`
      odd:([n]){=!{%!{n? 2} 1}}~
      filter!{([v] [i]){odd!i?}~ {a b c d e}}
    `),
    '{a c e}'
  );
});

test('filter! — 3-slot predicate is an arity error', () => {
  punkThrows('filter!{([v] [i] [k]){TRUE} {1 2 3}}');
});

// ---------- each! ----------

test('each! — single-arg callback runs for side effects, returns NULL', () => {
  assert.equal(
    punk('each!{([v]){v?} {1 2 3}}'),
    'NULL'
  );
});

test('each! — 3-slot callback is an arity error', () => {
  punkThrows('each!{([v] [i] [k]){v?} {1 2 3}}');
});

// ---------- partial form `map'fn` ----------

test("partial — `map'([item]){...}` is a unary list transformer", () => {
  const src = `double:map'([n]){X!{n? 2}}~
double!{1 2 3}`;
  assert.equal(punk(src), '{2 4 6}');
});

test("partial — `map'([item] [index]){...}` works with index", () => {
  const src = `tag:map'([v] [i]){{i? v?}}~
tag!{a b c}`;
  assert.equal(punk(src), '{{1 a} {2 b} {3 c}}');
});
