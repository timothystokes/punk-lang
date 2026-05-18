import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse } from '../../src/v2/parse.js';

const p = (src) => parse(tokenize(src));

// Strip line/col + esc for compact comparison.
function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) {
      if (k === 'line' || k === 'col' || k === 'esc') continue;
      out[k] = strip(node[k]);
    }
    return out;
  }
  return node;
}

const W = (text) => ({ type: 'Word', text });
const T = (...items) => ({ type: 'Template', items });
const P = (...items) => ({ type: 'Pattern', items });
const F = (pattern, body) => ({ type: 'Function', pattern, body });
const B = (...items) => ({ type: 'Box', items });
const R = (pattern) => ({ type: 'Regex', pattern });

test('empty source produces empty program', () => {
  assert.deepEqual(strip(p('')), []);
});

test('single word', () => {
  assert.deepEqual(strip(p('hello')), [W('hello')]);
});

test('top-level multiple words', () => {
  assert.deepEqual(strip(p('a b c')), [W('a'), W('b'), W('c')]);
});

test('empty template', () => {
  assert.deepEqual(strip(p('{}')), [T()]);
});

test('template with items', () => {
  assert.deepEqual(strip(p('{Hello world}')), [T(W('Hello'), W('world'))]);
});

test('nested templates', () => {
  assert.deepEqual(strip(p('{a {b c} d}')), [T(W('a'), T(W('b'), W('c')), W('d'))]);
});

test('empty pattern (not attached to a template) is a Pattern node', () => {
  assert.deepEqual(strip(p('()')), [P()]);
});

test('pattern with items, standalone', () => {
  assert.deepEqual(strip(p('(a b)')), [P(W('a'), W('b'))]);
});

test('attached pattern + template forms a Function', () => {
  assert.deepEqual(strip(p('(x:_){x?}')), [F(P(W('x:_')), T(W('x?')))]);
});

test('whitespace between ) and { makes them two separate items, not a Function', () => {
  // i.e. attachment is required for a function
  assert.deepEqual(strip(p('(x:_) {x?}')), [P(W('x:_')), T(W('x?'))]);
});

test('Function whose body contains nested function', () => {
  const ast = strip(p('(n:_){(m:_){n? m?}}'));
  assert.deepEqual(ast, [
    F(P(W('n:_')), T(F(P(W('m:_')), T(W('n?'), W('m?'))))),
  ]);
});

test('named function: name word followed by attached Function', () => {
  // welcome: is a Word; the parser leaves the name-bind for the evaluator.
  const ast = strip(p('welcome:(name:_){Hello name?}'));
  assert.deepEqual(ast, [
    W('welcome:'),
    F(P(W('name:_')), T(W('Hello'), W('name?'))),
  ]);
});

test('box reference [counter]', () => {
  assert.deepEqual(strip(p('[counter]')), [B(W('counter'))]);
});

test('empty box', () => {
  assert.deepEqual(strip(p('[]')), [B()]);
});

test('regex literal at top level', () => {
  assert.deepEqual(strip(p('"^\\d+$"')), [R('^\\d+$')]);
});

test('regex inside a pattern slot', () => {
  assert.deepEqual(strip(p('(n:"^\\d+$"){integer}')), [
    F(P(W('n:'), R('^\\d+$')), T(W('integer'))),
  ]);
});

test('comments are transparent to the parser', () => {
  assert.deepEqual(strip(p('{# greet # Hello world}')), [T(W('Hello'), W('world'))]);
});

test('unclosed template throws', () => {
  assert.throws(() => p('{a b'), /Unclosed OPEN_T/);
});

test('unclosed pattern throws', () => {
  assert.throws(() => p('(a b'), /Unclosed OPEN_P/);
});

test('unclosed box throws', () => {
  assert.throws(() => p('[a'), /Unclosed OPEN_B/);
});

test('stray close bracket throws', () => {
  assert.throws(() => p('}'), /Unexpected CLOSE_T/);
  assert.throws(() => p(')'), /Unexpected CLOSE_P/);
  assert.throws(() => p(']'), /Unexpected CLOSE_B/);
});

test('mismatched brackets throws', () => {
  assert.throws(() => p('{a)'), /Unexpected CLOSE_P/);
  assert.throws(() => p('(a}'), /Unexpected CLOSE_T/);
});

test('multiple top-level functions', () => {
  const src = '(x:_){x?} (y:_){y?}';
  assert.deepEqual(strip(p(src)), [
    F(P(W('x:_')), T(W('x?'))),
    F(P(W('y:_')), T(W('y?'))),
  ]);
});

test('?? attached to a template parses as a Conditional', () => {
  // Parser-time recognition: `shape??{(p1){t1} (p2){t2}}` becomes a single
  // Conditional node with branches.
  const ast = strip(p('shape??{(circle){c} (rect){r}}'));
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'Conditional');
  assert.equal(ast[0].multi, true);
  assert.equal(ast[0].branches.length, 2);
  assert.deepEqual(ast[0].subject, W('shape?')); // synthetic query
});

test('pipeline word stays intact', () => {
  assert.deepEqual(strip(p('a->b->c!')), [W('a->b->c!')]);
});

test('box write via pipeline: value->[name]!', () => {
  // `0->` is one Word (no whitespace before `[`), then `[name]`, then `!` -- but
  // wait: `0->` is attached to `[`, but our parser just emits each as separate.
  // Tokenizer puts `0->` as one Word, then OPEN_B WORD CLOSE_B for [name], then `!`
  // would attach to ]. But `]!` — `!` after `]`. The `!` becomes a new Word.
  const ast = strip(p('0->[counter]!'));
  assert.deepEqual(ast, [W('0->'), B(W('counter')), W('!')]);
});

test('escape inside Word survives parse', () => {
  const ast = parse(tokenize('What\\?'));
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'Word');
  assert.equal(ast[0].text, 'What?');
  // esc preserved on the node
  assert.equal(ast[0].esc[4], true);
});
