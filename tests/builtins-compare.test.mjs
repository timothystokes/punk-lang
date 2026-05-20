// Comparison builtins — all return TRUE / FALSE (bare).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('=! equality on numbers', () => {
  assert.equal(punk('=!{5 5}'), 'TRUE');
  assert.equal(punk('=!{5 6}'), 'FALSE');
});

test('=! equality on words', () => {
  assert.equal(punk('=!{cat cat}'), 'TRUE');
  assert.equal(punk('=!{cat dog}'), 'FALSE');
});

test('=! equality on templates', () => {
  assert.equal(punk('=!{{1 2} {1 2}}'), 'TRUE');
  assert.equal(punk('=!{{1 2} {1 3}}'), 'FALSE');
});

test('=! equality on reserved values', () => {
  assert.equal(punk('=!{TRUE TRUE}'),   'TRUE');
  assert.equal(punk('=!{TRUE FALSE}'),  'FALSE');
  assert.equal(punk('=!{NULL NULL}'),   'TRUE');
  assert.equal(punk('=!{NULL FALSE}'),  'FALSE');
});

test('<>! inequality', () => {
  assert.equal(punk('<>!{cat dog}'), 'TRUE');
  assert.equal(punk('<>!{cat cat}'), 'FALSE');
});

test('<! less than', () => {
  assert.equal(punk('<!{3 10}'),  'TRUE');
  assert.equal(punk('<!{10 3}'),  'FALSE');
  assert.equal(punk('<!{5 5}'),   'FALSE');
});

test('>! greater than', () => {
  assert.equal(punk('>!{10 3}'), 'TRUE');
  assert.equal(punk('>!{3 10}'), 'FALSE');
  assert.equal(punk('>!{5 5}'),  'FALSE');
});

test('<=! / >=!', () => {
  assert.equal(punk('<=!{5 5}'), 'TRUE');
  assert.equal(punk('<=!{4 5}'), 'TRUE');
  assert.equal(punk('<=!{6 5}'), 'FALSE');
  assert.equal(punk('>=!{5 5}'), 'TRUE');
  assert.equal(punk('>=!{6 5}'), 'TRUE');
  assert.equal(punk('>=!{4 5}'), 'FALSE');
});
