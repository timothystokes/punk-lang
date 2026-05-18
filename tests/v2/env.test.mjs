import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootEnv, makeEnv, lookup, extend, has } from '../../src/v2/env.js';
import { num, text } from '../../src/v2/values.js';

test('rootEnv with no bindings is empty', () => {
  const e = rootEnv();
  assert.equal(lookup(e, 'x'), undefined);
  assert.equal(has(e, 'x'), false);
});

test('rootEnv carries initial bindings', () => {
  const e = rootEnv({ x: num(1), y: text('hi') });
  assert.deepEqual(lookup(e, 'x'), num(1));
  assert.deepEqual(lookup(e, 'y'), text('hi'));
  assert.ok(has(e, 'x'));
});

test('extend creates a child without mutating parent', () => {
  const parent = rootEnv({ x: num(1) });
  const child = extend(parent, { y: num(2) });
  assert.deepEqual(lookup(child, 'x'), num(1)); // inherited
  assert.deepEqual(lookup(child, 'y'), num(2)); // own
  assert.equal(lookup(parent, 'y'), undefined); // parent untouched
});

test('child shadows parent', () => {
  const parent = rootEnv({ x: num(1) });
  const child = extend(parent, { x: num(99) });
  assert.deepEqual(lookup(child, 'x'), num(99));
  assert.deepEqual(lookup(parent, 'x'), num(1));
});

test('lookup walks the chain', () => {
  const g = rootEnv({ a: num(1) });
  const m = extend(g, { b: num(2) });
  const c = extend(m, { c: num(3) });
  assert.deepEqual(lookup(c, 'a'), num(1));
  assert.deepEqual(lookup(c, 'b'), num(2));
  assert.deepEqual(lookup(c, 'c'), num(3));
  assert.equal(lookup(c, 'missing'), undefined);
});

test('makeEnv accepts a parent and bindings', () => {
  const p = rootEnv({ x: num(1) });
  const c = makeEnv(p, { y: num(2) });
  assert.deepEqual(lookup(c, 'x'), num(1));
  assert.deepEqual(lookup(c, 'y'), num(2));
});
