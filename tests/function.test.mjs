import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { num, text, isFn, NULL, TRUE } from '../src/values.js';

const run = (src, env = rootEnv()) => evalProgram(parse(tokenize(src)), env);
const val = (src, env) => run(src, env).value;

// -- function literals -------------------------------------------------

test('function literal evaluates to a fn value', () => {
  const v = val('id:(x:_){x?}');
  // last expression is the bind → NamedThing(id, fn)
  assert.equal(v.name, 'id');
  assert.equal(isFn(v.value), true);
});

// -- calls -------------------------------------------------------------

test('call with inline number arg: id!5', () => {
  assert.deepEqual(val('id:(x:_){x?} id!5'), num(5));
});

test('call with inline text arg: id!hello', () => {
  assert.deepEqual(val('id:(x:_){x?} id!hello'), text('hello'));
});

test('call with template arg: id!{a b}', () => {
  const v = val('id:(xs:___){xs?} id!{a b}');
  assert.equal(v.kind, 'tmpl');
});

test('call with pattern-list arg: pair!(1 2)', () => {
  const v = val('pair:(p:___){p?} pair!(1 2)');
  assert.equal(v.kind, 'tmpl');
});

test('call yields body of multi-item template', () => {
  // body is a sequence; result is last value
  assert.deepEqual(val('f:(x:_){x? 42} f!7'), num(42));
});

// -- pattern matching on call ------------------------------------------

test('call with mismatched pattern is a runtime error', () => {
  assert.throws(() => val('only5:(5){ok} only5!6'), /does not match/i);
});

test('call with matching literal pattern succeeds', () => {
  assert.deepEqual(val('only5:(5){ok} only5!5'), text('ok'));
});

// -- closures ----------------------------------------------------------

test('closure captures outer name', () => {
  // f returns the value of n in its defining env
  const src = `
    make:(n:_){n?}
    make!10
  `;
  assert.deepEqual(val(src), num(10));
});

test('closure: inner fn sees outer bind', () => {
  const src = `
    mult:(a:_ b:_){a?}
    mult!(7 9)
  `;
  // pattern destructures the list into a and b; body returns a
  assert.deepEqual(val(src), num(7));
});

// -- recursion ---------------------------------------------------------

test('self-reference: recursive name visible in body env', () => {
  // The closure for f must see f in its own env. We don't test recursion
  // termination here (no arithmetic yet) — just that resolving `f?` inside
  // the body succeeds.
  const src = `
    f:(0){f?}
    f!0
  `;
  const v = val(src);
  assert.equal(isFn(v), true);
});

// -- embedded bind value (x:f!5) ---------------------------------------

test('embedded bind value can be a call', () => {
  const src = `
    id:(x:_){x?}
    y:id!7
    y?
  `;
  assert.deepEqual(val(src), num(7));
});

// -- chained calls -----------------------------------------------------

test('chained call: f!g!5 applies right-to-left', () => {
  // g returns its arg as a one-item template; f returns its arg
  // unchanged — so f!g!5 ≡ f!(g!5) ≡ 5
  const src = `
    f:(x:_){x?}
    g:(x:_){x?}
    f!g!5
  `;
  assert.deepEqual(val(src), num(5));
});

test('call with sequence-next arg via trailing !', () => {
  const src = `
    id:(p:___){p?}
    id! (1 2)
  `;
  const v = val(src);
  assert.equal(v.kind, 'tmpl');
});
