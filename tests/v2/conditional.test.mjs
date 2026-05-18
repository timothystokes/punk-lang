import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { num, text, TRUE, FALSE, NULL } from '../../src/v2/values.js';

const run = (src, env = rootEnv()) => evalProgram(parse(tokenize(src)), env);
const val = (src, env) => run(src, env).value;

// -- predicate: value?(pattern) ---------------------------------------------

test('predicate: match → TRUE', () => {
  assert.equal(val('number:5 number?(5)'), TRUE);
});

test('predicate: miss → FALSE', () => {
  assert.equal(val('number:5 number?(6)'), FALSE);
});

test('predicate on literal subject (5?(5))', () => {
  assert.equal(val('5?(5)'),  TRUE);
  assert.equal(val('5?(6)'),  FALSE);
});

test('predicate with wildcard always matches', () => {
  assert.equal(val('age:30 age?(_)'), TRUE);
});

test('predicate with nested shape on a tmpl subject', () => {
  assert.equal(val('p:{1 2 3} p?(1 2 3)'), TRUE);
  assert.equal(val('p:{1 2 3} p?(1 2 4)'), FALSE);
});

// -- if-then: value?(pattern){template} -------------------------------------

test('if-then: match returns body last-value', () => {
  assert.deepEqual(val('number:5 number?(5){Found}'), text('Found'));
});

test('if-then: miss returns NULL', () => {
  assert.equal(val('number:5 number?(6){nope}'), NULL);
});

test('if-then: matched name bindings reach the body', () => {
  assert.deepEqual(val('p:{1 2 3} p?(a:_ b:_ c:_){b?}'), num(2));
});

test('if-then: subject with trailing dot (age.?)', () => {
  assert.deepEqual(val('age:30 age.?(30){thirty}'), text('thirty'));
});

// -- multi: value??{ (p){t} ... } -------------------------------------------

test('multi: first matching branch wins', () => {
  assert.deepEqual(val('x:5 x??{(5){five} (_){other}}'), text('five'));
});

test('multi: order matters — second branch when first misses', () => {
  assert.deepEqual(val('x:9 x??{(5){five} (_){other}}'), text('other'));
});

test('multi: ___ catch-all matches any shape', () => {
  assert.deepEqual(
    val('p:{a b c} p??{(x){first} (___){rest}}'),
    text('rest')
  );
});

test('multi: no matching branch is a runtime error', () => {
  assert.throws(
    () => val('x:9 x??{(5){five} (7){seven}}'),
    /no matching branch in \?\?/
  );
});

test('multi: pattern bindings reach branch body', () => {
  assert.deepEqual(
    val('p:{1 2 3} p??{(a:_ b:_ c:_){b?}}'),
    num(2)
  );
});

test('multi: TRUE/FALSE-shaped dispatch', () => {
  assert.deepEqual(
    val('flag:TRUE flag??{(TRUE){yes} (FALSE){no}}'),
    text('yes')
  );
  assert.deepEqual(
    val('flag:FALSE flag??{(TRUE){yes} (FALSE){no}}'),
    text('no')
  );
});

// -- subject query forms ----------------------------------------------------

test('subject can be a path (named-thing field)', () => {
  assert.deepEqual(
    val('p:{x:5 y:7} p.y?(7){found-seven}'),
    text('found-seven')
  );
});

test('subject can drill into a list index', () => {
  assert.deepEqual(
    val('xs:{a b c} xs.2?(b){got-b}'),
    text('got-b')
  );
});

// -- attachment rules -------------------------------------------------------

test('detached `?( ... )` (space before paren) is NOT a conditional', () => {
  // `x?` evaluates as a query for x (=5), then `(p)` is a standalone Pattern
  // (Pattern node eval is still NULL in phase 6/7). Whatever the eventual
  // semantics, it must NOT throw a "no matching branch" error or behave
  // like a conditional.
  // Parsing alone shouldn't recognise this as a Conditional.
  const items = parse(tokenize('x:5 x? (5)'));
  // expected: bind, Word(x?), Pattern(5)
  assert.equal(items.length, 3);
  assert.equal(items[1].type, 'Word');
  assert.equal(items[2].type, 'Pattern');
});

test('detached `?? { ... }` is NOT a multi-conditional', () => {
  const items = parse(tokenize('x:5 x?? {(5){a}}'));
  assert.equal(items[1].type, 'Word');
  assert.equal(items[2].type, 'Template');
});

// -- parser-level shape ------------------------------------------------------

test('parser produces Conditional node for `?(p){t}`', () => {
  const items = parse(tokenize('x?(5){a}'));
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'Conditional');
  assert.equal(items[0].multi, false);
  assert.equal(items[0].branches.length, 1);
  assert.ok(items[0].branches[0].body); // if-then
});

test('parser produces Conditional node for predicate `?(p)`', () => {
  const items = parse(tokenize('x?(5)'));
  assert.equal(items[0].type, 'Conditional');
  assert.equal(items[0].branches[0].body, null);
});

test('parser produces multi Conditional node for `??{...}`', () => {
  const items = parse(tokenize('x??{(5){a} (_){b}}'));
  assert.equal(items[0].type, 'Conditional');
  assert.equal(items[0].multi, true);
  assert.equal(items[0].branches.length, 2);
});

test('parser rejects non-Function branch in `??{...}`', () => {
  assert.throws(
    () => parse(tokenize('x??{(5) (_){b}}')),
    /\?\? branch must be/
  );
});

test('parser rejects empty `??{}`', () => {
  assert.throws(
    () => parse(tokenize('x??{}')),
    /at least one branch/
  );
});
