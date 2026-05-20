// Functions — definition, calling, return values, recursion, closures.
//
// From doc § "Functions":
//   - A function is a pattern attached to a template — `(p){t}`.
//   - The pattern and template must be **attached** — no whitespace between
//     `)` and `{`. With a space they are two unrelated things.
//   - SHORTCUT: when the body is a single expression, the outer `{}` are
//     optional — `(p)expr` is the same as `(p){expr}`.
//   - Call with `!`: `welcome!{Tim}` -> `{Hello Tim}`.
//   - A single-thing arg can be passed without braces: `f!x` ≡ `f!{x}`.
//   - Return rule: 1-item body returns that item directly; multi-item body
//     returns the whole template. Use `~` to slice a multi-item body.
//   - Recursion: a function may reference itself by name once bound.
//   - Closures: a function carries the scope it was defined in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('function literal prints as PDN', () => {
  assert.equal(
    punk('(name:_){Hello name?}'),
    '(name:_){Hello name?}'
  );
});

test('named function — calling with structured arg', () => {
  assert.equal(
    punk('welcome:(name:_){Hello name?}  welcome!{Tim}'),
    '{Hello Tim}'
  );
});

test('named function — calling with single bare thing', () => {
  // `f!Tim` is shorthand for `f!{Tim}`.
  assert.equal(
    punk('welcome:(name:_){Hello name?}  welcome!Tim'),
    '{Hello Tim}'
  );
});

test('whitespace between `)` and `{` is a syntax error — they are not a function', () => {
  // `(name:_) {Hello name?}` is a pattern then an unrelated template,
  // so attempting to call it as a function should fail.
  punkThrows('welcome:(name:_) {Hello name?}  welcome!Tim');
});

test('function returns the whole resulting template by default', () => {
  // `sizer` doc example without `~` returns the full template.
  const src = `sizer:(radius:_){
      circumference:X!{X!{3.141 radius?} 2}
      <!{circumference? 30}??{
        (TRUE){Small Circle}
        (FALSE){Large Circle}
      }!
    }
    sizer!7`;
  assert.equal(punk(src), '{circumference:{43.974} {Large Circle}}');
});

test('return range `~` returns only the last item of the template', () => {
  const src = `sizer:(radius:_){
      circumference:X!{X!{3.141 radius?} 2}
      <!{circumference? 30}??{
        (TRUE){Small Circle}
        (FALSE){Large Circle}
      }!
    }~
    sizer!7`;
  assert.equal(punk(src), '{Large Circle}');
});

test('simple nested function call — 1-item body returns the value directly', () => {
  // No `~` needed: body is a single arithmetic call, so the function
  // returns the resulting number. REPL wraps a bare number for display.
  assert.equal(
    punk('circ:(r:_){X!{X!{3.141 r?} 2}}  circ!7'),
    '{43.974}'
  );
});

test('recursion — function references itself by name', () => {
  // Body is one `??` expression, so no `~` is needed.
  const src = `factorial:(n:_){
      <=!{n? 1}??{
        (TRUE){1}
        (FALSE){X!{n? factorial!{-!{n? 1}}}}
      }!
    }
    factorial!5`;
  assert.equal(punk(src), '{120}');
});

test('closure — inner function captures outer name', () => {
  // Body is a single function literal; under the 1-item rule, make-adder
  // returns the inner function directly so add10 is callable.
  const src = `make-adder:(n:_){
      (x:_){+!{x? n?}}
    }
    add10:make-adder!10
    add10!5`;
  assert.equal(punk(src), '{15}');
});

test('closure — captured name is not affected by later rebinding in another scope', () => {
  // The closure keeps the value captured at its point of creation.
  const src = `make-adder:(n:_){(x:_){+!{x? n?}}}
    add10:make-adder!10
    add20:make-adder!20
    {add10!5 add20!5}!`;
  assert.equal(punk(src), '{15 25}');
});

test('function with unstructured-template body', () => {
  // Doc § PDN: `(...)"..."` is also a function literal.
  assert.equal(
    punk('greet:(n:_)"Hi {n?}"  greet!Bob'),
    '"Hi Bob"'
  );
});

test('shortcut — outer braces are optional when body is a single expression', () => {
  // Doc § Functions: `(p)expr` is the same as `(p){expr}`.
  assert.equal(
    punk('inc:(n:_)+!{n? 1}  inc!4'),
    '{5}'
  );
});

test('shortcut — braceless body still follows the 1-item return rule', () => {
  // Body is a single fn literal, returned directly.
  const src = `make-adder:(n:_)(x:_){+!{x? n?}}
    add3:make-adder!3
    add3!10`;
  assert.equal(punk(src), '{13}');
});

test('return range `~` on braceless body — allowed and a no-op', () => {
  // 1-item body's last item is the only item, so `~` just returns it.
  assert.equal(
    punk('inc:(n:_)+!{n? 1}~  inc!4'),
    '{5}'
  );
});
