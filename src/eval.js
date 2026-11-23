// Punk evaluator. Only syntax errors are errors (ERR-1, ERR-2): every
// other failure evaluates to the non-thing (ERR-3), so nothing in here throws.

import { newEnv } from './env.js';
import {
  NONE, TRUE, FALSE, mkWord, mkGroup, mkNamed, mkBool,
  itemsOf, unwrapNamed, isNone, equals,
} from './values.js';
import { textOf } from './format.js';
import { parse, queryFromParts } from './parse.js';
import { builtins } from './builtins.js';
import { syntaxError, isSyntaxError } from './errors.js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createGlobal() {
  const g = newEnv();
  for (const b of builtins) g.define(b.name, { kind: 'Builtin', ...b });
  globalRoot = g;
  return g;
}

const io = { write: (s) => console.log(s), baseDir: '.' };
export function setOutput(fn) { io.write = fn; }
export function setBaseDir(dir) { io.baseDir = resolve(dir); }

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
const isAtom = (w) => w.kind === 'Word' && w.text !== null && /^@[^\s@.]+$/.test(w.text);

// Modules (MOD-*): a file is its own context; its names are returned as a
// group of named things so the importer binds them under one name.
function importFile(name) {
  const cands = [join(io.baseDir, name), join(io.baseDir, name + '.punk'), join(LIB_DIR, name + '.punk')];
  const file = cands.find((c) => existsSync(c) && statSync(c).isFile());
  if (!file) return NONE;
  const cache = (globalRoot.moduleCache ??= new Map());
  if (cache.has(file)) return cache.get(file);
  const root = createGlobalRoot();
  const m = newEnv(root);
  cache.set(file, NONE); // a module importing itself sees the non-thing
  const saved = io.baseDir;
  io.baseDir = dirname(file);
  try { evalProgram(parse(readFileSync(file, 'utf8')), m); } finally { io.baseDir = saved; }
  const exported = mkGroup([...m.vars].map(([k, v]) => mkNamed(k, v)));
  cache.set(file, exported);
  return exported;
}

let globalRoot = null;
function createGlobalRoot() { return globalRoot; }

// ---------- programs & statements ----------

export function evalProgram(program, env) {
  let last = NONE;
  for (const s of program.stmts) last = evalStmt(s, env);
  return last;
}

export function evalStmt(node, env) {
  switch (node.kind) {
    case 'Named': return bindName(node, env, true);
    case 'Cases': return evalCases(node, env);
    case 'Group': return node; // a thing not being evaluated stays as written (EMB-2)
    default: return evalItem(node, env);
  }
}

function bindValue(v, env) {
  switch (v.kind) {
    case 'FnLit': return makeFn(v, env);
    case 'Pipe': return v.seed ? evalItem(v, env) : { kind: 'PipeFn', stages: v.stages, env };
    case 'Group': return v.items.length === 1 && v.items[0].kind === 'Word' ? v.items[0] : v;
    case 'Named': return mkNamed(nameOf(v, env), bindValue(v.value, env));
    default: return evalItem(v, env);
  }
}

const nameOf = (node, env) => (node.nameParts
  ? node.nameParts.map((p) => (p.lit !== undefined ? p.lit : textOf(embedValue(p.embed, env)))).join('')
  : node.name);

function bindName(node, env, define) {
  const value = bindValue(node.value, env);
  const name = nameOf(node, env);
  if (define && !env.define(name, value)) throw syntaxError(`The name '${name}' is already attached in this context`, node.line, node.col); // NAME-2
  return mkNamed(name, value);
}

const makeFn = (lit, env) => ({ kind: 'Fn', pattern: lit.pattern, body: lit.body, env });

// ---------- items & templates ----------

const embedValue = (e, env) => (e.kind === 'Call' ? evalItem(e, env) : resolveQuery(e, env));

function embedItems(word, env) {
  const parts = word.parts;
  if (parts.length === 1 && parts[0].embed) {
    const v = embedValue(parts[0].embed, env);
    // a whole-element embed contributes the items of its result, not the result's own [ ] (EMB-13)
    return itemsOf(v);
  }
  const text = parts.map((p) => (p.lit !== undefined ? p.lit : textOf(embedValue(p.embed, env)))).join('');
  // EMB-10: re-read the result, so it may hold a different number of things
  return text.split(/\s+/).filter(Boolean).map(mkWord);
}

function evalItems(nodes, env, bind = false) {
  const out = [];
  for (const n of nodes) {
    if (n.kind === 'Word' && n.parts) out.push(...embedItems(n, env));
    else if (n.kind === 'Named' && bind && env.fn) out.push(bindName(n, env, true));
    else out.push(evalItem(n, env));
  }
  return out;
}

export function evalTemplate(node, env, bind = false) {
  const nodes = node.kind === 'Group' ? node.items : [node];
  return mkGroup(evalItems(nodes, env, bind));
}

function evalItem(node, env) {
  switch (node.kind) {
    case 'Word':
      if (isAtom(node)) return env.atoms().get(node.text.slice(1)) ?? NONE;
      return node.parts ? mkGroup(embedItems(node, env)) : node;
    case 'Group': return evalTemplate(node, env);
    case 'Named': return bindName(node, env, false);
    case 'Query': return resolveQuery(node, env);
    case 'Call': return evalCall(node, env).value;
    case 'Match': {
      const thing = evalItem(node.thing, env);
      return mkBool(matchPattern(node.pattern, thing) !== null);
    }
    case 'Pipe': return evalPipe(node, env);
    case 'Swap': return evalSwap(node, env);
    case 'Cases': return evalCases(node, env);
    case 'FnLit': return makeFn(node, env);
    default: return node;
  }
}

// ---------- queries ----------

const isIndex = (s) => /^-?\d+$/.test(s);
const RANGE = /^(-?\d+)-(-?\d+)?$/;

// A negative index selects a suffix: -1 is the last item, -2 the last two.
const absIndex = (n, len) => (n < 0 ? len + n + 1 : n);

function queryItems(v) {
  if (v.kind !== 'Word') return itemsOf(v);
  return [...(v.text ?? textOf(v))].map(mkWord);
}

function applySegs(v, segs) {
  for (const s of segs) {
    const range = RANGE.exec(s);
    const charQuery = v.kind === 'Word' && (isIndex(s) || range);
    const items = queryItems(v);
    if (isIndex(s)) {
      const n = Number(s);
      const i = absIndex(n, items.length);
      if (i < 1 || i > items.length) v = NONE;
      else if (n < 0) {
        const selected = items.slice(i - 1);
        v = charQuery ? mkWord(selected.map((x) => x.text).join('')) : mkGroup(selected);
      } else v = items[i - 1];
    } else if (range) {
      // a-b and a- select a clamped slice, or nothing (QRY-10..12)
      const from = absIndex(Number(range[1]), items.length);
      const to = range[2] === undefined ? items.length : absIndex(Number(range[2]), items.length);
      if (from >= 1 && to >= from && from <= items.length) {
        const selected = items.slice(from - 1, Math.min(to, items.length));
        v = charQuery ? mkWord(selected.map((x) => x.text).join('')) : mkGroup(selected);
      } else v = NONE;
    } else {
      const hit = items.find((x) => x.kind === 'Named' && x.name === s);
      v = hit ? hit.value : NONE;
    }
  }
  return v;
}

// Evaluates a segment's embeds to text (QRY-14); a failed embed gives '' (QRY-16).
const segText = (seg, env) => (typeof seg === 'string'
  ? seg
  : seg.parts.map((p) => (p.lit !== undefined ? p.lit : textOf(embedValue(p.embed, env)))).join(''));

export function resolveQuery(query, env) {
  const segs = query.segs.map((s) => segText(s, env));
  if (segs.some((s, i) => s === '' && typeof query.segs[i] !== 'string')) return NONE;
  const q = { local: query.local, segs };
  if (query.base) return applySegs(evalItem(query.base, env), q.segs);
  if (q.local) {
    const fe = env.localFn(); // `.` is always local (NAME-2e)
    const arg = fe ? fe.fn.arg : NONE;
    if (q.segs.length && !isIndex(q.segs[0]) && !RANGE.test(q.segs[0]) && fe && fe.vars.has(q.segs[0])) {
      return applySegs(fe.vars.get(q.segs[0]), q.segs.slice(1));
    }
    return applySegs(arg, q.segs);
  }
  const base = env.lookup(q.segs[0]);
  if (base === undefined) return NONE;
  return applySegs(base, q.segs.slice(1));
}

// ---------- pattern matching ----------

function specMatches(spec, actual) {
  if (spec.type === 'one') return true;
  const t = spec.thing;
  if (t.kind === 'Group' && t.items.length && t.items.every((x) => x.kind === 'Named')) {
    const items = itemsOf(actual);
    return t.items.every((n) => {
      const hit = items.find((x) => x.kind === 'Named' && x.name === n.name);
      return hit && specMatches({ type: 'lit', thing: n.value }, hit.value);
    });
  }
  if (t.kind === 'Named') return specMatches({ type: 'lit', thing: mkGroup([t]) }, actual);
  return equals(t, unwrapNamed(actual));
}

// Returns a Map of label -> thing, or null when the pattern does not match.
export function matchPattern(pattern, thing) {
  const items = itemsOf(thing);
  const binds = new Map();
  const restSlot = pattern.left.find((s) => s.type === 'rest');
  const fixed = pattern.left.filter((s) => s.type !== 'rest');
  if (restSlot ? items.length < fixed.length : items.length !== fixed.length) return null;
  let i = 0;
  for (const s of pattern.left) {
    if (s.type === 'rest') {
      const rest = items.slice(i).map(unwrapNamed);
      if (s.label) binds.set(s.label, mkGroup(rest));
      i = items.length;
      continue;
    }
    const item = items[i++];
    if (s.type === 'lit' && !equals(s.thing, unwrapNamed(item))) return null;
    if (s.label) binds.set(s.label, unwrapNamed(item));
  }
  for (const r of pattern.right) {
    const value = applySegs(thing, r.name.split('.'));
    if (isNone(value) || !specMatches(r.spec, value)) return null;
  }
  return binds;
}

// ---------- calls ----------

function requiredCount(f) {
  if (f.kind === 'Fn') return f.pattern.left.filter((s) => s.type !== 'rest').length;
  if (f.kind === 'Builtin') return f.min;
  return 0;
}

function ctxFor(env) {
  return {
    env,
    print: (s) => io.write(s),
    callFn: (f, thing) => callThing(f, [thing], thing, env, true).value,
    // Calls f with (value key position), giving it only as many as its pattern declares (HOF-9)
    callEach: (f, whole, thing, key, pos) => {
      const slots = f.kind === 'Fn' ? f.pattern.left : [];
      const n = slots.some((s) => s.type === 'rest') ? 3 : Math.min(slots.length, 3);
      const items = n <= 1 ? [whole] : [thing, key, pos].slice(0, n);
      return callThing(f, items, { kind: 'Group', items }, env, true).value;
    },
    evalSource: (src) => evalProgram(parse(src), newEnv(env)),
    importFile,
    // the items of a function's body, evaluated without calling the function
    bodyItems: (f) => evalItems(f.body.kind === 'Group' ? f.body.items : [f.body], newEnv(f.env, { arg: NONE }), false),
  };
}

// Calls `f` with arg items (curry-aware) and the whole arg thing.
// Returns { matched, value }.
function callThing(f, argItems, argThing, env, literal) {
  switch (f.kind) {
    case 'Fn': {
      const n = itemsOf(argThing).length;
      if (!literal && n > 0 && n < requiredCount(f)) return { matched: true, value: { kind: 'Partial', fn: f, supplied: itemsOf(argThing) } };
      const binds = matchPattern(f.pattern, argThing);
      if (!binds) return { matched: false, value: NONE };
      const fenv = newEnv(f.env, { arg: argThing });
      for (const [k, v] of binds) fenv.define(k, v);
      const body = f.body.kind === 'Group' ? f.body.items : [f.body];
      return { matched: true, value: mkGroup(evalItems(body, fenv, true)) };
    }
    case 'Builtin': {
      const items = itemsOf(argThing);
      if (!literal && items.length > 0 && items.length < f.min) {
        return { matched: true, value: { kind: 'Partial', fn: f, supplied: items } };
      }
      if (items.length < f.min || items.length > f.max) return { matched: false, value: NONE };
      let value;
      try { value = f.fn(items, ctxFor(env)); } catch (e) { if (isSyntaxError(e)) throw e; value = NONE; }
      return { matched: true, value: value ?? NONE };
    }
    case 'Partial': {
      const items = [...f.supplied, ...argItems];
      return callThing(f.fn, items, mkGroup(items), env, literal);
    }
    case 'PipeFn': {
      let v = argThing;
      let matched = true;
      f.stages.forEach((st, i) => {
        const r = runStage(st, v, f.env);
        if (i === 0) matched = r.matched;
        v = r.value;
      });
      return { matched, value: v };
    }
    case 'Pattern': {
      const m = matchPattern(f, argThing) !== null;
      return { matched: m, value: mkBool(m) };
    }
    case 'Group': return { matched: true, value: evalTemplate(f, env) };
    case 'Atom': {
      env.atoms().set(f.name, argThing); // push state into the atom (ATOM-2)
      return { matched: true, value: argThing };
    }
    default: return { matched: false, value: NONE };
  }
}

function targetOf(t, env) {
  switch (t.kind) {
    case 'FnLit': return { f: makeFn(t, env), literal: true };
    case 'Pattern': return { f: t, literal: true };
    case 'Group': return { f: t, literal: false };
    case 'Word': {
      if (t.parts) return { f: resolveQuery(queryFromParts(t.parts), env), literal: false }; // g.{k?}! (QRY-18)
      if (isAtom(t)) return { f: { kind: 'Atom', name: t.text.slice(1) }, literal: true };
      if (t.text.includes('.')) {
        const segs = t.text.split('.');
        const base = env.lookup(segs[0]);
        return { f: base === undefined ? NONE : applySegs(base, segs.slice(1)), literal: false };
      }
      const v = env.lookup(t.text);
      return { f: v === undefined ? NONE : v, literal: false };
    }
    case 'Query': return { f: resolveQuery(t, env), literal: false };
    default: return { f: evalItem(t, env), literal: false };
  }
}

function evalCall(node, env, hasPiped = false, piped) {
  const { f, literal } = targetOf(node.target, env);
  const attached = node.args ? evalItem(node.args, env) : undefined;
  const attachedItems = attached !== undefined
    ? (hasPiped && isNone(attached) ? [attached] : itemsOf(attached))
    : [];
  const argItems = [...attachedItems, ...(hasPiped ? [piped] : [])];
  let argThing;
  if (attached === undefined) argThing = hasPiped ? piped : NONE;
  else argThing = mkGroup(argItems);
  return callThing(f, argItems, argThing, env, literal);
}

function runStage(stage, input, env) {
  if (stage.kind === 'Call') return evalCall(stage, env, true, input);
  if (stage.kind === 'FnLit') return { matched: true, value: makeFn(stage, env) };
  const f = evalItem(stage, env);
  return callThing(f, [input], input, env, false);
}

function evalPipe(node, env) {
  let v = node.seed ? evalItem(node.seed, env) : NONE;
  for (const st of node.stages) v = runStage(st, v, env).value;
  return v;
}

function evalSwap(node, env) {
  if (node.atom.kind !== 'Word' || !isAtom(node.atom)) return NONE;
  const name = node.atom.text.slice(1);
  const current = env.atoms().get(name) ?? NONE;
  const result = runStage(node.stage, current, env);
  if (!result.matched) return NONE;
  env.atoms().set(name, result.value);
  return result.value;
}

// ---------- cases ----------

function runStages(stages, subject, env) {
  const r = stages.length === 1 && stages[0].kind === 'FnLit'
    ? callThing(makeFn(stages[0], env), [subject], subject, env, true)
    : runStage(stages[0], subject, env);
  if (!r.matched) return { matched: false, value: NONE };
  let v = r.value;
  for (const st of stages.slice(1)) v = runStage(st, v, env).value;
  return { matched: true, value: v };
}

function tryLevel(entries, depth, from, to, subject, env) {
  for (let j = from; j < to; j++) {
    if (entries[j].depth !== depth) continue;
    const r = runStages(entries[j].stages, subject, env);
    if (!r.matched) continue;
    let end = j + 1;
    while (end < to && entries[end].depth > depth) end++;
    if (end > j + 1) {
      const sub = tryLevel(entries, depth + 1, j + 1, end, subject, env);
      return sub.matched ? sub : { matched: true, value: NONE }; // CASE-6
    }
    return r;
  }
  return { matched: false, value: NONE };
}

function evalCases(node, env) {
  const subject = evalItem(node.subject, env);
  if (!node.entries.length) return NONE;
  const top = Math.min(...node.entries.map((e) => e.depth));
  return tryLevel(node.entries, top, 0, node.entries.length, subject, env).value; // CASE-7
}

export function parseProgram(src) { return parse(src); }
export { TRUE, FALSE };
