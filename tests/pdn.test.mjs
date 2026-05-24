// PDN — Punk Data Notation.
//
// From doc § "Punk Data Notation":
//   - A program *is* its data; same surface for source and serialised value.
//   - Four ingredients: Things, Structured Templates, Unstructured Templates,
//     Named things.
//   - `age:42` is one named thing; `age: 42` is two separate things (name
//     bound to nothing, then 42).
//   - PDN has no separate dict/array/tuple — all are templates.
//   - Function literals `(...){...}` / `(...)"..."` are also PDN — values
//     you can write down, read back, treat as data. Nothing runs without
//     `!`.
//   - Element-tree shape: `tag:(attrs)body`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('a record-shaped value round-trips through display', () => {
  assert.equal(
    punk('{name:"Jane Green" age:42 location:Sydney}'),
    '{name:"Jane Green" age:42 location:Sydney}'
  );
});

test('a list of records is just a template of templates', () => {
  const src = `{
    {name:"John Smith" age:39 location:"New York"}
    {name:"Jane Green" age:42 location:Sydney}
  }`;
  // Whitespace inside structured templates is purely separator — display
  // should normalise to single-space-separated.
  assert.equal(
    punk(src),
    '{{name:"John Smith" age:39 location:"New York"} {name:"Jane Green" age:42 location:Sydney}}'
  );
});

test('empty template `{}` is a valid value', () => {
  assert.equal(punk('{}'), '{}');
});

test('a single bare Word at the top level prints wrapped', () => {
  assert.equal(punk('Sydney'), '{Sydney}');
});

test('a single bare Number at the top level prints wrapped', () => {
  assert.equal(punk('42'), '{42}');
});

test('`age:42` is one named thing — queryable by name', () => {
  assert.equal(punk('age:42  age?'), '{42}');
});

test('`age: 42` (space after colon) is a syntax error', () => {
  // The colon must attach to its value — `age:` with a space is a
  // dangling name.
  punkThrows('age: 42');
});

test('a function literal is just PDN — inert until called', () => {
  // Querying a function returns only its body/template.
  assert.equal(
    punk('f:([x]){+!{x? 1}}  f?'),
    '{+!{x? 1}}'
  );
});

test('element-tree shape — tag:(attrs)body', () => {
  // The named thing `p:()` "" body is element-shaped PDN.
  // Querying the function returns its body template.
  assert.equal(
    punk('p:()"Welcome to Punk"  p?'),
    '{"Welcome to Punk"}'
  );
});

test('element tree nests — children are themselves element-shaped values', () => {
  const src = `page:{
    h1:(id:"x27")"Introduction"
    p:()"Welcome"
  }
  page?`;
  assert.equal(
    punk(src),
    '{h1:(id:"x27")"Introduction" p:()"Welcome"}'
  );
});

test('element-tree attribute is a path-queryable named slot in the pattern', () => {
  // Doc claims `page.div.class?` reads the attribute.
  assert.equal(
    punk('page:{div:(class:"panel"){}}  page.div.class?'),
    '"panel"'
  );
});

test('element-tree child at index is queryable — name stripped by path traversal', () => {
  // Doc rule: path traversal returns the VALUE side of any named thing
  // walked through. The 2nd child is `p:()"B"`; query returns fn body.
  const src = `page:{div:(){
    h1:()"A"
    p:()"B"
  }}  page.div.2?`;
  assert.equal(punk(src), '{"B"}');
});
