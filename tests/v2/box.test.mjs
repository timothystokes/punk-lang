import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings } from '../../src/v2/builtins.js';
import { num, TRUE, FALSE, formatValue } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;

// -- write then read --------------------------------------------------

test('write into a fresh box then read it back', () => {
  const e = env();
  val('42->[currentAge]!', e);
  assert.equal(val('[currentAge]->id!', { ...e, bindings: new Map([['id', { kind:'builtin', name:'id', fn:(a)=>a, arity:1 }]]), parent: e, boxes: e.boxes }).value, 42);
});

test('write replaces the previous value', () => {
  const e = env();
  val('1->[x]!', e);
  val('2->[x]!', e);
  val('3->[x]!', e);
  assert.equal(e.boxes.get('x').value, 3);
});

test('reading an unset box throws', () => {
  assert.throws(() => val('[ghost]->id!'), /has no value/);
});

// -- read, transform, write (counter pattern) -------------------------

test('counter increment via [c]->+\'1->[c]!', () => {
  const e = env();
  val('0->[counter]!', e);
  val("[counter]->+'1->[counter]!", e);
  val("[counter]->+'1->[counter]!", e);
  val("[counter]->+'1->[counter]!", e);
  assert.equal(e.boxes.get('counter').value, 3);
});

test('reading produces the current box value into the pipeline', () => {
  const e = env();
  val('5->[n]!', e);
  // multiply by 2 via partial
  const r = val("[n]->*'2!", e);
  assert.equal(r.value, 10);
  // box itself is unchanged
  assert.equal(e.boxes.get('n').value, 5);
});

// -- box pipeline as part of a sequence -------------------------------

test('multiple box pipelines in one program', () => {
  const e = env();
  val('1->[a]! 2->[b]! [a]->+\'1->[a]!', e);
  assert.equal(e.boxes.get('a').value, 2);
  assert.equal(e.boxes.get('b').value, 2);
});

test('box pipeline result is the final value', () => {
  const e = env();
  // The whole "0->[c]!" expression evaluates to the written value (0).
  assert.equal(val('0->[c]!', e).value, 0);
});

// A box pipeline may appear on the value side of a binding (`name:` RHS).
test('binding RHS may be a box read pipeline', () => {
  const e = env();
  val('7->[n]!', e);
  assert.equal(val("id:(x:_){x?} cur:[n]->id! cur?", e).value, 7);
});

// The leading stage of a box pipeline can be any value, not only a Word
// that fuses with `->` in tokenization. The docs show `{}->[greeters]!`
// as the canonical way to bring a tmpl-valued box into existence.
test('box pipeline may start with a tmpl literal', () => {
  const e = env();
  val('{}->[xs]!', e);
  assert.equal(e.boxes.get('xs').kind, 'tmpl');
  assert.equal(e.boxes.get('xs').items.length, 0);
});

// -- errors -----------------------------------------------------------

test('box must contain a name', () => {
  assert.throws(() => val('1->[]!'), /box must contain/);
});

test('box pipeline without trailing ! is rejected', () => {
  // `5->[x]` with no `!` is malformed (no executor)
  assert.throws(() => val('5->[x]'), /must end with '!'/);
});

test('boxes do not shadow named bindings', () => {
  const e = env();
  val('x:99 7->[x]!', e);
  // The name x is bound to 99; the box [x] holds 7. Independent namespaces.
  assert.equal(e.boxes.get('x').value, 7);
  // Reading the name x via query returns the bound value.
  assert.equal(val('x?', { ...e, bindings: new Map([['x', num(99)]]), parent: null, boxes: e.boxes }).value, 99);
});

// -- mixed with builtins / pipeline -----------------------------------

test('box value can feed multiple stages', () => {
  const e = env();
  val('3->[n]!', e);
  // [n] -> *'2 -> +'1  → (3*2)+1 = 7
  assert.equal(val("[n]->*'2->+'1!", e).value, 7);
});

test('comparison consuming a box value', () => {
  const e = env();
  val('10->[n]!', e);
  // under10:>'10 means >!{10 ?}. [n]->under10! where [n]=10 → >!{10 10} = FALSE
  assert.equal(val("under10:>'10 [n]->under10!", e), FALSE);
  val('3->[n]!', e);
  assert.equal(val("under10:>'10 [n]->under10!", e), TRUE);
});
