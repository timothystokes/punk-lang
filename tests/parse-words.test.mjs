// White-box tests for parseWords.
//
// parseWords takes the output of parseTree (a Tmpl whose leaves include
// raw Word nodes) and refines those Words into Named / Query / Exec /
// Partial / Range nodes (or Word with a subkind).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parseTree, parseWords } from '../src/parse.js';

const parse = (src) => parseWords(parseTree(tokenize(src)));
const items = (src) => parse(src).items;

// ---------------------------------------------------------------------------
// Word subkinds

test('plain name word → subkind value', () => {
  const [w] = items('hello');
  assert.equal(w.kind, 'Word');
  assert.equal(w.subkind, 'value');
  assert.equal(w.text, 'hello');
});

test('reserved names → subkind reserved', () => {
  for (const name of ['TRUE', 'FALSE', 'NULL']) {
    const [w] = items(name);
    assert.equal(w.kind, 'Word', name);
    assert.equal(w.subkind, 'reserved', name);
    assert.equal(w.text, name);
  }
});

test('_ → subkind wildcard', () => {
  const [w] = items('_');
  assert.equal(w.subkind, 'wildcard');
});

test('* → subkind variadic', () => {
  const [w] = items('*');
  assert.equal(w.subkind, 'variadic');
});

test('number literal → subkind number', () => {
  const [w] = items('42');
  assert.equal(w.kind, 'Word');
  assert.equal(w.subkind, 'number');
});

test('decimal number → subkind number', () => {
  const [w] = items('3.141');
  assert.equal(w.kind, 'Word');
  assert.equal(w.subkind, 'number');
  assert.equal(w.text, '3.141');
});

test('negative number → subkind number', () => {
  const [w] = items('-7');
  assert.equal(w.subkind, 'number');
});

// ---------------------------------------------------------------------------
// Named

test('name:value — tokeniser splits at `:`, parseWords yields PendingNamed + glued value', () => {
  const its = items('x:5');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Named');
  assert.equal(its[0].name, 'x');
  assert.equal(its[0].value, null);
  assert.equal(its[1].kind, 'Word');
  assert.equal(its[1].subkind, 'number');
  assert.equal(its[1].text, '5');
  assert.equal(its[1].glued, true);
});

test('name:word — PendingNamed + glued Word value', () => {
  const its = items('greeting:hello');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Named');
  assert.equal(its[0].name, 'greeting');
  assert.equal(its[0].value, null);
  assert.equal(its[1].kind, 'Word');
  assert.equal(its[1].text, 'hello');
  assert.equal(its[1].glued, true);
});

test('name: with dangling RHS leaves pending Named (parseOperators absorbs)', () => {
  // After parseWords alone, an empty-RHS Named has value === null.
  // parseOperators will absorb the next glued sibling later.
  const its = items('xs:{1 2 3}');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Named');
  assert.equal(its[0].name, 'xs');
  assert.equal(its[0].value, null);
  assert.equal(its[1].kind, 'Tmpl');
  // The Tmpl remains glued so parseOperators knows it belongs.
  assert.equal(its[1].glued, true);
});

test('dangling name: at EOF still produces pending Named in parseWords', () => {
  // parseOperators will reject this; parseWords just produces the
  // pending Named.
  const [n] = items('xs:');
  assert.equal(n.kind, 'Named');
  assert.equal(n.value, null);
});

test('rebinding reserved name is a syntax error', () => {
  assert.throws(() => parse('TRUE:5'));
});

// ---------------------------------------------------------------------------
// Mid-word `!` / `'` short forms

test("add!5 → Exec(add) + glued Word(5) at parseWords stage", () => {
  // Mid-bang short form is now assembled by parseOperators
  // (passArgsAttach); parseWords only produces the call shell
  // and the glued arg sibling.
  const its = items('add!5');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Exec');
  assert.equal(its[0].head, 'add');
  assert.deepEqual(its[0].segments, []);
  assert.equal(its[0].args, undefined);
  assert.equal(its[1].kind, 'Word');
  assert.equal(its[1].text, '5');
  assert.equal(its[1].subkind, 'number');
  assert.equal(its[1].glued, true);
});

test("node.createServer!handler → Exec(node, [createServer]) + glued Word(handler)", () => {
  const its = items('node.createServer!handler');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Exec');
  assert.equal(its[0].head, 'node');
  assert.deepEqual(its[0].segments, [{ kind: 'name', text: 'createServer' }]);
  assert.equal(its[1].text, 'handler');
  assert.equal(its[1].subkind, 'value');
  assert.equal(its[1].glued, true);
});

test("times'2 → Partial(times) + glued Word(2)", () => {
  const its = items("times'2");
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Partial');
  assert.equal(its[0].head, 'times');
  assert.equal(its[1].text, '2');
  assert.equal(its[1].glued, true);
});

test("+'1 → Partial(+) + glued Word(1)", () => {
  const its = items("+'1");
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Partial');
  assert.equal(its[0].head, '+');
  assert.equal(its[1].text, '1');
  assert.equal(its[1].glued, true);
});

test('mid-! followed by a multi-dot word — RHS is just a glued Word', () => {
  // Under the split-token model `a!1.2.3` is [Exec(a), Word(1.2.3) glued].
  // parseWords no longer rejects the RHS — it's a value-shaped sibling
  // that parseOperators attaches as args. (If `1.2.3` isn't a bound
  // name at eval time, the runtime will complain.)
  const its = items('a!1.2.3');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Exec');
  assert.equal(its[1].kind, 'Word');
  assert.equal(its[1].text, '1.2.3');
  assert.equal(its[1].glued, true);
});

test('chained mid-! → three glued nodes at parseWords stage', () => {
  // a!b!c → [Exec(a), Exec(b) glued, Word(c) glued]
  // The chain assembly into Exec(a, [Exec(b, [c])]) happens in
  // parseOperators (passArgsAttach drills the inner-most slot).
  const its = items('a!b!c');
  assert.equal(its.length, 3);
  assert.equal(its[0].kind, 'Exec'); assert.equal(its[0].head, 'a');
  assert.equal(its[1].kind, 'Exec'); assert.equal(its[1].head, 'b');
  assert.equal(its[1].glued, true);
  assert.equal(its[2].kind, 'Word'); assert.equal(its[2].text, 'c');
  assert.equal(its[2].glued, true);
});

test("x:foo!5 — PendingNamed + glued Exec + glued Word at parseWords stage", () => {
  const its = items('x:foo!5');
  assert.equal(its.length, 3);
  assert.equal(its[0].kind, 'Named');
  assert.equal(its[0].name, 'x');
  assert.equal(its[0].value, null);
  assert.equal(its[1].kind, 'Exec');
  assert.equal(its[1].head, 'foo');
  assert.equal(its[1].glued, true);
  assert.equal(its[2].kind, 'Word');
  assert.equal(its[2].text, '5');
  assert.equal(its[2].glued, true);
});

// ---------------------------------------------------------------------------
// Bare `!`

test('bare ! is a Word with subkind bang', () => {
  // Standalone — parseOperators decides what it means.
  const [w] = items('!');
  assert.equal(w.kind, 'Word');
  assert.equal(w.subkind, 'bang');
});

// ---------------------------------------------------------------------------
// Query / Exec / Partial — simple name heads

test('foo? → Query with name head, no segments', () => {
  const [q] = items('foo?');
  assert.equal(q.kind, 'Query');
  assert.equal(q.head, 'foo');
  assert.deepEqual(q.segments, []);
});

test('foo! → Exec', () => {
  const [e] = items('foo!');
  assert.equal(e.kind, 'Exec');
  assert.equal(e.head, 'foo');
});

test("foo' → Partial", () => {
  const [p] = items("foo'");
  assert.equal(p.kind, 'Partial');
  assert.equal(p.head, 'foo');
});

// ---------------------------------------------------------------------------
// Path segments

test('xs.1? → index segment', () => {
  const [q] = items('xs.1?');
  assert.equal(q.head, 'xs');
  assert.deepEqual(q.segments, [{ kind: 'index', n: 1 }]);
});

test('xs.#? → length segment', () => {
  const [q] = items('xs.#?');
  assert.deepEqual(q.segments, [{ kind: 'length' }]);
});

test('xs.:? → nameOf segment', () => {
  const [q] = items('xs.:?');
  assert.deepEqual(q.segments, [{ kind: 'nameOf' }]);
});

test('xs.()? → pattern segment', () => {
  const [q] = items('xs.()?');
  assert.deepEqual(q.segments, [{ kind: 'pattern' }]);
});

test('xs.fullname? → name segment', () => {
  const [q] = items('xs.fullname?');
  assert.deepEqual(q.segments, [{ kind: 'name', text: 'fullname' }]);
});

test('people.1.fullname? → mixed index + name', () => {
  const [q] = items('people.1.fullname?');
  assert.equal(q.head, 'people');
  assert.deepEqual(q.segments, [
    { kind: 'index', n: 1 },
    { kind: 'name', text: 'fullname' },
  ]);
});

test('xs.2~5? → range segment', () => {
  const [q] = items('xs.2~5?');
  assert.deepEqual(q.segments, [{ kind: 'range', from: 2, to: 5 }]);
});

test('xs.~5? → open-from range', () => {
  const [q] = items('xs.~5?');
  assert.deepEqual(q.segments, [{ kind: 'range', from: null, to: 5 }]);
});

test('xs.5~? → open-to range', () => {
  const [q] = items('xs.5~?');
  assert.deepEqual(q.segments, [{ kind: 'range', from: 5, to: null }]);
});

test('xs.~? → all-range', () => {
  const [q] = items('xs.~?');
  assert.deepEqual(q.segments, [{ kind: 'range', from: null, to: null }]);
});

// ---------------------------------------------------------------------------
// Path syntax errors

test('3.141.1? — number cannot head a path', () => {
  assert.throws(() => parse('3.141.1?'));
});

test('hello.1? parses (validation is parseValidate/eval concern)', () => {
  // parseWords accepts: head is a valid name. The "unbound" check is
  // for later phases.
  const [q] = items('hello.1?');
  assert.equal(q.head, 'hello');
});

test('? with no path is an error', () => {
  assert.throws(() => parse('?'));
});

test('empty path segment is an error', () => {
  assert.throws(() => parse('xs..1?'));
});

test('# in middle of path is an error', () => {
  assert.throws(() => parse('xs.#.1?'));
});

test(': in middle of path is an error', () => {
  assert.throws(() => parse('xs.:.1?'));
});

test('zero index parses fine (NULL at runtime, since indices are 1-based)', () => {
  // The parser used to reject `.0`, but the language treats it the
  // same as any other out-of-range index — NULL at eval time.
  parse('xs.0?');
});

// ---------------------------------------------------------------------------
// Leading-dot paths attach to previous glued sibling

test('{1 2 3}.1? → Query with Tmpl head', () => {
  const [q] = items('{1 2 3}.1?');
  assert.equal(q.kind, 'Query');
  assert.equal(q.head.kind, 'Tmpl');
  assert.deepEqual(q.segments, [{ kind: 'index', n: 1 }]);
});

test('{1 2 3} .1? (with space) is an error', () => {
  assert.throws(() => parse('{1 2 3} .1?'));
});

test('.1? at start of input is an error', () => {
  assert.throws(() => parse('.1?'));
});

// ---------------------------------------------------------------------------
// Standalone range words

test('5~15 → Range node', () => {
  const [r] = items('5~15');
  assert.equal(r.kind, 'Range');
  assert.equal(r.from, 5);
  assert.equal(r.to, 15);
});

test('~5 → Range with null from', () => {
  const [r] = items('~5');
  assert.equal(r.kind, 'Range');
  assert.equal(r.from, null);
  assert.equal(r.to, 5);
});

test('5~ → Range with null to', () => {
  const [r] = items('5~');
  assert.equal(r.kind, 'Range');
  assert.equal(r.from, 5);
  assert.equal(r.to, null);
});

test('~ → Range with null/null', () => {
  const [r] = items('~');
  assert.equal(r.kind, 'Range');
  assert.equal(r.from, null);
  assert.equal(r.to, null);
});

test('range with non-integer bound is an error', () => {
  assert.throws(() => parse('a~b'));
});

// ---------------------------------------------------------------------------
// Recursion into nested structures

test('words inside Tmpl are decoded (PendingNamed + value)', () => {
  const tmpl = items('{x:5 y?}')[0];
  assert.equal(tmpl.kind, 'Tmpl');
  assert.equal(tmpl.items.length, 3);
  assert.equal(tmpl.items[0].kind, 'Named');
  assert.equal(tmpl.items[0].value, null);
  assert.equal(tmpl.items[1].kind, 'Word');
  assert.equal(tmpl.items[1].subkind, 'number');
  assert.equal(tmpl.items[1].glued, true);
  assert.equal(tmpl.items[2].kind, 'Query');
});

test('words inside Pattern are decoded (PendingNamed + wildcard pairs)', () => {
  const pat = items('(x:_ y:_)')[0];
  assert.equal(pat.kind, 'Pattern');
  assert.equal(pat.items.length, 4);
  assert.equal(pat.items[0].kind, 'Named');
  assert.equal(pat.items[0].name, 'x');
  assert.equal(pat.items[0].value, null);
  assert.equal(pat.items[1].kind, 'Word');
  assert.equal(pat.items[1].subkind, 'wildcard');
  assert.equal(pat.items[1].glued, true);
  assert.equal(pat.items[2].kind, 'Named');
  assert.equal(pat.items[2].name, 'y');
  assert.equal(pat.items[3].subkind, 'wildcard');
});

test('words inside Box are decoded', () => {
  const box = items('[counter]')[0];
  assert.equal(box.kind, 'Box');
  assert.equal(box.items[0].kind, 'Word');
  assert.equal(box.items[0].text, 'counter');
});

test('embeds in Text are recursed into', () => {
  const text = items('"hello {who?}"')[0];
  assert.equal(text.kind, 'Text');
  const embed = text.parts.find((p) => 'embed' in p);
  assert.ok(embed);
  assert.equal(embed.embed.kind, 'Tmpl');
  assert.equal(embed.embed.items[0].kind, 'Query');
  assert.equal(embed.embed.items[0].head, 'who');
});

// ---------------------------------------------------------------------------
// glued flag propagation

test('glued on Query inherits from prev sibling', () => {
  // `a {b}.1?` — the Query node replacing `{b}` keeps its `glued: false`
  // (the Tmpl had a space before it).
  const [, q] = items('a {b}.1?');
  assert.equal(q.kind, 'Query');
  assert.equal(q.glued, undefined);
});

test('glued on dot-path attached to glued tmpl', () => {
  // No space before the `{...}` (it's at start, so glued is undefined).
  const [q] = items('{b}.1?');
  assert.equal(q.kind, 'Query');
  // First sibling — no glued flag.
  assert.equal(q.glued, undefined);
});
