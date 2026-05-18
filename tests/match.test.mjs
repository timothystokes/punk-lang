import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { matchPattern } from '../src/match.js';
import { rootEnv, lookup } from '../src/env.js';
import {
  num, text, tmpl, isTmpl, isText, isNum, isNamed, formatValue,
} from '../src/values.js';

// --- helpers --------------------------------------------------------------

// Parse a `(...)` source fragment and return the single Pattern AST node.
function pat(src) {
  const items = parse(tokenize(src));
  if (items.length !== 1 || items[0].type !== 'Pattern') {
    throw new Error(`expected exactly one Pattern, got: ${JSON.stringify(items)}`);
  }
  return items[0];
}

// Parse a `{...}` (or any) value source fragment and evaluate to a Value.
function val(src) {
  return evalProgram(parse(tokenize(src)), rootEnv()).value;
}

// --- shape matching -------------------------------------------------------

test('empty pattern matches empty tmpl', () => {
  const e = matchPattern(pat('()'), val('{}'), rootEnv());
  assert.ok(e);
});

test('empty pattern does NOT match a non-empty tmpl', () => {
  assert.equal(matchPattern(pat('()'), val('{a}'), rootEnv()), null);
});

test('wildcard `(_)` matches any 1-item tmpl', () => {
  assert.ok(matchPattern(pat('(_)'), val('{a}'), rootEnv()));
  assert.ok(matchPattern(pat('(_)'), val('{42}'), rootEnv()));
  assert.equal(matchPattern(pat('(_)'), val('{a b}'), rootEnv()), null);
  assert.equal(matchPattern(pat('(_)'), val('{}'),    rootEnv()), null);
});

test('`(_)` matches a scalar by coercion to a 1-item list', () => {
  assert.ok(matchPattern(pat('(_)'), num(42), rootEnv()));
  assert.ok(matchPattern(pat('(_)'), text('hi'), rootEnv()));
});

test('multi-slot `(_ _)` matches exactly two items', () => {
  assert.ok(matchPattern(pat('(_ _)'), val('{a b}'), rootEnv()));
  assert.equal(matchPattern(pat('(_ _)'), val('{a}'), rootEnv()), null);
  assert.equal(matchPattern(pat('(_ _)'), val('{a b c}'), rootEnv()), null);
});

// --- literal slots --------------------------------------------------------

test('literal text slot: `(John)` only matches `{John}`', () => {
  assert.ok(matchPattern(pat('(John)'),  val('{John}'),  rootEnv()));
  assert.equal(matchPattern(pat('(John)'),  val('{Jane}'),  rootEnv()), null);
});

test('literal number slot', () => {
  assert.ok(matchPattern(pat('(42)'), val('{42}'), rootEnv()));
  assert.equal(matchPattern(pat('(42)'), val('{43}'), rootEnv()), null);
});

test('literal mixed with wildcard', () => {
  assert.ok(matchPattern(pat('(hello _)'),    val('{hello world}'), rootEnv()));
  assert.equal(matchPattern(pat('(hello _)'),    val('{hi world}'),    rootEnv()), null);
  assert.ok(matchPattern(pat('(_ 0)'),         val('{a 0}'),          rootEnv()));
});

test('reserved literals: TRUE / FALSE / NULL', () => {
  assert.ok(matchPattern(pat('(TRUE)'),  val('TRUE'),  rootEnv()));
  assert.ok(matchPattern(pat('(FALSE)'), val('FALSE'), rootEnv()));
  assert.ok(matchPattern(pat('(NULL)'),  val('NULL'),  rootEnv()));
  assert.equal(matchPattern(pat('(TRUE)'), val('FALSE'), rootEnv()), null);
});

// --- variadic ------------------------------------------------------------

test('`(___)` matches any tmpl (including empty)', () => {
  assert.ok(matchPattern(pat('(___)'), val('{}'),    rootEnv()));
  assert.ok(matchPattern(pat('(___)'), val('{a}'),   rootEnv()));
  assert.ok(matchPattern(pat('(___)'), val('{a b c}'), rootEnv()));
});

test('`(_ ___)` requires at least one item', () => {
  assert.equal(matchPattern(pat('(_ ___)'), val('{}'), rootEnv()), null);
  assert.ok(matchPattern(pat('(_ ___)'),    val('{a}'), rootEnv()));
  assert.ok(matchPattern(pat('(_ ___)'),    val('{a b c}'), rootEnv()));
});

test('`(start ___ end)` matches bookended sequences', () => {
  assert.ok(matchPattern(pat('(start ___ end)'),    val('{start end}'),       rootEnv()));
  assert.ok(matchPattern(pat('(start ___ end)'),    val('{start a b end}'),   rootEnv()));
  assert.equal(matchPattern(pat('(start ___ end)'), val('{a b end}'),         rootEnv()), null);
  assert.equal(matchPattern(pat('(start ___ end)'), val('{start a b}'),       rootEnv()), null);
});

test('two `___` in one pattern is an error', () => {
  assert.throws(() => matchPattern(pat('(___ ___)'), val('{a}'), rootEnv()), /only one ___/);
});

// --- named slots: binding -------------------------------------------------

test('`(name:_)` binds the matched item locally', () => {
  const e = matchPattern(pat('(name:_)'), val('{Tim}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'name'), text('Tim'));
});

test('`(name:John)` binds AND requires the literal', () => {
  const e = matchPattern(pat('(name:John)'), val('{John}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'name'), text('John'));
  assert.equal(matchPattern(pat('(name:John)'), val('{Jane}'), rootEnv()), null);
});

test('multiple named slots: `(first:_ last:_)`', () => {
  const e = matchPattern(pat('(first:_ last:_)'), val('{Tim Stokes}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'first'), text('Tim'));
  assert.deepEqual(lookup(e, 'last'),  text('Stokes'));
});

test('variadic with name: `(head:_ tail:___)`', () => {
  const e = matchPattern(pat('(head:_ tail:___)'), val('{a b c}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'head'), text('a'));
  const tail = lookup(e, 'tail');
  assert.ok(isTmpl(tail));
  assert.equal(formatValue(tail), '{b c}');
});

test('variadic captures empty middle: `(first:_ middle:___ last:_)` on 2 items', () => {
  const e = matchPattern(pat('(first:_ middle:___ last:_)'), val('{a b}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'first'), text('a'));
  assert.deepEqual(lookup(e, 'last'),  text('b'));
  const mid = lookup(e, 'middle');
  assert.ok(isTmpl(mid));
  assert.equal(mid.items.length, 0);
});

test('names do not affect matching — only the shape on the right of : does', () => {
  // The doc rule. `(name:John)` matches {John} (the literal John). It does
  // NOT mean "matches a NamedThing called name". Confirm by feeding a
  // NamedThing target — the name on the target is ignored, only the value
  // matters for matching.
  const e = matchPattern(pat('(name:John)'), val('{first:John}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'name'), text('John'));
});

// --- nested patterns ------------------------------------------------------

test('nested pattern: `((_ _) _)` matches {{a b} c}', () => {
  assert.ok(matchPattern(pat('((_ _) _)'),    val('{{a b} c}'), rootEnv()));
  assert.equal(matchPattern(pat('((_ _) _)'), val('{{a} c}'),   rootEnv()), null);
  assert.equal(matchPattern(pat('((_ _) _)'), val('{a c}'),     rootEnv()), null);
});

test('named nested pattern: `(pair:(x:_ y:_))` binds both pair AND x/y', () => {
  const e = matchPattern(pat('(pair:(x:_ y:_))'), val('{{1 2}}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'x'), num(1));
  assert.deepEqual(lookup(e, 'y'), num(2));
  const pair = lookup(e, 'pair');
  assert.ok(isTmpl(pair));
  assert.equal(formatValue(pair), '{1 2}');
});

// --- regex slots ----------------------------------------------------------

test('regex slot matches text by pattern', () => {
  assert.ok(matchPattern(pat('("^\\d+$")'),    val('{42}'),  rootEnv()));
  assert.equal(matchPattern(pat('("^\\d+$")'), val('{abc}'), rootEnv()), null);
});

test('regex against a number works (number serialises to its digits)', () => {
  assert.ok(matchPattern(pat('("^\\d+$")'), num(42), rootEnv()));
});

test('named regex binds the original item when no capture groups', () => {
  const e = matchPattern(pat('(n:"^\\d+$")'), val('{42}'), rootEnv());
  assert.ok(e);
  const n = lookup(e, 'n');
  // Could be text("42") or num(42) depending on how 42 was tokenised in the
  // source. Inside {42} it parses as a number literal at evaluation time.
  assert.equal(formatValue(n), '42');
});

test('regex with capture groups binds tmpl {full g1 g2 ...}', () => {
  const e = matchPattern(pat('(p:"^(\\w+)-(\\w+)$")'), val('{red-blue}'), rootEnv());
  assert.ok(e);
  const p = lookup(e, 'p');
  assert.ok(isTmpl(p));
  // items: full match, group 1, group 2 — all text.
  assert.equal(p.items.length, 3);
  assert.deepEqual(p.items[0], text('red-blue'));
  assert.deepEqual(p.items[1], text('red'));
  assert.deepEqual(p.items[2], text('blue'));
});

test('regex named groups are reachable by name on the binding', () => {
  const e = matchPattern(
    pat('(d:"^(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})$")'),
    val('{2025-11-08}'),
    rootEnv(),
  );
  assert.ok(e);
  const d = lookup(e, 'd');
  assert.ok(isTmpl(d));
  // positional items: full + 3 groups
  assert.equal(d.items[0].value, '2025-11-08');
  // named groups appended as NamedThings
  const byName = d.items.filter(isNamed);
  const get = (n) => byName.find(x => x.name === n).value.value;
  assert.equal(get('y'), '2025');
  assert.equal(get('m'), '11');
  assert.equal(get('d'), '08');
});

// --- name does NOT impact matching ---------------------------------------

test('NamedThings on the target are unwrapped for matching', () => {
  // `(_)` against {x:42} should match — the matcher sees only the value.
  const e = matchPattern(pat('(_)'), val('{x:42}'), rootEnv());
  assert.ok(e);
});

test('but a binding on a wildcard gets the unwrapped value', () => {
  const e = matchPattern(pat('(v:_)'), val('{x:42}'), rootEnv());
  assert.ok(e);
  assert.deepEqual(lookup(e, 'v'), num(42));
});
