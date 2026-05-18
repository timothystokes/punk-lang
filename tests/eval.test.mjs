import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv, lookup } from '../src/env.js';
import {
  num, text, named, NULL, TRUE, FALSE,
  formatValue, isTmpl, isNamed, isRegex,
} from '../src/values.js';

const run = (src, env = rootEnv()) => evalProgram(parse(tokenize(src)), env);
const val = (src, env) => run(src, env).value;

test('empty program → NULL', () => {
  const r = run('');
  assert.deepEqual(r.value, NULL);
});

test('number literal', () => {
  assert.deepEqual(val('42'), num(42));
  assert.deepEqual(val('-5'), num(-5));
  assert.deepEqual(val('0.5'), num(0.5));
});

test('reserved words', () => {
  assert.equal(val('TRUE'),  TRUE);
  assert.equal(val('FALSE'), FALSE);
  assert.equal(val('NULL'),  NULL);
});

test('bareword evaluates to text', () => {
  assert.deepEqual(val('Hello'), text('Hello'));
});

test('top-level name-bind via embedded colon (age:30)', () => {
  const r = run('age:30');
  assert.deepEqual(lookup(r.env, 'age'), num(30));
  assert.deepEqual(r.value, named('age', num(30)));
});

test('top-level name-bind via trailing colon + next item (welcome: {hi})', () => {
  const r = run('welcome: {hi}');
  const bound = lookup(r.env, 'welcome');
  assert.ok(isTmpl(bound), 'welcome should be a template');
});

test('query: look up a previously bound name', () => {
  const r = run('age:30 age?');
  assert.deepEqual(r.value, num(30));
});

test('query: undefined name throws', () => {
  assert.throws(() => run('missing?'), /undefined name: missing/);
});

test('chained bindings build up env', () => {
  const r = run('a:1 b:2 c:3');
  assert.deepEqual(lookup(r.env, 'a'), num(1));
  assert.deepEqual(lookup(r.env, 'b'), num(2));
  assert.deepEqual(lookup(r.env, 'c'), num(3));
});

test('rebind shadows in same scope (last writer wins)', () => {
  const r = run('x:1 x:2 x?');
  assert.deepEqual(r.value, num(2));
});

test('template literal is lazy — items remain AST, env captured', () => {
  const r = run('{Hello world}');
  assert.ok(isTmpl(r.value));
  assert.equal(r.value.items.length, 2);
  // items are AST nodes, not pre-evaluated values
  assert.equal(r.value.items[0].type, 'Word');
  assert.equal(r.value.items[0].text, 'Hello');
  assert.ok(r.value.env, 'template captured an env');
});

test('lazy template: inner query is NOT resolved at construction time', () => {
  // No `person` is bound — yet building the template doesn't throw.
  const r = run('message:{Hello person?}');
  assert.ok(isTmpl(lookup(r.env, 'message')));
});

test('template captures its defining env (closure)', () => {
  // person bound BEFORE the template is constructed; the template carries
  // an env that resolves person to Tim.
  const r = run('person:Tim message:{Hello person?}');
  const msg = lookup(r.env, 'message');
  assert.ok(isTmpl(msg));
  // The captured env should resolve `person`
  assert.deepEqual(lookup(msg.env, 'person'), text('Tim'));
});

test('formatValue serialises a lazy template back to source-ish form', () => {
  const r = run('{Hello person?}');
  assert.equal(formatValue(r.value), '{Hello person?}');
});

test('regex literal evaluates to a regex value', () => {
  const r = run('"^\\d+$"');
  assert.ok(isRegex(r.value));
  assert.equal(r.value.source, '^\\d+$');
});

test('escaped trailing ? is literal, not a query', () => {
  // `What\?` ends with literal '?', should be text, not a query
  const r = run('What\\?');
  assert.deepEqual(r.value, text('What?'));
});

test('escaped colon does not bind', () => {
  // `not\:bind` is one Word, the ':' is escaped → treated as plain text
  const r = run('not\\:bind');
  assert.deepEqual(r.value, text('not:bind'));
});

test('binding a template, then querying it returns the template', () => {
  const r = run('m:{a b} m?');
  assert.ok(isTmpl(r.value));
  assert.equal(r.value.items.length, 2);
});

test('binding name cannot be a number', () => {
  // `42:x` would try to bind name "42"
  assert.throws(() => run('42:x'), /looks like a number/);
});

test('multiple top-level items: last value wins', () => {
  const r = run('1 2 3');
  assert.deepEqual(r.value, num(3));
});
