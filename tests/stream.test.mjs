// streamRead! builtin: accumulate Node-style readable-stream chunks and
// invoke a Punk callback once with the full utf8 body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { tokenize } from '../src/tokenize.js';
import { parse } from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { defaultBindings } from '../src/builtins.js';
import { jsobj, text, builtin } from '../src/values.js';
import { formatValue } from '../src/values.js';

function run(src, extras = {}) {
  const e = rootEnv(defaultBindings());
  for (const [k, v] of Object.entries(extras)) e.bindings.set(k, v);
  return evalProgram(parse(tokenize(src)), e).value;
}

test('streamRead! accumulates data chunks and calls cb with joined text', () => {
  const stream = new EventEmitter();
  let captured = null;
  const record = builtin('record', (arg) => { captured = arg; return arg; }, 1);

  // Set up listeners via streamRead!, then emit synchronously.
  run('streamRead!{s? (body:_){record!body?}}', {
    s: jsobj(stream),
    record,
  });

  stream.emit('data', Buffer.from('hello '));
  stream.emit('data', Buffer.from('world'));
  stream.emit('end');

  assert.equal(captured && captured.kind, 'text');
  assert.equal(captured.value, 'hello world');
});

test('streamRead! handles string chunks too', () => {
  const stream = new EventEmitter();
  let captured = null;
  const record = builtin('record', (arg) => { captured = arg; return arg; }, 1);

  run('streamRead!{s? (b:_){record!b?}}', {
    s: jsobj(stream),
    record,
  });

  stream.emit('data', 'foo');
  stream.emit('data', 'bar');
  stream.emit('end');

  assert.equal(captured.value, 'foobar');
});

test('streamRead! with no data events calls cb with empty text', () => {
  const stream = new EventEmitter();
  let captured = null;
  const record = builtin('record', (arg) => { captured = arg; return arg; }, 1);

  run('streamRead!{s? (b:_){record!b?}}', {
    s: jsobj(stream),
    record,
  });

  stream.emit('end');

  assert.equal(captured.value, '');
});
