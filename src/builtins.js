// Phase 11 built-ins: arithmetic, comparison, boolean logic.
//
// Builtins are plain functions registered into the root env. They accept the
// raw call argument (a single Value, or a tmpl of Values) and a callNode for
// error reporting, and return a Value.
//
// Calling convention:
//   - `f!{a b c}` → builtin receives a tmpl with [a b c]
//   - `f!x`       → builtin receives x directly (one-item shorthand)
// The helper `args(arg)` normalises both shapes to a JS array of forced
// Values, unwrapping NamedThings (per the doc rule "value is unwrapped if
// it's a NamedThing").
//
// Each builtin carries an explicit `arity`:
//   - non-negative integer N → expects exactly N arguments
//   - -1 → variadic
// `arity` is used by partial application (in eval.js) to know how many slots
// remain after each `'`-fill, and by `consumeCall` to decide whether a
// trailing `!` consumes the next sequence item or makes a zero-arg call.

import {
  num, text, bool, tmpl, named, builtin, jsobj,
  isNum, isTmpl, isNamed, isBool, isText, isNull, isFn, isJsobj,
  NULL, TRUE, FALSE, equals, formatValue,
} from './values.js';
import * as fs from 'node:fs';
import { forceTmplItems, applyFn, evalProgram, evalItem, evalSequence, splitEmbeddedBind } from './eval.js';
import { tokenize } from './tokenize.js';
import { parse } from './parse.js';
import { rootEnv } from './env.js';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const _bool = (v) => v ? TRUE : FALSE;

// Normalise a builtin's incoming arg to a flat JS array of forced Values,
// unwrapping NamedThing items (the value is what arithmetic/etc cares about).
function args(arg) {
  let items;
  if (isTmpl(arg)) items = forceTmplItems(arg);
  else items = [arg];
  return items.map(unwrapNamed);
}

function unwrapNamed(v) {
  return isNamed(v) ? v.value : v;
}

function expectNum(v, name, callNode) {
  if (!isNum(v)) {
    throw locErr(callNode, `${name}: expected number, got ${v.kind} (${formatValue(v)})`);
  }
  return v.value;
}

function expectBool(v, name, callNode) {
  if (!isBool(v)) {
    throw locErr(callNode, `${name}: expected boolean, got ${v.kind} (${formatValue(v)})`);
  }
  return v.value;
}

function locErr(node, msg) {
  const loc = node && node.line ? ` at ${node.line}:${node.col}` : '';
  return new Error(`${msg}${loc}`);
}

function checkArity(name, args, expected, callNode) {
  if (args.length !== expected) {
    throw locErr(callNode, `${name}: expected ${expected} argument${expected===1?'':'s'}, got ${args.length}`);
  }
}

function checkMin(name, args, min, callNode) {
  if (args.length < min) {
    throw locErr(callNode, `${name}: expected at least ${min} argument${min===1?'':'s'}, got ${args.length}`);
  }
}

// -- arithmetic -------------------------------------------------------------

const addFn = builtin('+', (arg, callNode) => {
  const xs = args(arg);
  checkMin('+', xs, 1, callNode);
  let acc = 0;
  for (const v of xs) acc += expectNum(v, '+', callNode);
  return num(acc);
}, -1);

const mulFn = builtin('*', (arg, callNode) => {
  const xs = args(arg);
  checkMin('*', xs, 1, callNode);
  let acc = 1;
  for (const v of xs) acc *= expectNum(v, '*', callNode);
  return num(acc);
}, -1);

const subFn = builtin('-', (arg, callNode) => {
  const xs = args(arg);
  checkArity('-', xs, 2, callNode);
  return num(expectNum(xs[0], '-', callNode) - expectNum(xs[1], '-', callNode));
}, 2);

const divFn = builtin('/', (arg, callNode) => {
  const xs = args(arg);
  checkArity('/', xs, 2, callNode);
  const b = expectNum(xs[1], '/', callNode);
  if (b === 0) throw locErr(callNode, `/: division by zero`);
  return num(expectNum(xs[0], '/', callNode) / b);
}, 2);

const powFn = builtin('^', (arg, callNode) => {
  const xs = args(arg);
  checkArity('^', xs, 2, callNode);
  return num(Math.pow(expectNum(xs[0], '^', callNode), expectNum(xs[1], '^', callNode)));
}, 2);

const modFn = builtin('%', (arg, callNode) => {
  const xs = args(arg);
  checkArity('%', xs, 2, callNode);
  const b = expectNum(xs[1], '%', callNode);
  if (b === 0) throw locErr(callNode, `%: division by zero`);
  return num(expectNum(xs[0], '%', callNode) % b);
}, 2);

const minFn = builtin('min', (arg, callNode) => {
  const xs = args(arg);
  checkMin('min', xs, 1, callNode);
  let m = expectNum(xs[0], 'min', callNode);
  for (let i = 1; i < xs.length; i++) {
    const v = expectNum(xs[i], 'min', callNode);
    if (v < m) m = v;
  }
  return num(m);
}, -1);

const maxFn = builtin('max', (arg, callNode) => {
  const xs = args(arg);
  checkMin('max', xs, 1, callNode);
  let m = expectNum(xs[0], 'max', callNode);
  for (let i = 1; i < xs.length; i++) {
    const v = expectNum(xs[i], 'max', callNode);
    if (v > m) m = v;
  }
  return num(m);
}, -1);

const unary = (name, op, arity = 1) => builtin(name, (arg, callNode) => {
  const xs = args(arg);
  checkArity(name, xs, 1, callNode);
  return num(op(expectNum(xs[0], name, callNode)));
}, arity);

const absFn   = unary('abs',   Math.abs);
const negFn   = unary('neg',   (n) => -n);
const floorFn = unary('floor', Math.floor);
const ceilFn  = unary('ceil',  Math.ceil);
const roundFn = unary('round', Math.round);
const sqrtFn  = unary('sqrt',  Math.sqrt);

// -- comparison -------------------------------------------------------------

const eqFn = builtin('=', (arg, callNode) => {
  const xs = args(arg);
  checkArity('=', xs, 2, callNode);
  return _bool(equals(xs[0], xs[1]));
}, 2);

const neqFn = builtin('<>', (arg, callNode) => {
  const xs = args(arg);
  checkArity('<>', xs, 2, callNode);
  return _bool(!equals(xs[0], xs[1]));
}, 2);

const cmp = (name, op) => builtin(name, (arg, callNode) => {
  const xs = args(arg);
  checkArity(name, xs, 2, callNode);
  return _bool(op(expectNum(xs[0], name, callNode), expectNum(xs[1], name, callNode)));
}, 2);

const ltFn  = cmp('<',  (a, b) => a <  b);
const gtFn  = cmp('>',  (a, b) => a >  b);
const lteFn = cmp('<=', (a, b) => a <= b);
const gteFn = cmp('>=', (a, b) => a >= b);

// -- boolean logic ----------------------------------------------------------

const andFn = builtin('and', (arg, callNode) => {
  const xs = args(arg);
  checkMin('and', xs, 1, callNode);
  for (const v of xs) if (!expectBool(v, 'and', callNode)) return FALSE;
  return TRUE;
}, -1);

const orFn = builtin('or', (arg, callNode) => {
  const xs = args(arg);
  checkMin('or', xs, 1, callNode);
  for (const v of xs) if (expectBool(v, 'or', callNode)) return TRUE;
  return FALSE;
}, -1);

const notFn = builtin('not', (arg, callNode) => {
  const xs = args(arg);
  checkArity('not', xs, 1, callNode);
  return _bool(!expectBool(xs[0], 'not', callNode));
}, 1);

const xorFn = builtin('xor', (arg, callNode) => {
  const xs = args(arg);
  checkArity('xor', xs, 2, callNode);
  const a = expectBool(xs[0], 'xor', callNode);
  const b = expectBool(xs[1], 'xor', callNode);
  return _bool(a !== b);
}, 2);

// -- type checks (docs §Type Checks) ----------------------------------------

const typeCheck = (name, pred) => builtin(name, (arg) => {
  const v = unwrapNamed(arg);
  return _bool(pred(v));
}, 1);

const isnumFn  = typeCheck('isnum',  (v) => isNum(v));
const istextFn = typeCheck('istext', (v) => isText(v));
// "template with more than one item, or zero items" — i.e. not a singleton.
const islistFn = typeCheck('islist', (v) => isTmpl(v) && forceTmplItems(v).length !== 1);
const isfnFn   = typeCheck('isfn',   (v) => isFn(v));
const isemptyFn = typeCheck('isempty', (v) => {
  if (isTmpl(v)) return forceTmplItems(v).length === 0;
  if (isText(v)) return v.value.length === 0;
  return false;
});

// -- conversion (docs §Conversion) ------------------------------------------

const numFn = builtin('num', (arg, callNode) => {
  const v = unwrapNamed(arg);
  if (isNum(v)) return v;
  if (isText(v)) {
    const s = v.value.trim();
    if (s !== '' && /^-?\d+(\.\d+)?$/.test(s)) return num(Number(s));
    throw locErr(callNode, `num: cannot parse ${formatValue(v)}`);
  }
  throw locErr(callNode, `num: expected number or text (got ${v.kind})`);
}, 1);

const textFnB = builtin('text', (arg) => {
  const v = unwrapNamed(arg);
  return text(formatValue(v));
}, 1);

// -- reflection & data construction (used via lib/reflect.punk) -------------

// name!{name value} → NamedThing. `name` may be text or num (formatValue).
const nameFn = builtin('name', (arg, callNode) => {
  const xs = args(arg);
  checkArity('name', xs, 2, callNode);
  const [n, val] = xs;
  const nameStr = isText(n) ? n.value : formatValue(n);
  return named(nameStr, val);
}, 2);

// Convert a Pattern/Body item AST node to a Punk Value, recognising
// embedded `name:value` Words as NamedThings (which evalItem would otherwise
// flatten to a single text "name:value").
function nodeToValue(node, env) {
  if (node.type === 'Word') {
    const split = splitEmbeddedBind(node);
    if (split) {
      const val = nodeToValue(split.valueNode, env);
      return named(split.name, val);
    }
  }
  return evalItem(node, env).value;
}

// pattern!fn → tmpl of pattern items, each evaluated in fn.env so that
// `lang:en` shows up as a NamedThing("lang", text("en")).
const patternFn = builtin('pattern', (arg, callNode) => {
  const v = unwrapNamed(arg);
  if (!isFn(v) || v.kind !== 'fn' || !v.pattern) {
    throw locErr(callNode, `pattern: expected user function (got ${v.kind})`);
  }
  const items = v.pattern.items.map((node) => nodeToValue(node, v.env));
  return tmpl(items, null);
}, 1);

// template!fn → tmpl of body items, with normal sequence semantics
// applied (bare `name:` Word + next item collapses to a NamedThing). This is
// what HTML walking wants: `h1:(){Hello}` body items come back as
// NamedThing("h1", fn(...)). evalSequence is what evalItem uses for templates.
const templateFn = builtin('template', (arg, callNode) => {
  const v = unwrapNamed(arg);
  if (!isFn(v) || v.kind !== 'fn' || !v.body) {
    throw locErr(callNode, `template: expected user function (got ${v.kind})`);
  }
  const items = evalSequence(v.body.items, v.env).values;
  return tmpl(items, null);
}, 1);

// serialize!val → text via formatLiteral (escapes special chars in text so
// values round-trip through deserialize!). We do NOT unwrap NamedThings here:
// the whole point is round-tripping, so `name:value` should serialize to
// "name:value" not "value".
const serializeFn = builtin('serialize', (arg) => {
  // Force lazy tmpl contents so the printed form reflects resolved values,
  // not source-literal queries.
  if (isTmpl(arg)) {
    const items = forceTmplItems(arg);
    const v = items.length === 1 ? items[0] : { kind: 'tmpl', items, env: arg.env };
    return text(formatLiteral(v));
  }
  return text(formatLiteral(arg));
}, 1);

// Round-trippable formatter: like formatValue but escapes special chars in
// text values so that re-parsing yields the same value structure.
function escapeTextLiteral(s) {
  let out = '';
  for (const ch of s) {
    if (ch === ' ') out += '\\ ';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\\' || ch === '{' || ch === '}' ||
             ch === '(' || ch === ')' || ch === '[' || ch === ']' ||
             ch === ':' || ch === '"') out += '\\' + ch;
    else out += ch;
  }
  return out;
}
function formatLiteral(v) {
  if (!v) return '';
  switch (v.kind) {
    case 'text': return escapeTextLiteral(v.value);
    case 'named': return `${escapeTextLiteral(v.name)}:${formatLiteral(v.value)}`;
    case 'tmpl': {
      // Items may already be forced Values; if any look lazy (AST nodes),
      // fall back to formatValue for that item.
      const out = v.items.map((it) => (it && it.kind) ? formatLiteral(it) : formatValue(it));
      return `{${out.join(' ')}}`;
    }
    default: return formatValue(v);
  }
}

// deserialize!text → run text through tokenize+parse+evalProgram in a fresh
// env. Returns the last value, or NULL for empty input.
const deserializeFn = builtin('deserialize', (arg, callNode) => {
  const v = unwrapNamed(arg);
  if (!isText(v)) throw locErr(callNode, `deserialize: expected text (got ${v.kind})`);
  const src = v.value;
  if (src.trim() === '') return NULL;
  const ast = parse(tokenize(src));
  const e = rootEnv(defaultBindings());
  return evalProgram(ast, e).value;
}, 1);

// -- exports ----------------------------------------------------------------

export function defaultBindings() {
  return {
    '+':  addFn, '*': mulFn, '-': subFn, '/': divFn, '^': powFn, '%': modFn,
    min:  minFn, max: maxFn,
    abs:  absFn, neg: negFn, floor: floorFn, ceil: ceilFn, round: roundFn, sqrt: sqrtFn,
    '=':  eqFn,  '<>': neqFn,
    '<':  ltFn,  '>': gtFn, '<=': lteFn, '>=': gteFn,
    and:  andFn, or: orFn, not: notFn, xor: xorFn,
    map: mapFn, filter: filterFn, reduce: reduceFn, find: findFn,
    each: eachFn, count: countFn,
    sort: sortFn, rev: revFn, unique: uniqueFn, contains: containsFn,
    print: printFn, log: printFn,
    split: splitFn, join: joinFn, upper: upperFn, lower: lowerFn,
    trim: trimFn, replace: replaceFn, chars: charsFn, concat: concatFn,
    read: readFn, write: writeFn, append: appendFn, exists: existsFn,
    import: importFn,
    importJS: importJSFn,
    streamRead: streamReadFn,
    assert: assertFn,
    isnum: isnumFn, istext: istextFn, islist: islistFn,
    isfn: isfnFn, isempty: isemptyFn,
    num: numFn, text: textFnB,
    name: nameFn, pattern: patternFn, template: templateFn,
    serialize: serializeFn, deserialize: deserializeFn,
  };
}

// -- collection helpers -----------------------------------------------------

// Decompose a collection item into (value, index, key). Index is 1-based;
// key is the binding name for a NamedThing item, else NULL.
function itemTriple(rawItem, idx) {
  if (isNamed(rawItem)) return [rawItem.value, num(idx), text(rawItem.name)];
  return [rawItem, num(idx), NULL];
}

// Determine how many args a callback wants. Variadic / unknown → -1.
function cbArity(fnVal) {
  if (!fnVal) return -1;
  if (fnVal.kind === 'fn' && fnVal.pattern && fnVal.pattern.type === 'Pattern') {
    const slots = fnVal.pattern.items;
    for (const s of slots) {
      if (s.type === 'Word' && s.text === '___' && !(s.esc && s.esc.some(e=>e))) return -1;
    }
    return slots.length;
  }
  if (fnVal.kind === 'builtin') {
    // Variadic builtins default to 1-slot in callback position — just the value.
    // Fixed-arity builtins (after partial application) report their remaining arity.
    if (typeof fnVal.arity === 'number') return fnVal.arity < 0 ? 1 : fnVal.arity;
    return 1;
  }
  return -1;
}

// Call a callback with the (value, index, key) triple, trimmed to its arity.
function callCb(fnVal, value, idx, keyVal, callNode) {
  const all = [value, num(idx), keyVal];
  const arity = cbArity(fnVal);
  const take = arity < 0 ? all.length : Math.min(arity, all.length);
  let arg;
  if (take <= 1) {
    arg = value;
  } else {
    arg = tmpl(all.slice(0, take), null);
  }
  return applyFn(fnVal, arg, callNode);
}

// Expect 2 args (fn, collection). Returns { fn, items }.
function fnAndList(arg, name, callNode) {
  const xs = args(arg);
  checkArity(name, xs, 2, callNode);
  const fnVal = xs[0];
  const listVal = xs[1];
  if (!isFn(fnVal)) {
    throw locErr(callNode, `${name}: first argument must be a function (got ${fnVal.kind})`);
  }
  const items = isTmpl(listVal) ? forceTmplItems(listVal) : [listVal];
  return { fn: fnVal, items };
}

// Single-arg collection: the arg itself IS the list (a tmpl), not packed inside
// another tmpl. Used by rev/unique and sort's default form.
function listOnly(arg) {
  if (isTmpl(arg)) return forceTmplItems(arg);
  return [arg];
}

// -- collections ------------------------------------------------------------

const mapFn = builtin('map', (arg, callNode) => {
  const { fn, items } = fnAndList(arg, 'map', callNode);
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const [v, , k] = itemTriple(items[i], i + 1);
    out.push(callCb(fn, v, i + 1, k, callNode));
  }
  return tmpl(out, null);
}, 2);

const filterFn = builtin('filter', (arg, callNode) => {
  const { fn, items } = fnAndList(arg, 'filter', callNode);
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const [v, , k] = itemTriple(items[i], i + 1);
    const keep = callCb(fn, v, i + 1, k, callNode);
    if (!isBool(keep)) {
      throw locErr(callNode, `filter: predicate must return TRUE/FALSE (got ${keep.kind})`);
    }
    if (keep.value) out.push(items[i]);
  }
  return tmpl(out, null);
}, 2);

const reduceFn = builtin('reduce', (arg, callNode) => {
  const xs = args(arg);
  checkArity('reduce', xs, 3, callNode);
  const fnVal = xs[0];
  if (!isFn(fnVal)) {
    throw locErr(callNode, `reduce: first argument must be a function (got ${fnVal.kind})`);
  }
  const seed = xs[1];
  const items = isTmpl(xs[2]) ? forceTmplItems(xs[2]) : [xs[2]];
  let acc = seed;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const v = isNamed(item) ? item.value : item;
    // reducer callback: (acc value index key) — accept 2/3/4 slot patterns.
    const k = isNamed(item) ? text(item.name) : NULL;
    const all = [acc, v, num(i + 1), k];
    const arity = cbArity(fnVal);
    const take = arity < 0 ? all.length : Math.min(Math.max(arity, 2), all.length);
    const callArg = take <= 1 ? v : tmpl(all.slice(0, take), null);
    acc = applyFn(fnVal, callArg, callNode);
  }
  return acc;
}, 3);

const findFn = builtin('find', (arg, callNode) => {
  const { fn, items } = fnAndList(arg, 'find', callNode);
  for (let i = 0; i < items.length; i++) {
    const [v, , k] = itemTriple(items[i], i + 1);
    const hit = callCb(fn, v, i + 1, k, callNode);
    if (isBool(hit) && hit.value) return items[i];
  }
  return NULL;
}, 2);

const eachFn = builtin('each', (arg, callNode) => {
  const { fn, items } = fnAndList(arg, 'each', callNode);
  for (let i = 0; i < items.length; i++) {
    const [v, , k] = itemTriple(items[i], i + 1);
    callCb(fn, v, i + 1, k, callNode);
  }
  return NULL;
}, 2);

const countFn = builtin('count', (arg, callNode) => {
  const { fn, items } = fnAndList(arg, 'count', callNode);
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const [v, , k] = itemTriple(items[i], i + 1);
    const hit = callCb(fn, v, i + 1, k, callNode);
    if (isBool(hit) && hit.value) n++;
  }
  return num(n);
}, 2);

// sort accepts either a list (ascending default) or {fn list}.
const sortFn = builtin('sort', (arg, callNode) => {
  // Comparator form: tmpl whose first item is a fn, second is the list.
  if (isTmpl(arg)) {
    const items = forceTmplItems(arg);
    if (items.length === 2 && isFn(items[0])) {
      const fnVal = items[0];
      const list = isTmpl(items[1]) ? forceTmplItems(items[1]) : [items[1]];
      return tmpl(list.slice().sort((a, b) => {
        const r = applyFn(fnVal, tmpl([a, b], null), callNode);
        if (!isNum(r)) {
          throw locErr(callNode, `sort: comparator must return a number (got ${r.kind})`);
        }
        return r.value;
      }), null);
    }
    // Default form: the tmpl itself is the list.
    return tmpl(items.slice().sort(defaultCompare), null);
  }
  return tmpl([arg], null);
}, -1);

function defaultCompare(a, b) {
  const av = isNamed(a) ? a.value : a;
  const bv = isNamed(b) ? b.value : b;
  if (isNum(av) && isNum(bv)) return av.value - bv.value;
  const as = formatValue(av);
  const bs = formatValue(bv);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

const revFn = builtin('rev', (arg, callNode) => {
  const items = listOnly(arg);
  return tmpl(items.slice().reverse(), null);
}, 1);

const uniqueFn = builtin('unique', (arg, callNode) => {
  const items = listOnly(arg);
  const out = [];
  for (const it of items) {
    const cmp = isNamed(it) ? it.value : it;
    let seen = false;
    for (const o of out) {
      const oc = isNamed(o) ? o.value : o;
      if (equals(cmp, oc)) { seen = true; break; }
    }
    if (!seen) out.push(it);
  }
  return tmpl(out, null);
}, 1);

const containsFn = builtin('contains', (arg, callNode) => {
  const xs = args(arg);
  checkArity('contains', xs, 2, callNode);
  const needle = xs[0];
  const items = isTmpl(xs[1]) ? forceTmplItems(xs[1]) : [xs[1]];
  for (const it of items) {
    const v = isNamed(it) ? it.value : it;
    if (equals(needle, v)) return TRUE;
  }
  return FALSE;
}, 2);

// -- text builtins (Phase 17) ----------------------------------------------

function textVal(v, name, callNode) {
  if (isText(v)) return v.value;
  if (isNum(v))  return formatValue(v);
  throw locErr(callNode, `${name}: expected text (got ${v.kind})`);
}

// split!{sep t} — sep first ("how"), text last ("what"). sep may be a regex.
const splitFn = builtin('split', (arg, callNode) => {
  const xs = args(arg);
  checkArity('split', xs, 2, callNode);
  const [sep, t] = xs;
  const s = textVal(t, 'split', callNode);
  const pieces = sep.kind === 'regex'
    ? s.split(sep.re)
    : s.split(textVal(sep, 'split', callNode));
  return tmpl(pieces.map(text), null);
}, 2);

// join!{sep items} — sep first, list last. Items are stringified via formatValue.
const joinFn = builtin('join', (arg, callNode) => {
  const xs = args(arg);
  checkArity('join', xs, 2, callNode);
  const [sep, list] = xs;
  const sepS = textVal(sep, 'join', callNode);
  const items = isTmpl(list) ? forceTmplItems(list) : [list];
  return text(items.map((it) => {
    const v = isNamed(it) ? it.value : it;
    return isText(v) ? v.value : formatValue(v);
  }).join(sepS));
}, 2);

const upperFn = builtin('upper', (arg, callNode) => {
  const v = isTmpl(arg) && forceTmplItems(arg).length === 1
    ? unwrapNamed(forceTmplItems(arg)[0]) : unwrapNamed(arg);
  return text(textVal(v, 'upper', callNode).toUpperCase());
}, 1);

const lowerFn = builtin('lower', (arg, callNode) => {
  const v = isTmpl(arg) && forceTmplItems(arg).length === 1
    ? unwrapNamed(forceTmplItems(arg)[0]) : unwrapNamed(arg);
  return text(textVal(v, 'lower', callNode).toLowerCase());
}, 1);

const trimFn = builtin('trim', (arg, callNode) => {
  const v = isTmpl(arg) && forceTmplItems(arg).length === 1
    ? unwrapNamed(forceTmplItems(arg)[0]) : unwrapNamed(arg);
  return text(textVal(v, 'trim', callNode).trim());
}, 1);

// replace!{old new t} — old first, new second, text last. `old` may be regex.
const replaceFn = builtin('replace', (arg, callNode) => {
  const xs = args(arg);
  checkArity('replace', xs, 3, callNode);
  const [oldV, newV, tV] = xs;
  const s = textVal(tV, 'replace', callNode);
  const repl = textVal(newV, 'replace', callNode);
  if (oldV.kind === 'regex') {
    // Ensure global replacement.
    const re = oldV.re.flags.includes('g')
      ? oldV.re : new RegExp(oldV.source, oldV.re.flags + 'g');
    return text(s.replace(re, repl));
  }
  return text(s.split(textVal(oldV, 'replace', callNode)).join(repl));
}, 3);

// concat! — splices lists, or concatenates text values, with no separator.
// concat!{xs ys ...} where each is a tmpl → splices into one tmpl.
// concat!{a b c} where all are text → returns the joined text.
const concatFn = builtin('concat', (arg, callNode) => {
  const xs = isTmpl(arg) ? forceTmplItems(arg) : [arg];
  if (xs.length === 0) return text('');
  // Splice tmpls; flatten everything to a single sequence.
  const out = [];
  for (const v of xs) {
    const u = unwrapNamed(v);
    if (isTmpl(u)) {
      for (const it of forceTmplItems(u)) out.push(it);
    } else {
      out.push(v);
    }
  }
  // If everything ended up text-or-num, return joined text (coercing nums).
  if (out.every((v) => { const u = unwrapNamed(v); return isText(u) || isNum(u); })) {
    return text(out.map((v) => {
      const u = unwrapNamed(v);
      return isNum(u) ? String(u.value) : textVal(u, 'concat', callNode);
    }).join(''));
  }
  return tmpl(out, null);
}, -1);

const charsFn = builtin('chars', (arg, callNode) => {
  const v = isTmpl(arg) && forceTmplItems(arg).length === 1
    ? unwrapNamed(forceTmplItems(arg)[0]) : unwrapNamed(arg);
  const s = textVal(v, 'chars', callNode);
  return tmpl([...s].map(text), null);
}, 1);

// -- I/O (Phase 14) ---------------------------------------------------------

// I/O is routed through an `io` object so tests can stub print/file ops.
// Default goes to stdout + the node filesystem.
export const io = {
  print(line) { process.stdout.write(line + '\n'); },
  readFile(path) { return fs.readFileSync(path, 'utf8'); },
  writeFile(path, content) { fs.writeFileSync(path, content, 'utf8'); },
  appendFile(path, content) { fs.appendFileSync(path, content, 'utf8'); },
  exists(path) { return fs.existsSync(path); },
};

export function setIO(overrides) {
  Object.assign(io, overrides);
}

// Render a value for `print`: top-level tmpls drop their braces; everything
// else uses the canonical formatValue.
function printRender(v) {
  if (isTmpl(v)) {
    const items = forceTmplItems(v);
    return items.map(formatValue).join(' ');
  }
  return formatValue(v);
}

const printFn = builtin('print', (arg) => {
  io.print(printRender(arg));
  return NULL;
}, 1);

// -- assert (Phase 16) ------------------------------------------------------

// `assert!{expected actual}` → ok if equals, error otherwise.
// `assert!cond` → ok if cond is TRUE, error otherwise.
const assertFn = builtin('assert', (arg, callNode) => {
  if (isTmpl(arg)) {
    const items = forceTmplItems(arg).map(unwrapNamed);
    if (items.length === 2) {
      const [expected, actual] = items;
      if (!deepEquals(expected, actual)) {
        throw locErr(callNode,
          `assert: expected ${formatValue(expected)}, got ${formatValue(actual)}`);
      }
      return NULL;
    }
    if (items.length === 1) return assertCond(items[0], callNode);
    throw locErr(callNode, `assert: expected 1 or 2 arguments, got ${items.length}`);
  }
  return assertCond(unwrapNamed(arg), callNode);
}, 2);

// Recursively force tmpl items so equality compares fully-evaluated values.
function deepEquals(a, b) {
  if (isTmpl(a) && isTmpl(b)) {
    const xs = forceTmplItems(a);
    const ys = forceTmplItems(b);
    if (xs.length !== ys.length) return false;
    for (let i = 0; i < xs.length; i++) {
      if (!deepEquals(xs[i], ys[i])) return false;
    }
    return true;
  }
  if (isNamed(a) && isNamed(b)) {
    return a.name === b.name && deepEquals(a.value, b.value);
  }
  return equals(a, b);
}

function assertCond(v, callNode) {
  if (v === TRUE) return NULL;
  if (v === FALSE) throw locErr(callNode, `assert: condition is FALSE`);
  throw locErr(callNode,
    `assert: condition must be TRUE/FALSE (got ${formatValue(v)})`);
}

// `path` is a text or a tmpl of one text. Coerce to a JS string.
function pathString(arg, name, callNode) {
  let v = arg;
  if (isTmpl(v)) {
    const items = forceTmplItems(v);
    if (items.length !== 1) {
      throw locErr(callNode, `${name}: path must be a single text value`);
    }
    v = items[0];
  }
  if (isNamed(v)) v = v.value;
  if (!isText(v)) {
    throw locErr(callNode, `${name}: path must be text (got ${v.kind})`);
  }
  return v.value;
}

// Render a value as the bytes to write to disk. A tmpl becomes its items
// joined by newlines (so `read!` round-trips: read returns lines, write
// of that tmpl writes them back). Files always end with a trailing newline
// so subsequent `append!` calls start on a fresh line.
function fileContent(v) {
  if (isTmpl(v)) {
    const items = forceTmplItems(v);
    return items.map(formatValue).join('\n') + (items.length > 0 ? '\n' : '');
  }
  return formatValue(v) + '\n';
}

const readFn = builtin('read', (arg, callNode) => {
  const path = pathString(arg, 'read', callNode);
  const raw = io.readFile(path);
  const lines = raw.length === 0 ? [] : raw.replace(/\n$/, '').split('\n');
  return tmpl(lines.map(l => text(l)), null);
}, 1);

const writeFn = builtin('write', (arg, callNode) => {
  const xs = args(arg);
  checkArity('write', xs, 2, callNode);
  const path = isText(xs[0]) ? xs[0].value
    : (() => { throw locErr(callNode, `write: path must be text (got ${xs[0].kind})`); })();
  io.writeFile(path, fileContent(xs[1]));
  return NULL;
}, 2);

const appendFn = builtin('append', (arg, callNode) => {
  const xs = args(arg);
  checkArity('append', xs, 2, callNode);
  const path = isText(xs[0]) ? xs[0].value
    : (() => { throw locErr(callNode, `append: path must be text (got ${xs[0].kind})`); })();
  io.appendFile(path, fileContent(xs[1]));
  return NULL;
}, 2);

const existsFn = builtin('exists', (arg, callNode) => {
  const path = pathString(arg, 'exists', callNode);
  return io.exists(path) ? TRUE : FALSE;
}, 1);

// -- import! (Phase 15) -----------------------------------------------------

// <repoRoot>/lib is where bundled `punk.*` stdlib modules live.
const STDLIB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib');

// Cache by absolute path so a module loaded twice returns the same value.
const moduleCache = new Map();

function importTextArg(arg, callNode) {
  let v = arg;
  if (isTmpl(v)) {
    const items = forceTmplItems(v);
    if (items.length !== 1) {
      throw locErr(callNode, `import: argument must be a single text value`);
    }
    v = items[0];
  }
  if (isNamed(v)) v = v.value;
  if (!isText(v)) {
    throw locErr(callNode, `import: argument must be text (got ${v.kind})`);
  }
  return v.value;
}

function resolveImport(spec, currentFile, callNode) {
  // Strip a trailing deref dot (`import!./mod.` should match `import!./mod`).
  if (spec.endsWith('.')) spec = spec.slice(0, -1);
  // Relative: `./X` or `../X` — from the importer's directory, or cwd.
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const baseDir = currentFile ? path.dirname(currentFile) : process.cwd();
    return path.resolve(baseDir, spec + '.punk');
  }
  // Stdlib: `punk.X` → <repo>/lib/X.punk
  if (spec.startsWith('punk.')) {
    const parts = spec.slice('punk.'.length).split('.').filter(Boolean);
    if (parts.length === 0) {
      throw locErr(callNode, `import: empty stdlib path 'punk.'`);
    }
    return path.join(STDLIB_DIR, ...parts) + '.punk';
  }
  // Third-party packages: `pkg.X` → resolve `pkg` via node_modules, load `pkg/lib/X.punk`.
  const dot = spec.indexOf('.');
  if (dot > 0) {
    const pkg = spec.slice(0, dot);
    const parts = spec.slice(dot + 1).split('.').filter(Boolean);
    if (parts.length === 0) {
      throw locErr(callNode, `import: empty module path '${spec}'`);
    }
    const baseDir = currentFile ? path.dirname(currentFile) : process.cwd();
    try {
      const req = createRequire(path.join(baseDir, 'noop.js'));
      const pkgJson = req.resolve(`${pkg}/package.json`);
      const pkgDir = path.dirname(pkgJson);
      return path.join(pkgDir, 'lib', ...parts) + '.punk';
    } catch (e) {
      throw locErr(callNode, `import: cannot resolve package '${pkg}': ${e.message}`);
    }
  }
  throw locErr(callNode, `import: cannot resolve module '${spec}' (use './X', '../X', or 'pkg.X')`);
}

const importFn = builtin('import', (arg, callNode) => {
  const spec = importTextArg(arg, callNode);
  const absPath = resolveImport(spec, activeCurrentFile(), callNode);
  if (moduleCache.has(absPath)) return moduleCache.get(absPath);
  let source;
  try { source = io.readFile(absPath); }
  catch (e) { throw locErr(callNode, `import: cannot read '${absPath}': ${e.message}`); }
  const tokens = tokenize(source);
  const ast = parse(tokens);
  const modEnv = rootEnv(defaultBindings());
  modEnv.currentFile = absPath;
  fileStack.push(absPath);
  let value;
  try {
    value = evalProgram(ast, modEnv).value;
  } finally {
    fileStack.pop();
  }
  moduleCache.set(absPath, value);
  return value;
}, 1);

// Stack of currentFile values pushed while evaluating import! calls. We push
// before evalProgram runs the module and pop afterward — simpler than threading
// an extra arg through every builtin.
const fileStack = [];
function activeCurrentFile() {
  return fileStack.length > 0 ? fileStack[fileStack.length - 1] : null;
}

// -- importJS! (Phase 16+) --------------------------------------------------

// Loads a host JS module by Node-style specifier and returns it as a Punk
// `jsobj`. Methods/fields are reached with path queries (`fs.readFileSync!...`).
// Synchronous: uses module.createRequire so eager evaluation works.
import { createRequire } from 'node:module';
const _requireFromCwd = createRequire(path.join(process.cwd(), 'noop.js'));

const importJSFn = builtin('importJS', (arg, callNode) => {
  const spec = importTextArg(arg, callNode);
  try {
    const mod = _requireFromCwd(spec);
    return jsobj(mod);
  } catch (e) {
    throw locErr(callNode, `importJS: cannot load '${spec}': ${e.message}`);
  }
}, 1);

// streamRead!{stream cb}
// Generic Node-stream collector: registers 'data'/'end' listeners on the given
// event-emitter / readable stream and invokes the Punk callback once with the
// full accumulated text on 'end'. Chunks may be Buffers or strings; result is
// utf8 text. Useful for HTTP request bodies, file streams, process stdout, etc.
const streamReadFn = builtin('streamRead', (arg, callNode) => {
  const xs = args(arg);
  checkArity('streamRead', xs, 2, callNode);
  const streamVal = xs[0];
  const cbVal = xs[1];
  if (!isJsobj(streamVal)) {
    throw locErr(callNode, `streamRead: first arg must be a JS stream (got ${streamVal.kind})`);
  }
  if (!isFn(cbVal)) {
    throw locErr(callNode, `streamRead: second arg must be a function (got ${cbVal.kind})`);
  }
  const stream = streamVal.raw;
  const chunks = [];
  stream.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  });
  stream.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    applyFn(cbVal, text(body), callNode);
  });
  return NULL;
}, 2);

