import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  num, text, tmpl, named, bool, NULL, TRUE, FALSE, regex, box,
  isNum, isText, isTmpl, isNamed, isBool, isNull, isRegex, isBox,
  isTruthy, equals, formatValue,
} from '../src/values.js';

test('constructors and predicates', () => {
  assert.ok(isNum(num(42)));
  assert.ok(isText(text('hi')));
  assert.ok(isTmpl(tmpl([])));
  assert.ok(isNamed(named('x', num(1))));
  assert.ok(isBool(TRUE));
  assert.ok(isBool(FALSE));
  assert.ok(isNull(NULL));
  assert.ok(isRegex(regex('^x$')));
  assert.ok(isBox(box(num(0))));
});

test('truthiness: only NULL and FALSE are falsey', () => {
  assert.equal(isTruthy(NULL),        false);
  assert.equal(isTruthy(FALSE),       false);
  assert.equal(isTruthy(TRUE),        true);
  assert.equal(isTruthy(num(0)),      true);
  assert.equal(isTruthy(text('')),    true);
  assert.equal(isTruthy(tmpl([])),    true);
  assert.equal(isTruthy(num(-5)),     true);
});

test('truthiness of NamedThing follows the wrapped value', () => {
  assert.equal(isTruthy(named('x', FALSE)), false);
  assert.equal(isTruthy(named('x', NULL)),  false);
  assert.equal(isTruthy(named('x', TRUE)),  true);
  assert.equal(isTruthy(named('x', num(0))), true);
});

test('equals: scalars', () => {
  assert.ok(equals(num(1), num(1)));
  assert.ok(!equals(num(1), num(2)));
  assert.ok(equals(text('a'), text('a')));
  assert.ok(!equals(text('a'), text('b')));
  assert.ok(equals(TRUE, TRUE));
  assert.ok(!equals(TRUE, FALSE));
  assert.ok(equals(NULL, NULL));
  assert.ok(!equals(NULL, FALSE));
  assert.ok(!equals(num(1), text('1')));
});

test('equals: templates deep-equal', () => {
  assert.ok(equals(tmpl([num(1), num(2)]), tmpl([num(1), num(2)])));
  assert.ok(!equals(tmpl([num(1)]), tmpl([num(1), num(2)])));
  assert.ok(equals(
    tmpl([num(1), tmpl([text('a'), text('b')])]),
    tmpl([num(1), tmpl([text('a'), text('b')])]),
  ));
});

test('equals: NamedThing requires name AND value', () => {
  assert.ok(equals(named('x', num(1)), named('x', num(1))));
  assert.ok(!equals(named('x', num(1)), named('y', num(1))));
  assert.ok(!equals(named('x', num(1)), named('x', num(2))));
  // a named thing is NOT equal to its bare value
  assert.ok(!equals(named('x', num(1)), num(1)));
});

test('equals: regex compares source', () => {
  assert.ok(equals(regex('^a$'), regex('^a$')));
  assert.ok(!equals(regex('^a$'), regex('^b$')));
});

test('equals: functions compare by identity', () => {
  // Functions and boxes are not value-equal; identity-only.
  const b = box(num(0));
  assert.ok(!equals(b, box(num(0))));
});

test('formatValue: scalars', () => {
  assert.equal(formatValue(NULL),       'NULL');
  assert.equal(formatValue(TRUE),       'TRUE');
  assert.equal(formatValue(FALSE),      'FALSE');
  assert.equal(formatValue(num(42)),    '42');
  assert.equal(formatValue(num(-5)),    '-5');
  assert.equal(formatValue(num(0.5)),   '0.5');
  assert.equal(formatValue(num(-0.5)),  '-0.5');
  assert.equal(formatValue(num(3.141)), '3.141');
  assert.equal(formatValue(text('hi')), 'hi');
});

test('formatValue: templates', () => {
  assert.equal(formatValue(tmpl([])), '{}');
  assert.equal(formatValue(tmpl([num(1), num(2), num(3)])), '{1 2 3}');
  assert.equal(formatValue(tmpl([text('a'), tmpl([text('b'), text('c')])])), '{a {b c}}');
});

test('formatValue: named things', () => {
  assert.equal(formatValue(named('age', num(30))), 'age:30');
  assert.equal(formatValue(named('name', text('Tim'))), 'name:Tim');
});

test('formatValue: regex and box', () => {
  assert.equal(formatValue(regex('^\\d+$')), '"^\\d+$"');
  assert.equal(formatValue(box(num(7))), '[7]');
});
