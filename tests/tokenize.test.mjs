import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';

const types = (toks) => toks.map(t => t.type);
const summary = (toks) => toks.map(t => {
  if (t.type === 'WORD')  return ['WORD', t.text];
  if (t.type === 'REGEX') return ['REGEX', t.pattern];
  return [t.type];
});

test('empty source produces no tokens', () => {
  assert.deepEqual(tokenize(''), []);
});

test('only whitespace produces no tokens', () => {
  assert.deepEqual(tokenize('   \n\t  '), []);
});

test('a single bareword', () => {
  const toks = tokenize('hello');
  assert.deepEqual(summary(toks), [['WORD', 'hello']]);
  assert.equal(toks[0].attached, false, 'first token after BOI is not attached');
  assert.equal(toks[0].line, 1);
  assert.equal(toks[0].col, 1);
});

test('an empty template', () => {
  assert.deepEqual(types(tokenize('{}')), ['OPEN_T', 'CLOSE_T']);
});

test('an empty pattern', () => {
  assert.deepEqual(types(tokenize('()')), ['OPEN_P', 'CLOSE_P']);
});

test('an empty box', () => {
  assert.deepEqual(types(tokenize('[]')), ['OPEN_B', 'CLOSE_B']);
});

test('template with content', () => {
  assert.deepEqual(summary(tokenize('{Hello world}')), [
    ['OPEN_T'], ['WORD', 'Hello'], ['WORD', 'world'], ['CLOSE_T'],
  ]);
});

test('whitespace runs are all one separator', () => {
  assert.deepEqual(summary(tokenize('{Hello   \n\t world}')), [
    ['OPEN_T'], ['WORD', 'Hello'], ['WORD', 'world'], ['CLOSE_T'],
  ]);
});

test('attached colon stays inside a single WORD', () => {
  const toks = tokenize('name:value');
  assert.deepEqual(summary(toks), [['WORD', 'name:value']]);
});

test('attached pattern after name colon', () => {
  const toks = tokenize('welcome:(name:_){Hello name?}');
  assert.deepEqual(types(toks), [
    'WORD', 'OPEN_P', 'WORD', 'CLOSE_P', 'OPEN_T', 'WORD', 'WORD', 'CLOSE_T',
  ]);
  // every subsequent token in this expression is attached to the previous
  assert.equal(toks[0].attached, false);
  for (let k = 1; k < toks.length; k++) {
    if (toks[k].type !== 'WORD' || toks[k].text === 'Hello') {
      // Hello is preceded by `{` — attached
    }
  }
  // Specific attachment checks
  assert.equal(toks[1].attached, true,  '( attached to welcome:');
  assert.equal(toks[2].attached, true,  'name:_ attached to (');
  assert.equal(toks[3].attached, true,  ') attached to name:_');
  assert.equal(toks[4].attached, true,  '{ attached to )');
  assert.equal(toks[5].attached, true,  'Hello attached to {');
  assert.equal(toks[6].attached, false, 'name? has whitespace before it');
  assert.equal(toks[7].attached, true,  '} attached to name?');
});

test('whitespace between pattern close and template open makes them NOT attached', () => {
  const toks = tokenize('(x:_) {hi}');
  assert.equal(toks[3].type, 'OPEN_T');
  assert.equal(toks[3].attached, false);
});

test('comment is stripped (with whitespace boundaries)', () => {
  assert.deepEqual(summary(tokenize('hello # this is a comment # world')), [
    ['WORD', 'hello'], ['WORD', 'world'],
  ]);
});

test('multi-line comment', () => {
  assert.deepEqual(summary(tokenize('a # line1\nline2 # b')), [
    ['WORD', 'a'], ['WORD', 'b'],
  ]);
});

test('# without whitespace boundary is part of a word', () => {
  assert.deepEqual(summary(tokenize('path.#?')), [['WORD', 'path.#?']]);
});

test('comment at start of input', () => {
  assert.deepEqual(summary(tokenize('# greeting # hi')), [['WORD', 'hi']]);
});

test('comment at end of input', () => {
  assert.deepEqual(summary(tokenize('hi # bye #')), [['WORD', 'hi']]);
});

test('comment is allowed flush against an opening bracket', () => {
  assert.deepEqual(summary(tokenize('{# note # body}')), [
    ['OPEN_T'], ['WORD', 'body'], ['CLOSE_T'],
  ]);
});

test('comment is allowed flush against a closing bracket', () => {
  assert.deepEqual(summary(tokenize('{body # note #}')), [
    ['OPEN_T'], ['WORD', 'body'], ['CLOSE_T'],
  ]);
});

test('comment flush against both brackets', () => {
  // `#a#` closes (next char is whitespace), then `x:_`, then `#b#` opens+closes.
  assert.deepEqual(summary(tokenize('(#a# x:_ #b#){body}')), [
    ['OPEN_P'], ['WORD', 'x:_'], ['CLOSE_P'],
    ['OPEN_T'], ['WORD', 'body'], ['CLOSE_T'],
  ]);
});

test('path.#? still works (length query, not a comment)', () => {
  assert.deepEqual(summary(tokenize('xs.#?')), [['WORD', 'xs.#?']]);
});

test('escape collapses \\? to ? with esc flag set', () => {
  const toks = tokenize('What\\?');
  assert.equal(toks.length, 1);
  assert.equal(toks[0].text, 'What?');
  assert.deepEqual(toks[0].esc, [false, false, false, false, true]);
});

test('escape: \\{ inside a word is literal', () => {
  const toks = tokenize('foo\\{bar');
  assert.equal(toks[0].text, 'foo{bar');
  assert.deepEqual(toks[0].esc, [false, false, false, true, false, false, false]);
});

test('escape: \\\\ is a literal backslash', () => {
  const toks = tokenize('a\\\\b');
  assert.equal(toks[0].text, 'a\\b');
  assert.deepEqual(toks[0].esc, [false, true, false]);
});

test('escape: \\s is NOT special — it is a literal "s" with the esc flag set', () => {
  // `\s` was once an escape for space; it isn't any more. A space inside a
  // single thing is not representable — items are space-delimited, full stop.
  // If you need text containing a space, write multiple items (`{Hello World}`)
  // or use a regex literal (`" "`).
  const toks = tokenize('Hello\\sworld');
  assert.equal(toks[0].text, 'HelloSworld'.replace('S','s'));
  assert.equal(toks[0].esc[5], true);
});

test('escape: \\X for an ordinary X yields a literal X (escape is a no-op)', () => {
  const toks = tokenize('\\X');
  assert.equal(toks[0].text, 'X');
  assert.deepEqual(toks[0].esc, [true]);
});

test('regex literal: simple', () => {
  const toks = tokenize('"^\\d+$"');
  assert.equal(toks.length, 1);
  assert.equal(toks[0].type, 'REGEX');
  assert.equal(toks[0].pattern, '^\\d+$');
});

test('regex literal preserves \\" escape', () => {
  const toks = tokenize('"a\\"b"');
  assert.equal(toks[0].type, 'REGEX');
  assert.equal(toks[0].pattern, 'a\\"b');
});

test('regex literal: unterminated throws', () => {
  assert.throws(() => tokenize('"oops'), /Unterminated regex literal/);
});

test('nested templates and patterns', () => {
  const toks = tokenize('{a (b){c} d}');
  assert.deepEqual(types(toks), [
    'OPEN_T', 'WORD', 'OPEN_P', 'WORD', 'CLOSE_P', 'OPEN_T', 'WORD', 'CLOSE_T', 'WORD', 'CLOSE_T',
  ]);
});

test('positions: line and column tracking', () => {
  const toks = tokenize('a\n  b');
  assert.equal(toks[0].text, 'a');
  assert.equal(toks[0].line, 1);
  assert.equal(toks[0].col, 1);
  assert.equal(toks[1].text, 'b');
  assert.equal(toks[1].line, 2);
  assert.equal(toks[1].col, 3);
});

test('numbers tokenize as ordinary words', () => {
  const toks = tokenize('{42 -5 0.5 3.141}');
  assert.deepEqual(summary(toks), [
    ['OPEN_T'], ['WORD', '42'], ['WORD', '-5'], ['WORD', '0.5'], ['WORD', '3.141'], ['CLOSE_T'],
  ]);
});

test('pipeline operator stays inside a word', () => {
  const toks = tokenize('a->b->c!');
  assert.deepEqual(summary(toks), [['WORD', 'a->b->c!']]);
});

test('partial-application apostrophe stays in word', () => {
  const toks = tokenize("+'1");
  assert.deepEqual(summary(toks), [['WORD', "+'1"]]);
});

test('box reference looks like [name]', () => {
  const toks = tokenize('[counter]');
  assert.deepEqual(types(toks), ['OPEN_B', 'WORD', 'CLOSE_B']);
  assert.equal(toks[1].text, 'counter');
  assert.equal(toks[0].attached, false);
  assert.equal(toks[1].attached, true);
  assert.equal(toks[2].attached, true);
});

test('regex inside a pattern slot', () => {
  const toks = tokenize('(n:"^\\d+$"){integer}');
  assert.deepEqual(types(toks), [
    'OPEN_P', 'WORD', 'REGEX', 'CLOSE_P', 'OPEN_T', 'WORD', 'CLOSE_T',
  ]);
  assert.equal(toks[1].text, 'n:');
  assert.equal(toks[2].pattern, '^\\d+$');
  // `n:` and the regex are attached
  assert.equal(toks[2].attached, true);
});

test('the ?? conditional query sits inside the same WORD as its target', () => {
  const toks = tokenize('tim??{(tim){yes}(bob){no}}');
  // `tim??` is a single word; then `{`, then `(tim)` etc.
  assert.equal(toks[0].text, 'tim??');
  assert.equal(toks[1].type, 'OPEN_T');
  assert.equal(toks[1].attached, true);
});

test('symbol-named function: +! is one WORD', () => {
  const toks = tokenize('+!{1 2 3}');
  assert.equal(toks[0].text, '+!');
});
