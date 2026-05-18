import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings } from '../../src/v2/builtins.js';
import { num, text, TRUE, FALSE, NULL, formatValue } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src, e = env()) => formatValue(val(src, e));

// -- map --------------------------------------------------------------

test('map with 1-slot callback', () => {
  // doubled:{1 2 3} via (n:_){*!{n? 2}}
  assert.equal(fmt('map!{(n:_){*!{n? 2}} {1 2 3}}'), '{2 4 6}');
});

test("map with partialed builtin: map'inc?", () => {
  // Bind inner partial; deref in partial RHS uses `?`.
  assert.equal(fmt("inc:+'1 incAll:map'inc? incAll!{1 2 3}"), '{2 3 4}');
});

test('map exposes index as second slot', () => {
  // pairs items with 1-based index
  assert.equal(fmt('map!{(v:_ i:_){i?} {a b c d}}'), '{1 2 3 4}');
});

test('map exposes key for NamedThings', () => {
  assert.equal(fmt('map!{(v:_ i:_ k:_){k?} {a:1 b:2 c:3}}'), '{a b c}');
});

test('map value is unwrapped from NamedThing', () => {
  assert.equal(fmt('map!{(v:_){v?} {a:1 b:2}}'), '{1 2}');
});

// -- filter -----------------------------------------------------------

test('filter keeps matching items', () => {
  // (v:_){>!{v? 2}} : keep items where v > 2
  assert.equal(fmt('filter!{(v:_){>!{v? 2}} {1 2 3 4 5}}'), '{3 4 5}');
});

test('filter with multi-slot callback (by index)', () => {
  // keep odd-indexed items (1, 3, 5)
  assert.equal(fmt('filter!{(v:_ i:_){=!{%!{i? 2} 1}} {a b c d e}}'), '{a c e}');
});

// -- reduce -----------------------------------------------------------

test('reduce sum', () => {
  assert.equal(val('reduce!{(a:_ b:_){+!{a? b?}} 0 {1 2 3 4}}').value, 10);
});

test('reduce partial: sum:reduce\'{(a:_ b:_){+!{a? b?}} 0}', () => {
  assert.equal(val("sum:reduce'{(a:_ b:_){+!{a? b?}} 0} sum!{1 2 3 4 5}").value, 15);
});

// -- find / count / each ---------------------------------------------

test('find returns first match', () => {
  assert.equal(val("find!{(v:_){>!{v? 3}} {1 2 3 4 5}}").value, 4);
});

test('find returns NULL on no match', () => {
  assert.equal(val("find!{(v:_){>!{v? 10}} {1 2 3 4 5}}"), NULL);
});

test('count counts matches', () => {
  assert.equal(val("count!{(v:_){>!{v? 2}} {1 2 3 4 5}}").value, 3);
});

test('each returns NULL', () => {
  // We can't easily observe side effects without I/O; just confirm it returns NULL.
  assert.equal(val("each!{(v:_){v?} {1 2 3}}"), NULL);
});

// -- sort / rev / unique / contains ----------------------------------

test('sort ascending numbers', () => {
  assert.equal(fmt('sort!{3 1 4 1 5 9 2 6}'), '{1 1 2 3 4 5 6 9}');
});

test('sort ascending text', () => {
  assert.equal(fmt('sort!{banana apple cherry}'), '{apple banana cherry}');
});

test('sort with comparator', () => {
  // descending via comparator
  assert.equal(fmt('sort!{(a:_ b:_){-!{b? a?}} {3 1 4 1 5}}'), '{5 4 3 1 1}');
});

test('rev reverses', () => {
  assert.equal(fmt('rev!{1 2 3 4}'), '{4 3 2 1}');
});

test('unique dedupes', () => {
  assert.equal(fmt('unique!{1 2 2 3 1 4 3}'), '{1 2 3 4}');
});

test('contains: hit and miss', () => {
  assert.equal(val('contains!{3 {1 2 3 4}}'), TRUE);
  assert.equal(val('contains!{7 {1 2 3 4}}'), FALSE);
});

// -- doc-style chains -------------------------------------------------

test("docs example: double:map'doubleFn?", () => {
  assert.equal(fmt("doubleFn:(n:_){*!{n? 2}} double:map'doubleFn? double!{1 2 3}"), '{2 4 6}');
});

test('pipeline through map and filter', () => {
  // Bind helpers and the source list to names; pipeline derefs via `?`.
  assert.equal(fmt("ns:{1 2 3 4 5} double:(n:_){*!{n? 10}} keep:(v:_){>!{v? 2}} ns?->filter'keep?->map'double?!"), '{30 40 50}');
});

// -- errors -----------------------------------------------------------

test('map requires a function', () => {
  assert.throws(() => val('map!{5 {1 2 3}}'), /first argument must be a function/);
});

test('filter predicate must return TRUE/FALSE', () => {
  assert.throws(() => val('filter!{(v:_){v?} {1 2 3}}'), /must return TRUE\/FALSE/);
});
