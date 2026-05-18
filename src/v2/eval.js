// Evaluator core: AST -> Value, threading an immutable env.
//
// Phase 4 scope: literals, name-bind, ?-query, lazy templates, regex.
// Phase 5 adds: path queries (.name, .N, .~, .N~M, .~M, .N~, .#).
//
// All functions here are pure: they take node + env, return {value, env}.
// The env is threaded back out because name-binds extend the caller's env.

import {
  num, text, named, regex, tmpl, fn, builtin, jsobj, NULL, TRUE, FALSE,
  isTmpl, isText, isNum, isNamed, isFn, isJsobj, isBool, isNull,
} from './values.js';
import { lookup, extend } from './env.js';
import { matchPattern } from './match.js';

const NUM_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

// Evaluate a SEQUENCE of items, threading env across name-binds, and
// returning the per-item resolved Value list (NamedThing for binds).
// This is the workhorse used by evalProgram AND by template forcing.
export function evalSequence(items, env) {
  let curEnv = env;
  const values = [];
  let i = 0;
  while (i < items.length) {
    const node = items[i];

    // Pass-through: item is already a Value (mixed AST/Value templates).
    if (node && node.kind && !node.type) {
      values.push(node);
      i++;
      continue;
    }

    // Bind form 1: a Word ending in a bare ':' takes the NEXT item as value.
    if (node.type === 'Word' && endsWithBareColon(node)) {
      const name = node.text.slice(0, -1);
      assertName(name, node);
      const valNode = items[i + 1];
      if (!valNode) throw evalErr(node, `dangling name-bind '${node.text}'`);
      const r = consumeValue(items, i + 1, curEnv, name);
      curEnv = extend(curEnv, { [name]: r.value });
      // For function literals we need the closure to see itself in env —
      // patch the binding map after construction.
      if (r.recurseEnv) r.recurseEnv.bindings.set(name, r.value);
      values.push(named(name, r.value));
      i = r.nextI;
      continue;
    }

    // Bind form 2: a Word with an embedded bare ':' splits into name and value.
    const split = splitEmbeddedBind(node);
    if (split) {
      const { name, valueNode } = split;
      assertName(name, node);
      // The split value-side is a single sub-token, but a trailing-`!` or
      // trailing-`'` on it must reach the next sequence item for its
      // argument (e.g. `f:add'{3 7}` → valueNode `add'` + arg `{3 7}`).
      // Splice into a virtual list so consumeValue handles it uniformly.
      const virtual = [valueNode, ...items.slice(i + 1)];
      const r = consumeValue(virtual, 0, curEnv, name);
      curEnv = extend(curEnv, { [name]: r.value });
      if (r.recurseEnv) r.recurseEnv.bindings.set(name, r.value);
      values.push(named(name, r.value));
      i = i + r.nextI;
      continue;
    }

    // Box pipeline form: a multi-item pipeline phrase involving one or more
    // boxes. Triggered when the current item is a Box, or a Word that ends
    // in bare `->` and is followed by a Box. See consumeBoxPipeline.
    if (isBoxPipelineStart(node, items, i)) {
      const r = consumeBoxPipeline(items, i, curEnv);
      values.push(r.value);
      i = r.nextI;
      continue;
    }

    // Pipeline form: a Word containing bare `->` is a pipeline. If the whole
    // word ends in a bare `!`, it executes; otherwise it composes to a fn.
    if (node.type === 'Word' && hasBareArrow(node)) {
      values.push(evalPipelineWord(node, curEnv));
      i++;
      continue;
    }

    // Call form: a Word containing any bare '!' is a function call. The arg
    // is either inline (last segment after the final `!`) or consumed from
    // the next sequence item (when the Word ends in a bare `!`).
    if (node.type === 'Word' && hasBareBang(node)) {
      const r = consumeCall(items, i, curEnv);
      values.push(r.value);
      i = r.nextI;
      continue;
    }

    // Partial form: a Word containing any bare `'` is a partial application.
    // Same shape as call (inline arg / sequence-next via trailing `'`).
    if (node.type === 'Word' && hasBareApos(node)) {
      const r = consumePartial(items, i, curEnv);
      values.push(r.value);
      i = r.nextI;
      continue;
    }

    const r = evalItem(node, curEnv);
    values.push(r.value);
    i++;
  }
  return { values, env: curEnv };
}

// Consume one value starting at items[i]. May span multiple items if items[i]
// is a call. Returns { value, nextI, recurseEnv? }.
//
// `bindName` (optional) enables function-literal recursion: when the value
// being consumed is a Function AST node, we pre-build an env that contains
// the placeholder binding and capture it in the closure; the caller is then
// responsible for setting bindings[name] = closure on the returned env.
function consumeValue(items, i, env, bindName = null) {
  const node = items[i];
  if (isBoxPipelineStart(node, items, i)) {
    const r = consumeBoxPipeline(items, i, env);
    return { value: r.value, nextI: r.nextI };
  }
  if (node && node.type === 'Word' && hasBareArrow(node)) {
    return { value: evalPipelineWord(node, env), nextI: i + 1 };
  }
  if (node && node.type === 'Word' && hasBareBang(node)) {
    const r = consumeCall(items, i, env);
    return { value: r.value, nextI: r.nextI };
  }
  if (node && node.type === 'Word' && hasBareApos(node)) {
    const r = consumePartial(items, i, env);
    return { value: r.value, nextI: r.nextI };
  }
  const r = evalValueNode(node, env, bindName);
  return { value: r.value, nextI: i + 1, recurseEnv: r.recurseEnv };
}

// Evaluate a single AST node as a value, with Function-literal recursion
// support when bindName is supplied. Embedded-bind values (`x:f!5`) get an
// inline-only call path here.
function evalValueNode(node, env, bindName) {
  if (node && node.type === 'Function' && bindName) {
    const recEnv = extend(env, { [bindName]: NULL });
    const f = fn(node.pattern, node.body, recEnv, bindName);
    return { value: f, recurseEnv: recEnv };
  }
  if (node && node.type === 'Word' && hasBareArrow(node)) {
    return { value: evalPipelineWord(node, env) };
  }
  if (node && node.type === 'Word' && hasBareBang(node)) {
    const segs = splitOnBareBang(node);
    const last = segs[segs.length - 1];
    if (last.text.length === 0) {
      // Embedded bind value with trailing `!` → zero-arg call.
      return { value: applyCallChain(segs, tmpl([], env), env, node, /*inline*/false) };
    }
    return { value: applyCallChain(segs, evalItem(last, env).value, env, node, /*inline*/true) };
  }
  if (node && node.type === 'Word' && hasBareApos(node)) {
    const segs = splitOnBareApos(node);
    const last = segs[segs.length - 1];
    if (last.text.length === 0) {
      throw evalErr(node, `embedded bind partial must have an inline argument`);
    }
    return { value: applyPartialChain(segs, evalItem(last, env).value, env, node) };
  }
  return { value: evalItem(node, env).value };
}

// Resolve and apply one call starting at items[i] (a Word containing `!`).
// Returns { value, nextI }.
function consumeCall(items, i, env) {
  const fnNode = items[i];
  const segs = splitOnBareBang(fnNode);
  const last = segs[segs.length - 1];
  let arg, nextI;
  if (last.text.length === 0) {
    // Trailing `!`: argument is the next sequence item, OR — if there's no
    // next item or the function is zero-arity — an implicit empty-template
    // arg (zero-arg call for thunks produced by full partial application).
    const receiverSeg = segs[segs.length - 2];
    const receiver = receiverSeg && receiverSeg.text.length > 0
      ? resolveCallTarget(receiverSeg, env)
      : null;
    if (i + 1 >= items.length || fnArity(receiver) === 0) {
      arg = tmpl([], env);
      nextI = i + 1;
    } else {
      const argInfo = consumeValue(items, i + 1, env);
      arg = argInfo.value;
      nextI = argInfo.nextI;
    }
  } else {
    // inline argument: last segment evaluates as a Word (literal, number,
    // or `?`-query)
    arg = evalItem(last, env).value;
    nextI = i + 1;
  }
  return { value: applyCallChain(segs, arg, env, fnNode, last.text.length > 0), nextI };
}

// Arity of a fn value (slots still to fill), or -1 if variadic/unknown.
function fnArity(fnVal) {
  if (!fnVal) return -1;
  if (fnVal.kind === 'fn' && fnVal.pattern && fnVal.pattern.type === 'Pattern') {
    return fnVal.pattern.items.length;
  }
  if (fnVal.kind === 'builtin') {
    return typeof fnVal.arity === 'number' ? fnVal.arity : -1;
  }
  return -1;
}

// Apply the fn-chain (segments minus the arg position) right-to-left.
// `inlineArg` says the last segment WAS the arg (so don't apply it as a fn).
function applyCallChain(segs, arg, env, srcNode, inlineArg) {
  const fnSegs = segs.slice(0, inlineArg ? segs.length - 1 : segs.length - 1);
  for (let k = fnSegs.length - 1; k >= 0; k--) {
    const fnVal = resolveCallTarget(fnSegs[k], env);
    arg = applyFn(fnVal, arg, fnSegs[k]);
  }
  return arg;
}

function resolveCallTarget(seg, env) {
  if (seg.text.length === 0) throw evalErr(seg, `empty call target`);
  const v = hasBareApos(seg)
    ? evalPartialWord(seg, env)
    : evalQuery(seg.text, seg.esc, env, seg);
  if (isJsobj(v) && typeof v.raw === 'function') return v;
  if (!isFn(v)) {
    throw evalErr(seg, `'${seg.text}' is not a function (got ${v.kind})`);
  }
  return v;
}

export function applyFn(fnVal, arg, callNode) {
  if (fnVal.kind === 'builtin') {
    return fnVal.fn(arg, callNode);
  }
  if (fnVal.kind === 'jsobj' && typeof fnVal.raw === 'function') {
    return callJS(fnVal.raw, arg, callNode);
  }
  // fnVal.kind === 'fn'
  const matched = matchPattern(fnVal.pattern, arg, fnVal.env);
  if (!matched) {
    throw evalErr(callNode, `argument does not match function pattern`);
  }
  const r = evalSequence(fnVal.body.items, matched);
  return r.values.length ? r.values[r.values.length - 1] : NULL;
}

// JS interop: invoke a JS function from Punk. The Punk arg is unpacked into
// positional JS arguments (a tmpl spreads, anything else passes as a single
// argument). The JS return value is projected back into a Punk value.
function callJS(jsFn, arg, callNode) {
  const jsArgs = isTmpl(arg)
    ? forceTmplItems(arg).map((it) => toJS(isNamed(it) ? it.value : it))
    : [toJS(arg)];
  let result;
  try { result = jsFn(...jsArgs); }
  catch (e) {
    throw evalErr(callNode, `js call failed: ${e.message}`);
  }
  return fromJS(result);
}

// --- Punk ↔ JS value bridge -----------------------------------------------

export function toJS(v) {
  if (!v) return v;
  switch (v.kind) {
    case 'null': return null;
    case 'bool': return v.value;
    case 'num':  return v.value;
    case 'text': return v.value;
    case 'named': return { [v.name]: toJS(v.value) };
    case 'tmpl': {
      const items = forceTmplItems(v);
      // All-named → plain object; otherwise → array.
      if (items.length > 0 && items.every(isNamed)) {
        const o = {};
        for (const it of items) o[it.name] = toJS(it.value);
        return o;
      }
      return items.map((it) => toJS(isNamed(it) ? it.value : it));
    }
    case 'jsobj':   return v.raw;
    case 'fn':
    case 'builtin': return (...jsArgs) => {
      // Spread JS args into a Punk tmpl arg (or pass the single value).
      const punkArg = jsArgs.length === 1
        ? fromJS(jsArgs[0])
        : tmpl(jsArgs.map(fromJS), null);
      return toJS(applyFn(v, punkArg, v));
    };
    default: return undefined;
  }
}

export function fromJS(v) {
  if (v === null || v === undefined) return NULL;
  if (typeof v === 'boolean') return v ? TRUE : FALSE;
  if (typeof v === 'number')  return num(v);
  if (typeof v === 'string')  return text(v);
  if (typeof v === 'function') return jsobj(v);
  if (Array.isArray(v)) return jsobj(v); // lazy projection; index/length via stepIndex
  if (typeof v === 'object') return jsobj(v);
  return jsobj(v);
}

export function evalProgram(items, env) {
  const r = evalSequence(items, env);
  return {
    value: r.values.length ? r.values[r.values.length - 1] : NULL,
    env: r.env,
  };
}

export function evalItem(node, env) {
  switch (node.type) {
    case 'Word':     return { value: evalWord(node, env), env };
    case 'Regex':    return { value: regex(node.pattern), env };
    case 'Template': return { value: tmpl(node.items, env), env };
    case 'Pattern':  return { value: tmpl(node.items, env), env };
    case 'Function': return { value: fn(node.pattern, node.body, env), env };
    case 'Box':      return { value: NULL, env }; // phase 12
    case 'Conditional': return { value: evalConditional(node, env), env };
    default: throw new Error(`evalItem: unknown node type ${node.type}`);
  }
}

function evalWord(node, env) {
  const s = node.text;
  if (s === 'TRUE')  return TRUE;
  if (s === 'FALSE') return FALSE;
  if (s === 'NULL')  return NULL;
  if (NUM_RE.test(s)) return num(parseFloat(s));

  // Pipeline word (compose or execute) — handled here in case we're called
  // outside of the sequence path (e.g. inside a forced template item).
  if (hasBareArrow(node)) return evalPipelineWord(node, env);

  // Partial-application word — same rationale: a stand-alone partial value
  // can appear inside a template, as a pipeline stage, or as a call target.
  if (hasBareApos(node)) return evalPartialWord(node, env);

  // Query: trailing un-escaped `?` triggers a (possibly multi-segment) path.
  const last = s.length - 1;
  if (last >= 0 && s[last] === '?' && !node.esc[last]) {
    return evalQuery(s.slice(0, last), node.esc.slice(0, last), env, node);
  }

  return text(s);
}

// -- queries / paths ----------------------------------------------------

function evalQuery(pathStr, pathEsc, env, node) {
  const parts = splitOnBareDot(pathStr, pathEsc);
  if (parts.length === 0 || parts[0].length === 0) {
    throw evalErr(node, `empty query`);
  }
  let cur = resolveHead(parts[0], env, node);
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].length === 0) throw evalErr(node, `empty path segment`);
    cur = stepInto(cur, parts[i], node);
  }
  return cur;
}

function resolveHead(head, env, node) {
  if (head === 'TRUE')  return TRUE;
  if (head === 'FALSE') return FALSE;
  if (head === 'NULL')  return NULL;
  if (NUM_RE.test(head)) return num(parseFloat(head));
  const v = lookup(env, head);
  if (v === undefined) throw evalErr(node, `undefined name: ${head}`);
  return v;
}

function splitOnBareDot(s, esc) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '.' && !esc[i]) {
      parts.push(cur);
      cur = '';
    } else {
      cur += s[i];
    }
  }
  parts.push(cur);
  return parts;
}

function stepInto(value, seg, node) {
  // Queries see CONTENT, not the tmpl wrapper. A NamedThing or single-item
  // tmpl is transparent at the start of each step — so `location:{Sydney}`
  // lets `location.5?` walk into the 5th char of "Sydney".
  value = unwrapForQuery(value);
  if (seg === '#') return stepCount(value, node);
  if (seg === '~') return stepLast(value, node);
  const rangeM = /^(\d*)~(\d*)$/.exec(seg);
  if (rangeM && (rangeM[1] || rangeM[2])) {
    const from = rangeM[1] ? parseInt(rangeM[1], 10) : null;
    const to   = rangeM[2] ? parseInt(rangeM[2], 10) : null;
    return stepRange(value, from, to, node);
  }
  if (/^\d+$/.test(seg)) return stepIndex(value, parseInt(seg, 10), node);
  return stepName(value, seg, node);
}

// Collapse wrappers: NamedThing → its value; single-item tmpl → its sole
// item — UNLESS that sole item is a NamedThing (in which case the tmpl is
// a one-field namespace, and stepName needs to see the name).
function unwrapForQuery(v) {
  let cur = v;
  while (true) {
    if (isNamed(cur)) { cur = cur.value; continue; }
    if (isTmpl(cur)) {
      const items = forceTmplItems(cur);
      if (items.length === 1 && !isNamed(items[0])) {
        cur = items[0];
        continue;
      }
    }
    return cur;
  }
}

function stepName(value, name, node) {
  if (isTmpl(value)) {
    for (const it of forceTmplItems(value)) {
      if (isNamed(it) && it.name === name) return it.value;
    }
    throw evalErr(node, `no item named '${name}'`);
  }
  if (isJsobj(value)) {
    const raw = value.raw;
    if (raw == null) throw evalErr(node, `cannot step .${name} into js ${raw}`);
    const prop = raw[name];
    if (prop === undefined) throw evalErr(node, `no js property '${name}'`);
    // Bind methods so `obj.method!arg` keeps `this`.
    if (typeof prop === 'function') return jsobj(prop.bind(raw));
    return fromJS(prop);
  }
  throw evalErr(node, `cannot step .${name} into ${value.kind}`);
}

function stepIndex(value, n, node) {
  if (isTmpl(value)) {
    const items = forceTmplItems(value);
    if (n < 1 || n > items.length) {
      throw evalErr(node, `index ${n} out of range (1..${items.length})`);
    }
    return unwrapNamed(items[n - 1]);
  }
  if (isText(value)) {
    if (n < 1 || n > value.value.length) {
      throw evalErr(node, `char index ${n} out of range (1..${value.value.length})`);
    }
    return text(value.value[n - 1]);
  }
  if (isJsobj(value) && Array.isArray(value.raw)) {
    const arr = value.raw;
    if (n < 1 || n > arr.length) {
      throw evalErr(node, `index ${n} out of range (1..${arr.length})`);
    }
    return fromJS(arr[n - 1]);
  }
  throw evalErr(node, `cannot index into ${value.kind}`);
}

function stepLast(value, node) {
  if (isTmpl(value)) {
    const items = forceTmplItems(value);
    if (items.length === 0) throw evalErr(node, `no last item in empty template`);
    return unwrapNamed(items[items.length - 1]);
  }
  if (isText(value)) {
    if (value.value.length === 0) throw evalErr(node, `no last char in empty text`);
    return text(value.value[value.value.length - 1]);
  }
  throw evalErr(node, `cannot get last of ${value.kind}`);
}

// `.N` and `.~` automatically unwrap a NamedThing — you usually want the
// value, not the wrapper. `.name` already does this (it looks for a named
// item and returns its value). Range slices keep names so the result still
// looks like a record.
function unwrapNamed(v) {
  return isNamed(v) ? v.value : v;
}

function stepCount(value, node) {
  if (isTmpl(value)) return num(forceTmplItems(value).length);
  if (isText(value)) return num(value.value.length);
  throw evalErr(node, `cannot count ${value.kind}`);
}

function stepRange(value, from, to, node) {
  if (isTmpl(value)) {
    const items = forceTmplItems(value);
    const lo = (from == null ? 1 : from);
    const hi = (to   == null ? items.length : to);
    if (lo < 1 || hi > items.length || lo > hi + 1) {
      throw evalErr(node, `range ${from ?? ''}~${to ?? ''} out of range (1..${items.length})`);
    }
    // Resulting tmpl carries Values directly (already forced).
    return tmpl(items.slice(lo - 1, hi), value.env);
  }
  if (isText(value)) {
    const len = value.value.length;
    const lo = (from == null ? 1 : from);
    const hi = (to   == null ? len : to);
    if (lo < 1 || hi > len || lo > hi + 1) {
      throw evalErr(node, `range ${from ?? ''}~${to ?? ''} out of range (1..${len})`);
    }
    return text(value.value.slice(lo - 1, hi));
  }
  throw evalErr(node, `cannot range over ${value.kind}`);
}

// -- conditional queries ----------------------------------------------

// value?(p)        → TRUE / FALSE (predicate)
// value?(p){tmpl}  → tmpl result on match, NULL on miss
// value??{ ... }   → first matching branch's body result; runtime error if
//                   no branch matches (give a `(_)` or `(___)` catch-all).
// Each branch body sees the env extended with names bound by its pattern.
function evalConditional(node, env) {
  const subject = evalItem(node.subject, env).value;
  for (const br of node.branches) {
    const m = matchPattern(br.pattern, subject, env);
    if (m) {
      if (br.body === null) return TRUE;
      const r = evalSequence(br.body.items, m);
      return r.values.length ? r.values[r.values.length - 1] : NULL;
    }
  }
  if (node.multi) throw evalErr(node, `no matching branch in ??`);
  return node.branches[0].body === null ? FALSE : NULL;
}

// -- helpers -----------------------------------------------------------

export function endsWithBareColon(w) {
  const last = w.text.length - 1;
  return last >= 0 && w.text[last] === ':' && !w.esc[last];
}

export function endsWithBareBang(w) {
  const last = w.text.length - 1;
  return last >= 0 && w.text[last] === '!' && !w.esc[last];
}

export function hasBareBang(w) {
  for (let i = 0; i < w.text.length; i++) {
    if (w.text[i] === '!' && !w.esc[i]) return true;
  }
  return false;
}

// Split a Word on every un-escaped `!`. Returns a list of synthetic Word
// nodes (text, esc, line, col). A trailing `!` produces an empty final
// segment, signalling "argument comes from the next sequence item".
export function splitOnBareBang(w) {
  const segs = [];
  let start = 0;
  for (let i = 0; i <= w.text.length; i++) {
    if (i === w.text.length || (w.text[i] === '!' && !w.esc[i])) {
      segs.push({
        type: 'Word',
        text: w.text.slice(start, i),
        esc:  w.esc.slice(start, i),
        line: w.line,
        col:  w.col + start,
      });
      start = i + 1;
    }
  }
  return segs;
}

// -- pipelines ---------------------------------------------------------

// A bare `->` is a two-char arrow where neither char came from an escape.
export function hasBareArrow(w) {
  for (let i = 0; i < w.text.length - 1; i++) {
    if (w.text[i] === '-' && w.text[i + 1] === '>'
        && !w.esc[i] && !w.esc[i + 1]) {
      return true;
    }
  }
  return false;
}

// Split a Word on every bare `->`. Returns synthetic Word nodes carrying
// the same line and an adjusted col. Empty segments (e.g. from `->foo` or
// `foo->`) are kept so callers can detect malformed pipelines.
export function splitOnBareArrow(w) {
  const segs = [];
  let start = 0;
  let i = 0;
  while (i < w.text.length) {
    if (i < w.text.length - 1
        && w.text[i] === '-' && w.text[i + 1] === '>'
        && !w.esc[i] && !w.esc[i + 1]) {
      segs.push(wordSlice(w, start, i));
      i += 2;
      start = i;
    } else {
      i++;
    }
  }
  segs.push(wordSlice(w, start, w.text.length));
  return segs;
}

function wordSlice(w, from, to) {
  return {
    type: 'Word',
    text: w.text.slice(from, to),
    esc:  w.esc.slice(from, to),
    line: w.line,
    col:  w.col + from,
  };
}

// Pipeline word eval: a Word with at least one bare `->`. Two modes:
//   - Execute: whole word ends in bare `!`. First seg is the input value,
//     each subsequent seg is a function applied left-to-right.
//   - Compose: no trailing `!`. All segs must resolve to functions; result
//     is a unary builtin that threads its arg through them in order.
function evalPipelineWord(node, env) {
  const segs = splitOnBareArrow(node);
  if (segs.length < 2) throw evalErr(node, `pipeline needs at least two stages`);
  for (const s of segs) {
    if (s.text.length === 0) throw evalErr(node, `empty pipeline stage in '${node.text}'`);
  }

  const last = segs[segs.length - 1];
  const lastChar = last.text[last.text.length - 1];
  const lastEsc  = last.esc[last.esc.length - 1];
  const execMode = lastChar === '!' && !lastEsc;

  if (execMode) {
    const trimmed = wordSlice(last, 0, last.text.length - 1);
    if (trimmed.text.length === 0) {
      throw evalErr(node, `empty pipeline stage in '${node.text}'`);
    }
    const stages = segs.slice(0, -1).concat([trimmed]);
    // First stage = input value (literal/name/query/etc). evalItem handles
    // literals; if it's a plain name we still want a value (text), not a
    // lookup — that matches the documented `hello->log!` example.
    let cur = evalItem(stages[0], env).value;
    for (let k = 1; k < stages.length; k++) {
      const fnVal = resolveCallTarget(stages[k], env);
      cur = applyFn(fnVal, cur, stages[k]);
    }
    return cur;
  }

  // Compose mode: every seg must resolve (by name lookup) to a function.
  const fns = segs.map(s => resolveCallTarget(s, env));
  return builtin(`pipeline@${node.line}:${node.col}`, (arg, callNode) => {
    let cur = arg;
    for (const f of fns) cur = applyFn(f, cur, callNode || node);
    return cur;
  });
}

// -- partial application ----------------------------------------------

export function hasBareApos(w) {
  for (let i = 0; i < w.text.length; i++) {
    if (w.text[i] === "'" && !w.esc[i]) return true;
  }
  return false;
}

export function splitOnBareApos(w) {
  const segs = [];
  let start = 0;
  for (let i = 0; i <= w.text.length; i++) {
    if (i === w.text.length || (w.text[i] === "'" && !w.esc[i])) {
      segs.push({
        type: 'Word',
        text: w.text.slice(start, i),
        esc:  w.esc.slice(start, i),
        line: w.line,
        col:  w.col + start,
      });
      start = i + 1;
    }
  }
  return segs;
}

// Stand-alone partial: a Word with bare `'` that's NOT trailing (so the arg
// is inline). Used when a partial appears as a value (template item, pipe
// stage, embedded bind value). Trailing-`'` consume-next is only meaningful
// inside a sequence — that path goes through consumePartial.
function evalPartialWord(node, env) {
  const segs = splitOnBareApos(node);
  const last = segs[segs.length - 1];
  if (last.text.length === 0) {
    throw evalErr(node, `partial '${node.text}' has no inline argument`);
  }
  return applyPartialChain(segs, evalItem(last, env).value, env, node);
}

function consumePartial(items, i, env) {
  const node = items[i];
  const segs = splitOnBareApos(node);
  const last = segs[segs.length - 1];
  let arg, nextI;
  if (last.text.length === 0) {
    if (i + 1 >= items.length) {
      throw evalErr(node, `no argument for partial '${node.text}'`);
    }
    const argInfo = consumeValue(items, i + 1, env);
    arg = argInfo.value;
    nextI = argInfo.nextI;
  } else {
    arg = evalItem(last, env).value;
    nextI = i + 1;
  }
  return { value: applyPartialChain(segs, arg, env, node), nextI };
}

// Right-to-left chain like applyCallChain, but each link is a *partial*
// application instead of a full call. `f'g'5` → partial-apply g with 5,
// then partial-apply f with the resulting function value.
function applyPartialChain(segs, arg, env, srcNode) {
  const fnSegs = segs.slice(0, segs.length - 1);
  for (let k = fnSegs.length - 1; k >= 0; k--) {
    const fnVal = resolveCallTarget(fnSegs[k], env);
    arg = applyPartial(fnVal, arg, fnSegs[k]);
  }
  return arg;
}

// Apply a partial: fill the leftmost K slots of fnVal's pattern with the
// items of `arg` (or `arg` itself, as a 1-item list). Returns a new fn:
//   - with the remaining slots as its pattern, OR
//   - with an empty pattern (zero-arg thunk) when all slots are filled.
// Builtins don't carry a Pattern AST yet, so they're rejected until the
// builtin-partial protocol is designed in Phase 11.
function applyPartial(fnVal, arg, callNode) {
  if (fnVal.kind === 'builtin') {
    return applyPartialBuiltin(fnVal, arg, callNode);
  }
  if (fnVal.kind !== 'fn') {
    throw evalErr(callNode, `cannot partially apply non-function (got ${fnVal.kind})`);
  }
  const pattern = fnVal.pattern;
  if (!pattern || pattern.type !== 'Pattern') {
    throw evalErr(callNode, `partial: function has no slot pattern`);
  }
  const slots = pattern.items;

  // Fill values: a tmpl arg contributes its items; anything else is one fill.
  const fills = isTmpl(arg) ? forceTmplItems(arg) : [arg];

  if (fills.length > slots.length) {
    throw evalErr(callNode,
      `too many partial arguments: ${fills.length} given, ${slots.length} slots`);
  }

  // Match the leading slots against the fills.
  const filledPattern = { type: 'Pattern', items: slots.slice(0, fills.length) };
  const fillTmpl = tmpl(fills, fnVal.env);
  const bindings = matchPattern(filledPattern, fillTmpl, fnVal.env);
  if (!bindings) {
    throw evalErr(callNode, `partial argument does not match function pattern`);
  }

  const remaining = slots.slice(fills.length);
  const newPattern = { type: 'Pattern', items: remaining };
  return fn(newPattern, fnVal.body, bindings, fnVal.name);
}

// Builtin partial: fills are remembered and prepended to the call argument
// when the resulting builtin is invoked. For fixed-arity builtins we track
// the remaining slot count so `fnArity` reports it correctly (this drives
// zero-arg-call detection for trailing `!`). Variadic builtins stay variadic.
function applyPartialBuiltin(fnVal, arg, callNode) {
  const fills = isTmpl(arg) ? forceTmplItems(arg) : [arg];
  const orig = fnVal;
  if (orig.arity >= 0 && fills.length > orig.arity) {
    throw evalErr(callNode,
      `too many partial arguments for ${orig.name}: ${fills.length} given, ${orig.arity} slots`);
  }
  const remaining = orig.arity >= 0 ? orig.arity - fills.length : -1;
  const wrapped = (newArg, node) => {
    let extra;
    if (newArg === undefined || newArg === null) {
      extra = [];
    } else if (remaining === 1) {
      // Exactly one remaining slot — newArg fills it whole (no flatten),
      // so a list-positional like map'fn!{1 2 3} stays a list.
      extra = [newArg];
    } else if (isTmpl(newArg)) {
      extra = forceTmplItems(newArg);
    } else {
      extra = [newArg];
    }
    const combined = tmpl([...fills, ...extra], null);
    // Pre-loaded with already-Value items so forceTmplItems short-circuits;
    // see evalSequence's pass-through branch.
    return orig.fn(combined, node || callNode);
  };
  return builtin(orig.name, wrapped, remaining);
}

export function splitEmbeddedBind(node) {
  if (node.type !== 'Word') return null;
  const { text: s, esc } = node;
  for (let k = 0; k < s.length - 1; k++) {
    if (s[k] === ':' && !esc[k]) {
      if (k === 0) return null;
      return {
        name: s.slice(0, k),
        valueNode: {
          type: 'Word',
          text: s.slice(k + 1),
          esc:  esc.slice(k + 1),
          line: node.line,
          col:  node.col + k + 1,
        },
      };
    }
  }
  return null;
}

export function forceTmplItems(t) {
  return evalSequence(t.items, t.env).values;
}

// -- box pipeline ---------------------------------------------------------

function isBoxPipelineStart(node, items, i) {
  if (!node) return false;
  if (node.type === 'Box') return true;
  if (node.type === 'Word' && endsWithBareArrow(node)) {
    const next = items[i + 1];
    if (next && next.type === 'Box') return true;
  }
  // Non-Word value (Tmpl, regex literal, etc.) followed by a Word starting
  // with bare `->` then a Box. The `{}->[name]!` form from the docs.
  if (node.type !== 'Word') {
    const next = items[i + 1];
    if (next && next.type === 'Word' && startsWithBareArrow(next)) {
      const after = items[i + 2];
      if (after && after.type === 'Box') return true;
    }
  }
  return false;
}

function startsWithBareArrow(w) {
  if (w.text.length < 2) return false;
  return w.text[0] === '-' && w.text[1] === '>'
      && !w.esc[0] && !w.esc[1];
}

function endsWithBareArrow(w) {
  const n = w.text.length;
  if (n < 2) return false;
  return w.text[n - 2] === '-' && w.text[n - 1] === '>'
      && !w.esc[n - 2] && !w.esc[n - 1];
}

function wordConcat(a, b) {
  return {
    type: 'Word',
    text: a.text + b.text,
    esc:  [...a.esc, ...b.esc],
    line: a.line,
    col:  a.col,
  };
}

function getBoxName(boxNode) {
  if (!boxNode.items || boxNode.items.length !== 1) {
    throw evalErr(boxNode, `box must contain exactly one name`);
  }
  const w = boxNode.items[0];
  if (w.type !== 'Word' || w.text.length === 0) {
    throw evalErr(boxNode, `box must contain a name`);
  }
  return w.text;
}

function readBox(name, env, node) {
  if (!env.boxes.has(name)) {
    throw evalErr(node, `box [${name}] has no value`);
  }
  return env.boxes.get(name);
}

function writeBox(name, value, env) {
  env.boxes.set(name, value);
}

// Consume a multi-item pipeline phrase that involves at least one Box.
// Returns { value, nextI }.
//
// The phrase is built as a list of stages, where each stage is either a Box
// or a Word fragment between `->` arrows. Adjacent items glue when one ends
// in bare `->` and/or the other begins with bare `->`. A trailing `!` (as a
// standalone item, or as the suffix of the last Word) executes the chain.
//
// Compose-mode (no `!`) is not supported for box pipelines — a deferred
// chain that performs box I/O has no obvious semantics.
function consumeBoxPipeline(items, start, env) {
  const stages = [];     // { kind:'box', node } | { kind:'word', word } | { kind:'value', node }
  let pending = null;
  let bang = false;
  let i = start;

  // Leading non-Word, non-Box value: it is the input-value stage. The
  // next item must be an attached Word beginning with bare `->`.
  if (items[start] && items[start].type !== 'Box' && items[start].type !== 'Word') {
    stages.push({ kind: 'value', node: items[start] });
    i = start + 1;
  }

  const flushPendingAsStage = () => {
    if (pending && pending.text.length > 0) {
      stages.push({ kind: 'word', word: pending });
    }
    pending = null;
  };

  while (i < items.length) {
    const it = items[i];

    if (it.type === 'Box') {
      if (pending && pending.text.length > 0) {
        // pending has non-empty content with no trailing `->`: not glued.
        break;
      }
      stages.push({ kind: 'box', node: it });
      pending = null;
      i++;
      // After a box, check for an immediately-following `!` executor item.
      const peek = items[i];
      if (peek && peek.type === 'Word' && peek.text === '!' && !peek.esc[0]) {
        bang = true;
        i++;
        break;
      }
      continue;
    }

    if (it.type !== 'Word') break;

    if (hasBareArrow(it)) {
      const parts = splitOnBareArrow(it);
      // Merge leading fragment with any pending fragment.
      const first = pending ? wordConcat(pending, parts[0]) : parts[0];
      if (first.text.length > 0) {
        stages.push({ kind: 'word', word: first });
      } else if (stages.length === 0 && pending === null) {
        // Word starts with `->` and no prior stage: malformed start of phrase.
        throw evalErr(it, `pipeline starts with '->'`);
      }
      // Middle fragments stand alone.
      for (let p = 1; p < parts.length - 1; p++) {
        if (parts[p].text.length === 0) {
          throw evalErr(it, `empty stage in pipeline`);
        }
        stages.push({ kind: 'word', word: parts[p] });
      }
      // Trailing fragment becomes the new pending.
      pending = parts[parts.length - 1];
      i++;
      if (pending.text.length > 0) {
        // Non-empty trailing fragment is the final stage — no glue can follow.
        // Check for trailing bare `!`.
        const n = pending.text.length;
        if (pending.text[n - 1] === '!' && !pending.esc[n - 1]) {
          bang = true;
          pending = { ...pending, text: pending.text.slice(0, n - 1), esc: pending.esc.slice(0, n - 1) };
        }
        if (pending.text.length > 0) {
          stages.push({ kind: 'word', word: pending });
        }
        pending = null;
        break;
      }
      continue;
    }

    // Word with no bare `->`.
    if (pending === null) {
      // No glue available; this item is separate from the phrase.
      break;
    }
    // pending is empty fragment (after trailing `->`); this word joins as the next stage.
    const stage = wordConcat(pending, it);
    pending = null;
    const n = stage.text.length;
    if (n > 0 && stage.text[n - 1] === '!' && !stage.esc[n - 1]) {
      bang = true;
      const stripped = { ...stage, text: stage.text.slice(0, n - 1), esc: stage.esc.slice(0, n - 1) };
      if (stripped.text.length > 0) stages.push({ kind: 'word', word: stripped });
    } else {
      stages.push({ kind: 'word', word: stage });
    }
    i++;
    break; // no `->` at the end means no further glue
  }

  if (pending && pending.text.length === 0 && !bang) {
    throw evalErr(items[start], `dangling '->' at end of box pipeline`);
  }
  flushPendingAsStage();

  if (!bang) {
    throw evalErr(items[start], `box pipeline must end with '!'`);
  }
  if (stages.length === 0) {
    throw evalErr(items[start], `empty box pipeline`);
  }

  // Evaluate stages.
  const first = stages[0];
  let cur;
  if (first.kind === 'box') {
    cur = readBox(getBoxName(first.node), env, first.node);
  } else if (first.kind === 'value') {
    cur = evalItem(first.node, env).value;
  } else {
    cur = evalItem(first.word, env).value;
  }

  for (let s = 1; s < stages.length; s++) {
    const st = stages[s];
    if (st.kind === 'box') {
      writeBox(getBoxName(st.node), cur, env);
      // Value continues as the written value, so further stages can use it.
      continue;
    }
    const fnVal = resolveCallTarget(st.word, env);
    cur = applyFn(fnVal, cur, st.word);
  }

  return { value: cur, nextI: i };
}

function assertName(name, node) {
  if (name.length === 0) throw evalErr(node, `empty binding name`);
  if (NUM_RE.test(name)) throw evalErr(node, `binding name looks like a number: ${name}`);
}

function evalErr(node, msg) {
  const loc = node && node.line ? ` at ${node.line}:${node.col}` : '';
  return new Error(`${msg}${loc}`);
}

