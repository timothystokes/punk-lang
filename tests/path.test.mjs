import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import {
  num, text, NULL, isTmpl, formatValue,
} from '../src/values.js';

const run = (src) => evalProgram(parse(tokenize(src)), rootEnv());
const val = (src) => run(src).value;

// Sample data used in the doc
const PEOPLE = `
  people:{
    a:{name:{John Smith} location:{New York}}
    b:{name:{Jane Green} location:{Sydney}}
  }
`;

test('query by name: people.a?', () => {
  const v = val(PEOPLE + ' people.a?');
  assert.ok(isTmpl(v));
  assert.equal(formatValue(v), '{name:{John Smith} location:{New York}}');
});

test('query by name: people.a.name?', () => {
  const v = val(PEOPLE + ' people.a.name?');
  assert.ok(isTmpl(v));
  assert.equal(formatValue(v), '{John Smith}');
});

test('query by index: people.a.name.1?', () => {
  const v = val(PEOPLE + ' people.a.name.1?');
  assert.deepEqual(v, text('John'));
});

test('query mixes name and index: people.2.location?', () => {
  const v = val(PEOPLE + ' people.2.location?');
  assert.equal(formatValue(v), '{Sydney}');
});

test('text has structure: people.2.location.5? → e', () => {
  const v = val(PEOPLE + ' people.2.location.5?');
  // Sydney → S(1) y(2) d(3) n(4) e(5)
  assert.deepEqual(v, text('e'));
});

test('length: people.#? → 2', () => {
  assert.deepEqual(val(PEOPLE + ' people.#?'), num(2));
});

test('length on text: people.a.name.1.#? → 4 (length of "John")', () => {
  assert.deepEqual(val(PEOPLE + ' people.a.name.1.#?'), num(4));
});

test('range slice: items 2 through 3', () => {
  const src = 'xs:{a b c d e} xs.2~3?';
  const v = val(src);
  assert.equal(formatValue(v), '{b c}');
});

test('range from start: ~M', () => {
  const v = val('xs:{a b c d e} xs.~3?');
  assert.equal(formatValue(v), '{a b c}');
});

test('range to end: N~', () => {
  const v = val('xs:{a b c d e} xs.3~?');
  assert.equal(formatValue(v), '{c d e}');
});

test('last item: ~', () => {
  const v = val('xs:{a b c} xs.~?');
  assert.deepEqual(v, text('c'));
});

test('text range produces a substring', () => {
  const v = val('s:Sydney s.2~4?');
  // Sydney = S(1) y(2) d(3) n(4) e(5) y(6) → chars 2..4 = "ydn"
  assert.deepEqual(v, text('ydn'));
});

test('text last char', () => {
  const v = val('s:Sydney s.~?');
  assert.deepEqual(v, text('y'));
});

test('chained: take slice, then ask its length', () => {
  const v = val('xs:{a b c d e} xs.2~4.#?');
  assert.deepEqual(v, num(3));
});

test('index out of range throws', () => {
  assert.throws(() => val('xs:{a b} xs.5?'), /out of range/);
});

test('unknown name in path throws', () => {
  assert.throws(() => val('xs:{a b} xs.missing?'), /no item named 'missing'/);
});

test('cannot step into a scalar with .name', () => {
  assert.throws(() => val('n:42 n.x?'), /cannot step \.x into num/);
});

test('backward refs inside a template body work (sequential eval)', () => {
  // Items in a template body are evaluated in order. A later item can
  // reference a name bound by an earlier item.
  const v = val('t:{b:42 a:b?} t.a?');
  assert.deepEqual(v, num(42));
});

test('captured env: a template stays sensitive to its definition scope', () => {
  // `outer` is bound first. The template captures that scope.
  // Re-binding `outer` after the template exists doesn't affect the template.
  const v = val(`
    outer:Tim
    msg:{Hello outer?}
    outer:Bob
    msg.2?
  `);
  // The captured env has outer=Tim
  assert.deepEqual(v, text('Tim'));
});
