// White-box tests for parseValidate (pass 4).
//
// Catches purely structural mistakes the earlier passes didn't.
// Name resolution lives in eval, not here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import {
  parseTree, parseWords, parseOperators, parseValidate,
} from '../src/parse.js';

const run = (src) =>
  parseValidate(parseOperators(parseWords(parseTree(tokenize(src)))));

// ---------------------------------------------------------------------------
// Wildcard / variadic placement

test('lone _ outside a Pattern is a syntax error', () => {
  assert.throws(() => run('{_}'), /wildcard/);
});

test('lone ___ outside a Pattern is a syntax error', () => {
  assert.throws(() => run('{___}'), /variadic/);
});

test('_ inside a Pattern is fine', () => {
  run('(x:_)x?');
});

test('___ inside a Pattern is fine', () => {
  run('(args:___){args?}');
});

test('_ inside a nested Pattern is fine', () => {
  run('(outer:(_ _)){outer?}');
});

// ---------------------------------------------------------------------------
// Bare ! survivors

test('a stray bare ! at top level is a syntax error', () => {
  // parseOperators absorbs trailing `!` of a pipeline; a free `!`
  // with nothing in front of it should not survive.
  assert.throws(() => run('{!}'), /stray '!'/);
});

test('bare ! absorbed into a pipeline does NOT trigger the check', () => {
  run('0->[counter]!');
  run('Hello->upper->log!');
});

// ---------------------------------------------------------------------------
// Backwards ranges

test("'5~3' as a value-position range is a syntax error", () => {
  assert.throws(() => run('{5~3}'), /backwards/);
});

test("'7~2' as a path-segment range is a syntax error", () => {
  assert.throws(() => run('xs.7~2?'), /backwards/);
});

test("'2~7' (forward) is fine", () => {
  run('{2~7}');
  run('xs.2~7?');
});

test("equal bounds '3~3' are allowed (not flagged)", () => {
  run('{3~3}');
  run('xs.3~3?');
});

// ---------------------------------------------------------------------------
// Open-ended standalone ranges

test("'~5' in a value position is a syntax error", () => {
  assert.throws(() => run('{~5}'), /open-ended/);
});

test("'5~' in a value position is a syntax error", () => {
  assert.throws(() => run('{5~}'), /open-ended/);
});

test("open-ended ranges inside paths are fine", () => {
  run('xs.~5?');
  run('xs.5~?');
});

// ---------------------------------------------------------------------------
// Dangling PendingNamed

test("'xs:' with nothing to bind to is a syntax error", () => {
  assert.throws(() => run('{xs:}'), /xs:/);
});

test("'xs: 5' (space) is a syntax error (dangling Named)", () => {
  assert.throws(() => run('xs: 5'), /xs:/);
});

test('xs:5 (glued) is fine', () => {
  run('xs:5');
});

// ---------------------------------------------------------------------------
// Empty-body Fn with return-range

test('()~ (empty body, return-range) is a syntax error', () => {
  assert.throws(() => run('(){}~'), /empty body/);
});

test('(){body}~ (non-empty body) is fine', () => {
  run('(x:_){x?}~');
});

// ---------------------------------------------------------------------------
// Recursion: errors inside nested structures are still caught

test('error inside a Fn body is caught', () => {
  assert.throws(() => run('(x:_){_}'), /wildcard/);
});

test('error inside a Tmpl inside a Pattern slot is caught', () => {
  assert.throws(() => run('(x:{_}){x?}'), /wildcard/);
});

test('error inside a Pipeline stage is caught', () => {
  assert.throws(() => run('5->{_}->log!'), /wildcard/);
});

test('error inside a Text embed is caught', () => {
  assert.throws(() => run('"hi {!}"'), /stray '!'/);
});
