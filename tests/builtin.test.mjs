import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { defaultBindings } from '../src/builtins.js';
import { num, text, TRUE, FALSE, NULL, formatValue } from '../src/values.js';

const env = () => rootEnv(defaultBindings());
const run = (src) => evalProgram(parse(tokenize(src)), env());
const val = (src) => run(src).value;
const fmt = (src) => formatValue(val(src));

// -- arithmetic --------------------------------------------------------

test('+ variadic sum', () => {
  assert.equal(val('+!{1 2 3 4}').value, 10);
});

test('+ single-item shorthand', () => {
  assert.equal(val('+!5').value, 5);
});

test('* variadic product', () => {
  assert.equal(val('*!{2 3 4}').value, 24);
});

test('- binary subtract', () => {
  assert.equal(val('-!{10 3}').value, 7);
});

test('/ binary divide', () => {
  assert.equal(val('/!{20 4}').value, 5);
});

test('/ division by zero throws', () => {
  assert.throws(() => val('/!{1 0}'), /division by zero/);
});

test('^ power', () => {
  assert.equal(val('^!{2 8}').value, 256);
});

test('% remainder', () => {
  assert.equal(val('%!{17 5}').value, 2);
});

test('min/max variadic', () => {
  assert.equal(val('min!{4 2 9 5}').value, 2);
  assert.equal(val('max!{4 2 9 5}').value, 9);
});

test('unary math', () => {
  assert.equal(val('abs!-5').value, 5);
  assert.equal(val('neg!7').value, -7);
  assert.equal(val('floor!3.7').value, 3);
  assert.equal(val('ceil!3.2').value, 4);
  assert.equal(val('round!3.7').value, 4);
  assert.equal(val('sqrt!16').value, 4);
});

test('+ unwraps NamedThings', () => {
  assert.equal(val('a:5 b:3 +!{a? b?}').value, 8);
});

test('+ rejects non-numbers', () => {
  assert.throws(() => val('+!{1 cat}'), /expected number/);
});

// -- comparison --------------------------------------------------------

test('= exact equality', () => {
  assert.equal(val('=!{5 5}'), TRUE);
  assert.equal(val('=!{5 6}'), FALSE);
  assert.equal(val('=!{cat cat}'), TRUE);
});

test('<> inequality', () => {
  assert.equal(val('<>!{cat dog}'), TRUE);
  assert.equal(val('<>!{5 5}'), FALSE);
});

test('< > <= >= numeric ordering', () => {
  assert.equal(val('<!{3 10}'), TRUE);
  assert.equal(val('>!{3 10}'), FALSE);
  assert.equal(val('<=!{5 5}'), TRUE);
  assert.equal(val('>=!{5 4}'), TRUE);
});

test('comparison rejects non-numbers', () => {
  assert.throws(() => val('<!{cat 5}'), /expected number/);
});

// -- boolean logic -----------------------------------------------------

test('and variadic', () => {
  assert.equal(val('and!{TRUE TRUE TRUE}'), TRUE);
  assert.equal(val('and!{TRUE FALSE TRUE}'), FALSE);
});

test('or variadic', () => {
  assert.equal(val('or!{FALSE TRUE FALSE}'), TRUE);
  assert.equal(val('or!{FALSE FALSE FALSE}'), FALSE);
});

test('not unary', () => {
  assert.equal(val('not!TRUE'), FALSE);
  assert.equal(val('not!FALSE'), TRUE);
});

test('xor', () => {
  assert.equal(val('xor!{TRUE FALSE}'), TRUE);
  assert.equal(val('xor!{TRUE TRUE}'), FALSE);
  assert.equal(val('xor!{FALSE FALSE}'), FALSE);
});

test('and rejects non-booleans', () => {
  assert.throws(() => val('and!{TRUE 5}'), /expected boolean/);
});

// -- partial application on builtins -----------------------------------

test("partial on variadic +: inc:+'1", () => {
  assert.equal(val("inc:+'1 inc!2").value, 3);
});

test("partial on variadic +: add5 variadic call", () => {
  assert.equal(val("add5:+'5 add5!{10 20}").value, 35);
});

test("partial on binary -: dec5: -'{? 5}", () => {
  // Use multi-fill via tmpl to fix first slot only.
  assert.equal(val("rsub3:-'3 rsub3!10").value, -7);
});

test("partial on binary - with two fills via tmpl is a zero-arg thunk", () => {
  // -'{10 3} fills both slots → arity 0 → trailing ! makes a zero-arg call.
  assert.equal(val("d:-'{10 3} d!").value, 7);
});

test("partial on unary not: zero-arg thunk", () => {
  assert.equal(val("flip:not'TRUE flip!"), FALSE);
});

test("partial on comparison: rgt5", () => {
  // >'5 fixes the FIRST arg (a) of >!{a b}, so rgt5!10 = >!{5 10} = FALSE.
  assert.equal(val("rgt5:>'5 rgt5!10"), FALSE);
  assert.equal(val("rgt5:>'5 rgt5!2"), TRUE);
});

test("partial overfill on fixed-arity builtin throws", () => {
  assert.throws(() => val("-'{1 2 3}"), /too many partial arguments/);
});

// -- pipeline integration ----------------------------------------------

test('pipeline through builtins', () => {
  // bind partials first, then pipe a value through them
  assert.equal(val("inc:+'1 dbl:*'2 5->inc->dbl!").value, 12);
});

test('compose pipeline with partial stages', () => {
  // f = inc then dbl, applied to 5 = 12
  assert.equal(val("inc:+'1 dbl:*'2 f:inc->dbl f!5").value, 12);
});

test('docs example: under10 with > partial', () => {
  // under10:>'10 means >!{10 ?}, so under10!7 = >!{10 7} = TRUE
  assert.equal(val("under10:>'10 7->under10!"), TRUE);
});
