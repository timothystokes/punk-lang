// Query terminators — the new uniform model.
//
// Two terminators, applied uniformly to whatever expression they follow:
//
//   X?   → returns THE VALUE at X, as ONE item in the parent context.
//          - Strips the outer name if X is a Named.
//          - A Tmpl value lands NESTED (the `{}` is kept around it).
//          - No spreading EVER happens with `?`.
//
//   X.?  → returns THE FULL THING at X, placed into the parent context
//          as-is, WITHOUT adding a `{}` wrapper around it. Mechanically:
//          - A Named (e.g. `birthday:{...}`) lands as that Named item
//            in the parent (name preserved).
//          - An unwrapped Tmpl (e.g. `{a b c}`) has its `{}` boundary
//            dropped and its items land inline.
//          - A bare Word / Number / Text lands as that one item.
//
// Both terminators work on ANY expression, not just bound names:
// indexed paths, call results, and literals all chain. Path-on-call
// precedence: `f!arg.x?` ≡ `(f!arg).x?`.
//
// Slot shorthand still applies: `name:value` is shorthand for
// `name:{value}`. This combines with `.?` naturally — landing a Named
// on the rhs of `name:` produces a double-name shorthand:
//   `outer:Inner:val.?` is shorthand for `outer:{Inner:val}`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---------- `?` returns the value as ONE item (no spread) ----------

test('`?` on a name bound to a Tmpl lands NESTED (no spread)', () => {
  // xs?'s value is `{1 2 3}`. Inside the outer `{a xs?}!`, it lands as
  // ONE item — a Tmpl — kept nested. No spread.
  assert.equal(
    punk('xs:{1 2 3}  {a xs?}!'),
    '{a {1 2 3}}'
  );
});

test('`?` on a Named slot returns the value side as one item', () => {
  // `r.b?` → value 2 (a Number); lands as one item.
  assert.equal(
    punk('r:{a:1 b:2 c:3}  {got r.b?}!'),
    '{got 2}'
  );
});

test('`?` on a Named whose value is a Tmpl lands nested', () => {
  assert.equal(
    punk('p:{birthday:{day:12 month:June year:1997}}  {Birthday p.birthday?}!'),
    '{Birthday {day:12 month:June year:1997}}'
  );
});

test('`?` never spreads even when surrounded by other items', () => {
  assert.equal(
    punk('xs:{1 2 3}  {a xs? b}!'),
    '{a {1 2 3} b}'
  );
});

// ---------- `.?` inlines the FULL thing (no `{}` wrapper) ----------

test('`.?` on a Named keeps the inner name', () => {
  // person.birthday is `birthday:{...}` (a Named). `.?` inlines it
  // into the parent retaining its name.
  assert.equal(
    punk('p:{birthday:{day:12 month:June year:1997}}  {All date elements p.birthday.?}!'),
    '{All date elements birthday:{day:12 month:June year:1997}}'
  );
});

test('`.?` on an unwrapped Tmpl spreads its items inline', () => {
  // p.birthday? returns the value (an unwrapped Tmpl); `.?` on that
  // drops the `{}` and inlines.
  assert.equal(
    punk('p:{birthday:{day:12 month:June year:1997}}  {All date elements p.birthday?.?}!'),
    '{All date elements day:12 month:June year:1997}'
  );
});

test('`.?` on a literal Tmpl spreads inline', () => {
  assert.equal(
    punk('{a {b c d}.?}!'),
    '{a b c d}'
  );
});

test('`.?` on a bare Word is identity (one item)', () => {
  // r.a's full thing is the Named `a:1`. `.?` keeps the name.
  assert.equal(
    punk('r:{a:1 b:2}  {got r.a.?}!'),
    '{got a:1}'
  );
});

// ---------- Path terminators on arbitrary expressions ----------

test('path step on a call result — `(f!arg).x?` precedence', () => {
  // id returns its single arg unchanged. `.1?` on its result should
  // yield the first item of the returned tmpl. The call must bind
  // tighter than `.1?` (post-Exec query attaches to call RESULT).
  assert.equal(
    punk(`
      id:(x:_){x?}
      id!{{a b c}}.1?
    `),
    '{a}',
  );
});

test('path step on a call result without parens — call binds tighter', () => {
  // `id!{{a:1 b:2 c:3}}.b?` ≡ `(id!{...}).b?`
  assert.equal(
    punk(`
      id:(x:_){x?}
      id!{{a:1 b:2 c:3}}.b?
    `),
    '{2}',
  );
});

test('path terminator on a literal Tmpl head', () => {
  // Already in querying.test.mjs as a parse case; here we check `.?`.
  assert.equal(
    punk('{{a:1 b:2}}.1.b?'),
    '{2}',
  );
});

test('`.?` spread on a call result expands the value inline', () => {
  // `f!{...}.?` ≡ `(f!{...}).?` — the post-Exec query rule routes
  // the leading-dot path to the call RESULT, not into the args.
  assert.equal(
    punk(`
      pair:(x:_ y:_){{a:x? b:y?}}
      {got pair!{1 2}.?}!
    `),
    '{got a:{1} b:{2}}',
  );
});

test('pipeline result accepts a `.path?` query via `!.path?`', () => {
  // Stage chain `xs?->...!` triggers execute; `.?` glued after the
  // trigger `!` becomes a wrapping Query on the pipeline result.
  assert.equal(
    punk(`
      add:(a:_ b:_){+!{a? b?}}
      +!{ {1 2 3}->map'(x:_){add!{x? 10}}!.? }
    `),
    '{36}',
  );
});

// ---------- Double-name shorthand from `.?` into a name slot ----------

test('`.?` of a Named into a name slot creates a double-name shorthand', () => {
  // Landing `Sep:{...}` on the rhs of `peak:` gives `peak:Sep:{...}`
  // which is shorthand for `peak:{Sep:{...}}` (a Named whose value is
  // a singleton Tmpl containing the inner Named). No magic.
  assert.equal(
    punk(`
      months:{Jan:{n:1} Sep:{n:9}}
      {peak:months.2.?}!
    `),
    '{peak:Sep:{n:9}}'
  );
});

// ---------- `?` does NOT cascade-spread inside `!` execution ----------

test('value queried inside `!`-cascade lands nested, not spread', () => {
  // Regression-style: even when the surrounding tmpl is executed with
  // `!`, the `?`-substituted value stays as one item.
  // `nums.1?` is the bare Number `1`; `nums?` is the Tmpl `{1 2 3}`
  // which lands nested.
  assert.equal(
    punk('nums:{1 2 3}  {first nums.1? all nums?}!'),
    '{first 1 all {1 2 3}}'
  );
});
