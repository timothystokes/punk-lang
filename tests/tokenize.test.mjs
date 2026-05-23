// White-box tests for the tokenizer.
//
// These tests import tokenize directly and assert on the shape of
// the emitted token list. They exist to catch regressions inside the
// tokenize phase before the rest of the pipeline is wired up.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tokenize, TOKEN_TYPES as T } from '../src/tokenize.js';
import { PunkSyntaxError } from '../src/errors.js';

// Helper: assert the (type, text) pairs of a token list, ignoring EOF.
function shape(src) {
  const toks = tokenize(src);
  // Sanity: last token is always EOF.
  assert.equal(toks.at(-1).type, T.EOF, 'last token should be EOF');
  return toks.slice(0, -1).map(t => [t.type, t.text]);
}

test('empty source -> just EOF', () => {
  const toks = tokenize('');
  assert.equal(toks.length, 1);
  assert.equal(toks[0].type, T.EOF);
});

test('single word', () => {
  assert.deepEqual(shape('hello'), [[T.WORD, 'hello']]);
});

test('numbers tokenize as words', () => {
  assert.deepEqual(shape('42'), [[T.WORD, '42']]);
  // Unescaped `.` is its own WORD token; re-glued by parseTree.
  assert.deepEqual(shape('3.141'),
    [[T.WORD, '3'], [T.WORD, '.'], [T.WORD, '141']]);
  assert.deepEqual(shape('-5'), [[T.WORD, '-5']]);
});

test('symbol-named words', () => {
  // `+`, `<>`, `<=` are valid Punk word characters
  assert.deepEqual(shape('+'), [[T.WORD, '+']]);
  assert.deepEqual(shape('<>'), [[T.WORD, '<>']]);
  assert.deepEqual(shape('+!'), [[T.WORD, '+'], [T.WORD, '!']]);
});

test('leading/trailing whitespace produces SPACE tokens', () => {
  assert.deepEqual(shape('  hi  '),
    [[T.SPACE, '  '], [T.WORD, 'hi'], [T.SPACE, '  ']]);
});

test('whitespace collapses into a single SPACE token', () => {
  assert.deepEqual(shape('a   b'),
    [[T.WORD, 'a'], [T.SPACE, '   '], [T.WORD, 'b']]);
});

test('newlines are whitespace', () => {
  assert.deepEqual(shape('a\nb'),
    [[T.WORD, 'a'], [T.SPACE, '\n'], [T.WORD, 'b']]);
});

test('mixed whitespace stays in one SPACE token', () => {
  assert.deepEqual(shape('a \t\n b'),
    [[T.WORD, 'a'], [T.SPACE, ' \t\n '], [T.WORD, 'b']]);
});

test('braces and items', () => {
  assert.deepEqual(shape('{a b}'), [
    [T.LBRACE, '{'],
    [T.WORD, 'a'],
    [T.SPACE, ' '],
    [T.WORD, 'b'],
    [T.RBRACE, '}'],
  ]);
});

test('nested braces', () => {
  assert.deepEqual(shape('{{a}}'), [
    [T.LBRACE, '{'], [T.LBRACE, '{'], [T.WORD, 'a'], [T.RBRACE, '}'], [T.RBRACE, '}'],
  ]);
});

test('parens hold patterns', () => {
  assert.deepEqual(shape('([a])'), [
    [T.LPAREN, '('], [T.LBRACK, '['], [T.WORD, 'a'], [T.RBRACK, ']'], [T.RPAREN, ')'],
  ]);
});

test('@-prefix tokenizes as an Atom marker', () => {
  assert.deepEqual(shape('@name'), [
    [T.AT, '@name'],
  ]);
});

test('@ requires a following name character', () => {
  assert.throws(() => tokenize('@'), PunkSyntaxError);
  assert.throws(() => tokenize('@ x'), PunkSyntaxError);
});

test('`[` and `]` are only valid inside a pattern', () => {
  assert.throws(() => tokenize('[name]'), PunkSyntaxError);
});

test('quoted text — simple', () => {
  assert.deepEqual(shape('"hello"'), [
    [T.QUOTE_OPEN, '"'], [T.TEXT, 'hello'], [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quoted text — empty', () => {
  assert.deepEqual(shape('""'), [
    [T.QUOTE_OPEN, '"'], [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quoted text with placeholder', () => {
  // `"Hi {name?}"` -> QUOTE_OPEN, TEXT("Hi "), LBRACE, WORD(name), WORD(?), RBRACE, QUOTE_CLOSE
  assert.deepEqual(shape('"Hi {name?}"'), [
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'Hi '],
    [T.LBRACE, '{'],
    [T.WORD, 'name'], [T.WORD, '?'],
    [T.RBRACE, '}'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quoted text — placeholder at the start', () => {
  assert.deepEqual(shape('"{n?}!"'), [
    [T.QUOTE_OPEN, '"'],
    [T.LBRACE, '{'], [T.WORD, 'n'], [T.WORD, '?'], [T.RBRACE, '}'],
    [T.TEXT, '!'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quoted text — multiple placeholders', () => {
  assert.deepEqual(shape('"{a?} {b?}"'), [
    [T.QUOTE_OPEN, '"'],
    [T.LBRACE, '{'], [T.WORD, 'a'], [T.WORD, '?'], [T.RBRACE, '}'],
    [T.TEXT, ' '],
    [T.LBRACE, '{'], [T.WORD, 'b'], [T.WORD, '?'], [T.RBRACE, '}'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quoted text — escaped quote inside is preserved verbatim', () => {
  // New model: text storage preserves the escape verbatim (only resolves
  // at the word→string boundary), so the TEXT token text retains `\"`.
  assert.deepEqual(shape('"say \\"hi\\""'), [
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'say \\"hi\\"'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('arrow operator', () => {
  assert.deepEqual(shape('a->b'), [
    [T.WORD, 'a'], [T.ARROW, '->'], [T.WORD, 'b'],
  ]);
});

test('escaped minus does not form arrow — escape preserved verbatim', () => {
  // `\-` in storage stays as `\-`; the arrow rule never fires because
  // tokenize sees an escape, not a bare `-`.
  assert.deepEqual(shape('a\\->b'), [
    [T.WORD, 'a\\->b'],
  ]);
});

test('path word splits at every unescaped `.` and trailing `?`', () => {
  // Each `.` is its own WORD token; trailing `?` likewise.
  // parseTree re-glues these into one fat path word.
  assert.deepEqual(shape('people.1.fullname?'), [
    [T.WORD, 'people'], [T.WORD, '.'], [T.WORD, '1'],
    [T.WORD, '.'], [T.WORD, 'fullname'], [T.WORD, '?'],
  ]);
});

test('length-of segment .#? — emitted as a single WORD', () => {
  // `.#?` would otherwise be confused for a comment (`#`) and a
  // standalone `?`; the tokenizer recognises the 3-char form and
  // emits it whole, glued to the preceding head.
  assert.deepEqual(shape('people.#?'), [
    [T.WORD, 'people'], [T.WORD, '.#?'],
  ]);
});

test('exec path with !', () => {
  assert.deepEqual(shape('add!'), [
    [T.WORD, 'add'], [T.WORD, '!'],
  ]);
});

test('partial path with apostrophe', () => {
  assert.deepEqual(shape("add'"), [
    [T.WORD, 'add'], [T.WORD, "'"],
  ]);
});

test('name binding splits at the colon — name: is one word, value is another', () => {
  // `:` immediately after a name-char ends the word (including the `:`),
  // so the parser sees `name:` as a "pending Named" head and `value`
  // as a glued sibling. This makes pipeline precedence work right
  // (e.g. `foo:a->b` binds `foo` to the pipeline `a->b`).
  assert.deepEqual(shape('name:value'), [
    [T.WORD, 'name:'], [T.WORD, 'value'],
  ]);
});

test(':: name: at end of input stays as a single token', () => {
  assert.deepEqual(shape('name:'), [[T.WORD, 'name:']]);
});

test('colon after `.` — `.` is a token, then the `.:?` tail re-glues', () => {
  // `.` always splits; `:` only ends a word when it follows a name
  // char. Here `:` follows `.` (not a name char) so it stays in the
  // following word.
  assert.deepEqual(shape('xs.:?'), [
    [T.WORD, 'xs'], [T.WORD, '.'], [T.WORD, ':'], [T.WORD, '?'],
  ]);
});

test('comment between words — vanishes, leaves whitespace intact', () => {
  // `a # hi # b` — spaces on either side of the comment merge
  assert.deepEqual(shape('a # hi # b'), [
    [T.WORD, 'a'], [T.SPACE, '  '], [T.WORD, 'b'],
  ]);
});

test('comment inside a word — vanishes, word stays one token', () => {
  assert.deepEqual(shape('foo#xxx#bar'), [
    [T.WORD, 'foobar'],
  ]);
});

test('comment with no separator at all', () => {
  assert.deepEqual(shape('#hi#'), []);
});

test('comment with another # inside makes two comments and a word in between', () => {
  // Per user: there is no way to tell inner from outer, so:
  //   `# outer # inner # end #` parses as two comments (`# outer #`
  //   and `# end #`) with the word `inner` between them. The spaces
  //   surrounding the comments remain as real whitespace.
  assert.deepEqual(shape('# outer # inner # end #'), [
    [T.SPACE, ' '],
    [T.WORD, 'inner'],
    [T.SPACE, ' '],
  ]);
});

test('escaped # is preserved verbatim, never opens a comment', () => {
  assert.deepEqual(shape('foo\\#bar'), [[T.WORD, 'foo\\#bar']]);
});

test('comments vanish but unclosed # is an error', () => {
  assert.throws(() => tokenize('a # never ends'), PunkSyntaxError);
});

test('unclosed string is an error', () => {
  assert.throws(() => tokenize('"hi'), PunkSyntaxError);
});

test('trailing backslash is an error', () => {
  assert.throws(() => tokenize('foo\\'), PunkSyntaxError);
});

test('\\n inside text is stored verbatim (resolves only at IO)', () => {
  const toks = tokenize('"a\\nb"');
  assert.equal(toks[1].type, T.TEXT);
  assert.equal(toks[1].text, 'a\\nb');
});

test('\\t inside text is stored verbatim (resolves only at IO)', () => {
  const toks = tokenize('"a\\tb"');
  assert.equal(toks[1].text, 'a\\tb');
});

test('escaped space inside a word is a tokenize error', () => {
  // Punk has no whitespace escape — `\<space>` is illegal.
  assert.throws(() => tokenize('foo\\ bar'), PunkSyntaxError);
});

test('escaped special chars inside a word — preserved verbatim', () => {
  assert.deepEqual(shape('What\\?'), [[T.WORD, 'What\\?']]);
  assert.deepEqual(shape('\\{'), [[T.WORD, '\\{']]);
  assert.deepEqual(shape('\\}'), [[T.WORD, '\\}']]);
});

test('\\X for non-special X is preserved verbatim too', () => {
  // The escape is redundant for `\s` but stays in storage; only the
  // word→string boundary (e.g. join!) strips redundant escapes.
  assert.deepEqual(shape('\\s'), [[T.WORD, '\\s']]);
});

test('positions are 1-based and track newlines', () => {
  const toks = tokenize('a\n  hello');
  // tokens: WORD a (1,1), SPACE \n   (1,2), WORD hello (2,3), EOF
  assert.equal(toks[0].line, 1);
  assert.equal(toks[0].col, 1);
  assert.equal(toks[1].type, T.SPACE);
  assert.equal(toks[1].line, 1);
  assert.equal(toks[1].col, 2);
  assert.equal(toks[2].type, T.WORD);
  assert.equal(toks[2].text, 'hello');
  assert.equal(toks[2].line, 2);
  assert.equal(toks[2].col, 3);
});

test('positions of brace tokens', () => {
  const toks = tokenize('{x}');
  assert.equal(toks[0].col, 1);
  assert.equal(toks[1].col, 2);
  assert.equal(toks[2].col, 3);
});

test('nested struct mode from placeholder works recursively', () => {
  // `"a {b c} d"` — inside the placeholder we're back in STRUCT mode,
  // so the space between b and c is a SPACE token.
  assert.deepEqual(shape('"a {b c} d"'), [
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'a '],
    [T.LBRACE, '{'],
    [T.WORD, 'b'],
    [T.SPACE, ' '],
    [T.WORD, 'c'],
    [T.RBRACE, '}'],
    [T.TEXT, ' d'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('quotes can nest via placeholders', () => {
  // `"{ "inner" }"` — string with a placeholder containing another string.
  assert.deepEqual(shape('"{"inner"}"'), [
    [T.QUOTE_OPEN, '"'],
    [T.LBRACE, '{'],
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'inner'],
    [T.QUOTE_CLOSE, '"'],
    [T.RBRACE, '}'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('# inside a string is literal', () => {
  assert.deepEqual(shape('"a # hidden # b"'), [
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'a # hidden # b'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('a literal # inside a string via escape — preserved verbatim', () => {
  assert.deepEqual(shape('"a \\# b"'), [
    [T.QUOTE_OPEN, '"'],
    [T.TEXT, 'a \\# b'],
    [T.QUOTE_CLOSE, '"'],
  ]);
});

test('multi-word pipeline', () => {
  assert.deepEqual(shape('x->upper!->print!'), [
    [T.WORD, 'x'],
    [T.ARROW, '->'],
    [T.WORD, 'upper'], [T.WORD, '!'],
    [T.ARROW, '->'],
    [T.WORD, 'print'], [T.WORD, '!'],
  ]);
});

test('a comment inside a path word is excised, word continues', () => {
  // The `#bar#` is a comment (the `#` is not part of a `.#?` form).
  // After excision the source reads `foo..1?`; the dots and `?`
  // each emit as their own WORD tokens.
  assert.deepEqual(shape('foo.#bar#.1?'), [
    [T.WORD, 'foo'], [T.WORD, '.'], [T.WORD, '.'],
    [T.WORD, '1'], [T.WORD, '?'],
  ]);
});
