// Querying — path navigation, length, index, range, name (`.:?`),
// pattern-of-function (`.()?`).
//
// Locked semantics:
//   - Path traversal always returns the VALUE side of any named thing it
//     walks through. Names exist for navigation, not as values.
//   - `.:?` is the ONLY way to retrieve a name from a path.
//   - 1-based indexing; `.n? .~? .n~? .~n? .n~m?` for index/range.
//   - `.#?` is length: items for a structured template, characters for an
//     unstructured template.
//   - Invalid paths return NULL (not an error).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

const PEOPLE = `
  people:{
    {fullname:"John Smith"  age:42  hair:black  birthday:"Sunday {11}-{March}-{1984}"}
    {fullname:"Sally Green" age:51  hair:brown  birthday:"Monday {19}-{May}-{1975}"}
    {fullname:"Ben Jones"   age:9   hair:blue   birthday:"Monday {22}-{Dec}-{2017}"}
  }
`;

function withPeople(expr) { return PEOPLE + '  ' + expr; }

// ---------- Basic name query ----------

test('querying a top-level bound name returns its value', () => {
  assert.equal(punk('msg:"hello"  msg?'), '"hello"');
});

test('querying an unbound name returns NULL', () => {
  assert.equal(punk('nope?'), 'NULL');
});

// ---------- Index ----------

test('index uses 1-based numbering', () => {
  assert.equal(punk('xs:{a b c}  xs.1?'), '{a}');
  assert.equal(punk('xs:{a b c}  xs.2?'), '{b}');
  assert.equal(punk('xs:{a b c}  xs.3?'), '{c}');
});

test('index into a record returns the value side of the named thing at that position', () => {
  // person 1, position 2 is `age:42` -> just `42`
  assert.equal(punk(withPeople('people.1.2?')), '{42}');
});

test('index out of range returns NULL', () => {
  assert.equal(punk('xs:{a b c}  xs.0?'),  'NULL');
  assert.equal(punk('xs:{a b c}  xs.4?'),  'NULL');
  assert.equal(punk('xs:{a b c}  xs.99?'), 'NULL');
});

test('indexing a bare-value binding returns the (wrapped) value', () => {
  // `x:42` is shorthand for `x:{42}`, so `x.1?` is the only item.
  assert.equal(punk('x:42  x.1?'), '{42}');
  assert.equal(punk('x:42  x.2?'), 'NULL');
});

// ---------- Last item shorthand ----------

test('`.~?` returns the last item', () => {
  assert.equal(punk('xs:{a b c}  xs.~?'), '{c}');
});

// ---------- Length ----------

test('`.#?` of a structured template is item count', () => {
  assert.equal(punk('xs:{a b c}  xs.#?'),   '{3}');
  assert.equal(punk('xs:{}      xs.#?'),    '{0}');
  assert.equal(punk('xs:{x}     xs.#?'),    '{1}');
});

test('`.#?` of an unstructured template is character count', () => {
  assert.equal(punk('s:"hello"  s.#?'),     '{5}');
  assert.equal(punk('s:""       s.#?'),     '{0}');
});

test('`.#?` of a record counts named items', () => {
  assert.equal(punk('r:{a:1 b:2 c:3}  r.#?'), '{3}');
});

// ---------- Range: n~ ----------

test('`.n~?` is from n to end', () => {
  assert.equal(punk('xs:{a b c d}  xs.2~?'), '{b c d}');
  assert.equal(punk('xs:{a b c d}  xs.4~?'), '{d}');
});

test('range names are stripped (path navigation never returns names)', () => {
  // Person 2, items 3 and 4 are `hair:brown` and `birthday:"..."`.
  // Range returns the value side of each named slot.
  assert.equal(
    punk(withPeople('people.2.3~?')),
    '{brown "Monday {19}-{May}-{1975}"}'
  );
});

// ---------- Range: ~n ----------

test('`.~n?` is from start up to n inclusive', () => {
  assert.equal(punk('xs:{a b c d}  xs.~2?'), '{a b}');
  assert.equal(punk('xs:{a b c d}  xs.~1?'), '{a}');
});

test('`.~n?` works on characters of an unstructured template', () => {
  assert.equal(punk('s:"Ben Jones"  s.~5?'), '"Ben J"');
});

// ---------- Range: n~m ----------

test('`.n~m?` is items n through m inclusive', () => {
  assert.equal(punk('xs:{a b c d e}  xs.2~4?'), '{b c d}');
  assert.equal(punk('xs:{a b c d e}  xs.3~3?'), '{c}');
});

test('range with n > m returns the empty template', () => {
  assert.equal(punk('xs:{a b c}  xs.3~1?'), '{}');
});

test('range out of bounds clamps or returns NULL', () => {
  // Need to pin this — but at least the call should not crash.
  // Asserting it returns SOMETHING printable.
  const v = punk('xs:{a b c}  xs.2~99?');
  assert.ok(v === '{b c}' || v === 'NULL', `got ${v}`);
});

// ---------- Name segment `.:?` ----------

test('`.:?` returns the name of a named thing as a bare Word', () => {
  assert.equal(punk(withPeople('people.1.fullname.:?')), '{fullname}');
});

test('`.:?` of an unnamed item returns NULL', () => {
  assert.equal(punk('xs:{a b c}  xs.1.:?'), 'NULL');
});

test('`.:?` works off any segment of a path', () => {
  assert.equal(punk(withPeople('people.1.2.:?')), '{age}');
});

// ---------- Pattern segment `.()?` ----------

test('`.()?` of a function returns its pattern bare', () => {
  assert.equal(punk('add:(a:_ b:_){+!{a? b?}}  add.()?'),
                    '(a:_ b:_)');
});

test('`.()?` of a non-function returns NULL', () => {
  assert.equal(punk('x:42  x.()?'), 'NULL');
  assert.equal(punk('xs:{1 2 3}  xs.()?'), 'NULL');
  assert.equal(punk('s:"hi"  s.()?'), 'NULL');
});

// ---------- Querying without a `?` is just text ----------

test('a path without `?` is just bare characters at the top level', () => {
  // `people.1.fullname` (no `?`) is just the word; it auto-wraps as a Word.
  assert.equal(punk('people.1.fullname'), '{people.1.fullname}');
});

// ---------- Querying is safe — no evaluation ----------

test('querying does not evaluate functions inside the value', () => {
  assert.equal(
    punk('xs:{(n:_){+!{n? 1}} 2}  xs.1?'),
    '(n:_){+!{n? 1}}'
  );
});

test('querying a bare Word literal is a syntax error', () => {
  punkThrows('hello.1?');
});

test('querying a Word via a name returns the (wrapped) Word', () => {
  // `n:hello` is shorthand for `n:{hello}`, so `n.1?` is the only item.
  assert.equal(punk('n:hello   n.1?'), '{hello}');
  assert.equal(punk('n:hello   n.2?'), 'NULL');
});

test('querying into a Word literally wrapped in a template returns the Word', () => {
  assert.equal(punk('{hello}.1?'), '{hello}');
});
