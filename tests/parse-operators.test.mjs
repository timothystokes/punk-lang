// White-box tests for parseOperators.
//
// parseOperators runs after parseWords and merges adjacent siblings:
//   1. Pattern + glued node    → Fn { params, body }
//   2. Fn + glued Range        → set returnRange
//   3. Exec/Partial + glued Tmpl → attach args
//   4. ->-separated chain      → Pipeline
//   5. PendingNamed + glued    → resolve Named.value

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parseTree, parseWords, parseOperators } from '../src/parse.js';

const parse = (src) => parseOperators(parseWords(parseTree(tokenize(src))));
const items = (src) => parse(src).items;

// ---------------------------------------------------------------------------
// Fn formation

test('(){body} → Fn with empty Pattern', () => {
  const [fn] = items('(){hello}');
  assert.equal(fn.kind, 'Fn');
  assert.equal(fn.params.kind, 'Pattern');
  assert.equal(fn.params.items.length, 0);
  assert.equal(fn.body.kind, 'Tmpl');
  assert.equal(fn.body.items.length, 1);
});

test('(x:_){x?} → unary identity fn', () => {
  const [fn] = items('(x:_){x?}');
  assert.equal(fn.kind, 'Fn');
  assert.equal(fn.params.items.length, 1);
  assert.equal(fn.params.items[0].kind, 'Named');
  assert.equal(fn.body.items[0].kind, 'Query');
});

test('braceless body wraps single node in 1-item Tmpl', () => {
  const [fn] = items('(x:_)x?');
  assert.equal(fn.kind, 'Fn');
  assert.equal(fn.body.kind, 'Tmpl');
  assert.equal(fn.body.items.length, 1);
  assert.equal(fn.body.items[0].kind, 'Query');
});

test('Pattern with a space before {body} does NOT form a Fn', () => {
  // glue is required.
  const its = items('(x:_) {x?}');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Pattern');
  assert.equal(its[1].kind, 'Tmpl');
});

// ---------------------------------------------------------------------------
// Return-range on Fn

test("(p){body}~ → Fn with returnRange null/null", () => {
  const [fn] = items('(x:_){x?}~');
  assert.equal(fn.kind, 'Fn');
  assert.deepEqual(fn.returnRange, { from: null, to: null });
});

test("(p){body}~5 → Fn with returnRange 0..5", () => {
  const [fn] = items('(x:_){x?}~5');
  assert.deepEqual(fn.returnRange, { from: null, to: 5 });
});

test("(p){body} ~ (with space) does NOT attach range", () => {
  const its = items('(x:_){x?} ~');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Fn');
  assert.equal(its[0].returnRange, undefined);
  assert.equal(its[1].kind, 'Range');
});

// ---------------------------------------------------------------------------
// Args attachment to Exec / Partial

test('add!{1 2} → Exec with args', () => {
  const [e] = items('add!{1 2}');
  assert.equal(e.kind, 'Exec');
  assert.equal(e.head, 'add');
  assert.equal(e.args.kind, 'Tmpl');
  assert.equal(e.args.items.length, 2);
});

test("times'{2 3} → Partial with args", () => {
  const [p] = items("times'{2 3}");
  assert.equal(p.kind, 'Partial');
  assert.equal(p.args.kind, 'Tmpl');
  assert.equal(p.args.items.length, 2);
});

test('add! {1 2} (with space) does NOT attach args', () => {
  const its = items('add! {1 2}');
  assert.equal(its.length, 2);
  assert.equal(its[0].kind, 'Exec');
  assert.equal(its[0].args, undefined);
  assert.equal(its[1].kind, 'Tmpl');
});

test('embedded args from add!5 short form are preserved', () => {
  const [e] = items('add!5');
  assert.equal(e.kind, 'Exec');
  assert.equal(e.args.items.length, 1);
  assert.equal(e.args.items[0].text, '5');
});

// ---------------------------------------------------------------------------
// PendingNamed absorption

test('xs:{1 2 3} → Named with Tmpl', () => {
  const [n] = items('xs:{1 2 3}');
  assert.equal(n.kind, 'Named');
  assert.equal(n.name, 'xs');
  assert.equal(n.value.kind, 'Tmpl');
});

test('add:(a:_ b:_){body} → Named containing Fn', () => {
  const [n] = items('add:(a:_ b:_){+!{a? b?}}');
  assert.equal(n.kind, 'Named');
  assert.equal(n.name, 'add');
  assert.equal(n.value.kind, 'Fn');
  assert.equal(n.value.params.items.length, 2);
});

test("upperLogger:upper->log → Named containing Pipeline", () => {
  const [n] = items('upperLogger:upper->log');
  assert.equal(n.kind, 'Named');
  assert.equal(n.name, 'upperLogger');
  assert.equal(n.value.kind, 'Pipeline');
  assert.equal(n.value.execute, false);
});

test('xs: 5 (with space) is a syntax error', () => {
  assert.throws(() => parse('xs: 5'));
});

test('dangling xs: at EOF is a syntax error', () => {
  assert.throws(() => parse('xs:'));
});

// ---------------------------------------------------------------------------
// Pipelines

test('a->b → Pipeline with 2 stages, not executed', () => {
  const [p] = items('a->b');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.stages.length, 2);
  assert.equal(p.execute, false);
});

test('Hello->upper->log! → Pipeline, executed (last is Exec)', () => {
  const [p] = items('Hello->upper->log!');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.stages.length, 3);
  assert.equal(p.execute, true);
  assert.equal(p.stages[2].kind, 'Exec');
});

test('0->[counter]! → Pipeline ending in Box, executed via bare !', () => {
  const [p] = items('0->[counter]!');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.stages.length, 2);
  assert.equal(p.stages[1].kind, 'Box');
  assert.equal(p.execute, true);
});

test('[counter]->log! → Pipeline starting from Box, executed', () => {
  const [p] = items('[counter]->log!');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.stages.length, 2);
  assert.equal(p.stages[0].kind, 'Box');
  assert.equal(p.execute, true);
});

test('upper->trim → composed Pipeline, not executed', () => {
  const [p] = items('upper->trim');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.execute, false);
});

test("5->double->log! with partial → Pipeline of 3 stages", () => {
  // double:times'2 then 5->double->log!
  // Just check the second line.
  const [p] = items('5->double->log!');
  assert.equal(p.kind, 'Pipeline');
  assert.equal(p.stages.length, 3);
  assert.equal(p.execute, true);
});

// ---------------------------------------------------------------------------
// Recursion / nested cases

test('Fn body is recursed into (Pattern + Tmpl inside another Tmpl)', () => {
  const tmpl = items('{add:(a:_ b:_){+!{a? b?}}}')[0];
  const named = tmpl.items[0];
  assert.equal(named.kind, 'Named');
  assert.equal(named.value.kind, 'Fn');
});

test('Pipeline inside Text embed', () => {
  const text = items('"result: {x->double->log!}"')[0];
  assert.equal(text.kind, 'Text');
  const embed = text.parts.find((p) => 'embed' in p);
  assert.equal(embed.embed.kind, 'Tmpl');
  assert.equal(embed.embed.items[0].kind, 'Pipeline');
});
