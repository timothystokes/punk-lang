// Templates containing queries and code — the `?` vs `!` distinction.
//
// From doc § "Templates can contain queries", "Templates can contain code",
// "When things actually run":
//   - `?` resolves ONLY the single path it's attached to; does not cascade.
//   - `!` evaluates the WHOLE template: every embedded query is resolved,
//     every function reached is run, substitutions cascade.
//   - A template just sitting in source — or held in a name — does no work.
//   - `\?` escapes a `?` inside a template so it isn't interpreted as a query.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('unstructured template with embedded query — not executed, kept as-is', () => {
  assert.equal(
    punk('name:{Bob}  "Hello {name?}"'),
    '"Hello {name?}"'
  );
});

test('unstructured template with embedded query — executed with `!`', () => {
  assert.equal(
    punk('name:{Bob}  "Hello {name?}"!'),
    '"Hello Bob"'
  );
});

test('querying a name returns the bound value but does not run nested queries', () => {
  // greeting?  resolves only `greeting`; the inner {name?} is left alone.
  assert.equal(
    punk('greeting:"Hello {name?}"  name:Bob  greeting?'),
    '"Hello {name?}"'
  );
});

test('executing a name with `!` cascades — every reachable query/function runs', () => {
  assert.equal(
    punk('greeting:"Hello {name?}"  name:Bob  greeting!'),
    '"Hello Bob"'
  );
});

test('function inside a template is inert until the template is executed', () => {
  // `shout` is just sitting in source; without `!` on the enclosing template
  // nothing runs.
  assert.equal(
    punk('shout:(s:_){upper!{s?}}  "I said {shout!hi}"'),
    '"I said {shout!hi}"'
  );
});

test('function inside an unstructured template runs when the template is executed', () => {
  assert.equal(
    punk('shout:(s:_){upper!{s?}}  "I said {shout!hi}"!'),
    '"I said HI"'
  );
});

test('escaped `?` is a literal question mark, not a query', () => {
  assert.equal(
    punk('"What is your name\\?"!'),
    '"What is your name?"'
  );
});

test('a `.` in plain text is literal — only path rules in `?`/`!` tokens', () => {
  // Inside an unstructured template, dots are just characters.
  assert.equal(
    punk('"a.b.c"'),
    '"a.b.c"'
  );
});

test('querying without `?` returns the bare path as a Word/template, not its value', () => {
  // `people.1.fullname` without trailing `?` is just text.
  assert.equal(
    punk('people.1.fullname'),
    '{people.1.fullname}'
  );
});

test('a query in a structured template is also inert until the surrounding template runs', () => {
  // Structured template containing a query — the query is not resolved
  // just because we display the template.
  assert.equal(
    punk('name:Bob  {hi name?}'),
    '{hi name?}'
  );
});

test('executing a structured template resolves embedded queries', () => {
  assert.equal(
    punk('name:Bob  {hi name?}!'),
    '{hi Bob}'
  );
});
