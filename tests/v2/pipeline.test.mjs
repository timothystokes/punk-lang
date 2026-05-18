import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv, extend } from '../../src/v2/env.js';
import { num, text, builtin, isFn, NULL } from '../../src/v2/values.js';

const run = (src, env = rootEnv()) => evalProgram(parse(tokenize(src)), env);
const val = (src, env) => run(src, env).value;

// A tiny env preloaded with simple unary builtins for pipeline tests.
function pipeEnv() {
  const upper = builtin('upper', (arg) => {
    if (arg.kind !== 'text') throw new Error('upper: not text');
    return text(arg.value.toUpperCase());
  });
  const lower = builtin('lower', (arg) => {
    if (arg.kind !== 'text') throw new Error('lower: not text');
    return text(arg.value.toLowerCase());
  });
  const inc = builtin('inc', (arg) => {
    if (arg.kind !== 'num') throw new Error('inc: not num');
    return num(arg.value + 1);
  });
  const dbl = builtin('dbl', (arg) => {
    if (arg.kind !== 'num') throw new Error('dbl: not num');
    return num(arg.value * 2);
  });
  return extend(rootEnv(), { upper, lower, inc, dbl });
}

// -- execute mode ------------------------------------------------------

test('execute: value->fn! applies fn to value', () => {
  assert.deepEqual(val('Hello->upper!', pipeEnv()), text('HELLO'));
});

test('execute: chained value->f->g! applies left-to-right', () => {
  assert.deepEqual(val('HELLO->lower->upper!', pipeEnv()), text('HELLO'));
});

test('execute: numeric pipeline 5->inc->dbl!', () => {
  assert.deepEqual(val('5->inc->dbl!', pipeEnv()), num(12));
});

test('execute: first stage can be a name lookup', () => {
  assert.deepEqual(val('x:hello x?->upper!', pipeEnv()), text('HELLO'));
});

// -- compose mode ------------------------------------------------------

test('compose: f->g binds a function value', () => {
  const r = val('shout:upper->lower', pipeEnv());
  assert.equal(r.name, 'shout');
  assert.equal(isFn(r.value), true);
});

test('compose: composed fn applies stages left-to-right when called', () => {
  // upper->lower applied to "Hi" → upper("Hi")="HI" → lower("HI")="hi"
  assert.deepEqual(val('shout:upper->lower shout!Hi', pipeEnv()), text('hi'));
});

test('compose: a composed pipeline can sit as a stage of another pipeline', () => {
  // shout:upper->lower then  Hello->shout->upper!  →  HELLO
  assert.deepEqual(
    val('shout:upper->lower Hello->shout->upper!', pipeEnv()),
    text('HELLO'),
  );
});

test('compose: user fn composes with builtin', () => {
  // id:(x:_){x?}   then   pipe:upper->id   →   pipe!Hi == HI
  assert.deepEqual(
    val('id:(x:_){x?} pipe:upper->id pipe!Hi', pipeEnv()),
    text('HI'),
  );
});

// -- errors ------------------------------------------------------------

test('execute: stage that is not a function errors', () => {
  assert.throws(
    () => val('Hello->notAFn!', extend(pipeEnv(), { notAFn: text('nope') })),
    /not a function/i,
  );
});

test('compose: first stage not a function errors at compose time', () => {
  // Plain text 'Hello' isn't bound, so lookup fails with "undefined name".
  // (Compose-mode stages are resolved by name lookup.)
  assert.throws(() => val('Hello->upper', pipeEnv()), /undefined name|not a function/i);
});

test('empty pipeline stage errors', () => {
  assert.throws(() => val('->upper!', pipeEnv()), /empty pipeline stage/i);
});

test('trailing arrow with bang errors', () => {
  // `upper->!` — last stage is empty after stripping the bang.
  assert.throws(() => val('upper->!', pipeEnv()), /empty pipeline stage/i);
});
