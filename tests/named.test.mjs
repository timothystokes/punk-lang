// Named Things — `name:thing` syntax.
//
// Rules (from doc):
//   - Names attach directly to a thing with no space between `:` and value.
//   - A name on its own is naming nothing; querying it returns NULL.
//   - At the REPL, a named binding echoes back the named thing (with the
//     same auto-wrap rule on the inner value).
//   - Names are immutable once bound in a given scope.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('binding a named unstructured template echoes the binding', () => {
  assert.equal(punk('message:"Hello world"'),
                    'message:"Hello world"');
});

test('binding a named structured template echoes the binding', () => {
  assert.equal(punk('xs:{1 2 3}'), 'xs:{1 2 3}');
});

test('binding a named Word wraps the inner Word', () => {
  assert.equal(punk('name:Tim'), 'name:{Tim}');
});

test('binding a named Number wraps the inner Number', () => {
  assert.equal(punk('age:42'), 'age:{42}');
});

test('binding a named pattern echoes bare (no inner wrap)', () => {
  assert.equal(punk('pair:([a] [b])'), 'pair:([a] [b])');
});

test('binding a named function echoes bare', () => {
  assert.equal(punk('id:([x]){x?}'), 'id:([x]){x?}');
});

test('binding a reserved value wraps it on the value side', () => {
  // Reserved words wrap like any value Word: `ok:TRUE` ≡ `ok:{TRUE}`.
  assert.equal(punk('ok:TRUE'),    'ok:{TRUE}');
  assert.equal(punk('done:FALSE'), 'done:{FALSE}');
  assert.equal(punk('miss:NULL'),  'miss:{NULL}');
});

test('a name attached with a space between `:` and value is a syntax error', () => {
  // `foo: 5` is `foo:` (a name attached to nothing) followed by `5`.
  // Since `:` must be followed without whitespace by a thing, the
  // first token is invalid.
  punkThrows('foo: 5');
});

test('a dangling `name:` at the end of input is a syntax error', () => {
  // Names are immutable — implicitly binding to NULL makes no sense.
  punkThrows('foo:');
});

test('querying a bound name returns its value', () => {
  assert.equal(punk('x:7  x?'),                '{7}');
  assert.equal(punk('msg:"hi"  msg?'),         '"hi"');
  assert.equal(punk('xs:{a b c}  xs?'),        '{a b c}');
});

test('querying an unbound name returns NULL', () => {
  assert.equal(punk('nope?'), 'NULL');
});

test('rebinding the same name in the same scope is an error', () => {
  // Names are immutable — a second `x:` in the same scope is a sad path.
  punkThrows('x:1  x:2');
});

test('a name can contain hyphens, digits, underscores and `$`', () => {
  assert.equal(punk('first-name:"Tim"  first-name?'),  '"Tim"');
  assert.equal(punk('x1:1  x1?'),                       '{1}');
  assert.equal(punk('snake_name:9  snake_name?'),       '{9}');
  assert.equal(punk('$jsThing:7  $jsThing?'),           '{7}');
});

test('names are case-sensitive', () => {
  assert.equal(punk('Foo:1  foo:2  Foo?'), '{1}');
  assert.equal(punk('Foo:1  foo:2  foo?'), '{2}');
});

test('a name cannot start with a digit', () => {
  punkThrows('1foo:5');
});
