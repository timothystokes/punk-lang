// Punk evaluator.
//
// `evalProgram(tree, env) -> value` walks the top-level Tmpl produced
// by the parser and returns the value of the **last** top-level item
// (this is what the REPL displays). Top-level Named items bind into
// `env` so later items can reference them.
//
// Punk's evaluation rule is shallow: templates are inert. The items
// inside a `{...}` or `"..."` are NOT auto-evaluated. They become
// part of the template value as-is. The only triggers that evaluate
// nested content are:
//   - `?`  (Query): resolves the single path it's attached to.
//   - `!`  (Exec): runs a function or template; cascades into nested
//                  content as it goes.
//
// At the top level, each item is "reached" — so a top-level Query
// resolves, a top-level Exec runs. But the items inside a Tmpl value
// are not reached until `!` is applied to the Tmpl.

import { PunkRuntimeError } from './errors.js';
import { mkTmpl, mkText, mkWord, mkFn, mkPartialFn, NULL, TRUE, FALSE } from './values.js';
import { match } from './match.js';
import { builtins } from './builtins.js';
import { format } from './format.js';

// A Range value at the top level expands to a Tmpl of integers.
const expandRange = (node) => {
  const { from, to } = node;
  if (from === null || to === null) {
    throw new PunkRuntimeError(
      'open-ended range needs a path or collection to anchor to',
      node.line, node.col,
    );
  }
  const items = [];
  for (let n = from; n <= to; n++) {
    items.push({ kind: 'Word', subkind: 'number', text: String(n) });
  }
  return mkTmpl(items);
};

// Strip parser-only metadata from a node so it can be returned as a
// value. Returns a shallow-cleaned copy.
const stripMeta = (node) => {
  if (!node || typeof node !== 'object') return node;
  const { line, col, glued, ...rest } = node;
  return rest;
};

// Evaluate one top-level item. Most kinds return as-is (templates
// are inert). Named binds into `env` and yields the bound value.
const evalItem = (node, env) => {
  if (!node || typeof node !== 'object') return NULL;
  switch (node.kind) {
    case 'Tmpl':
    case 'Text':
    case 'Pattern':
    case 'Box':
    case 'Pipeline':
    case 'Word':
      return stripMeta(node);

    case 'Fn':
      return mkFn(
        stripMeta(node.params),
        stripMeta(node.body),
        env,
        node.returnRange || null,
      );

    case 'Range':
      return expandRange(node);

    case 'Named': {
      let value = evalItem(node.value, env);
      // Auto-wrap rule: a bare-value binding (`x:42`, `n:hello`) is
      // shorthand for `x:{42}` / `n:{hello}`. Bare Words and Numbers
      // have no inherent delimiter, so binding wraps them in a
      // singleton Tmpl. Reserved values (TRUE/FALSE) and everything
      // with its own delimiters bind as-is.
      if (value && value.kind === 'Word'
          && (value.subkind === 'value' || value.subkind === 'number')) {
        value = mkTmpl([value]);
      }
      env.bind(node.name, value, node);
      return { kind: 'Named', name: node.name, value };
    }

    case 'Query':
      return evalQuery(node, env);

    case 'Exec':
      return evalExec(node, env);

    case 'Match':
      return evalMatch(node, env);

    case 'Partial':
      return evalPartial(node, env);

    default:
      throw new PunkRuntimeError(
        `unknown node kind '${node.kind}'`,
        node.line, node.col,
      );
  }
};

// ---------- Query path resolution ----------
//
// A Query (`name.seg.seg?`) walks a path from a starting value and
// returns the value at the end of that walk — or NULL if any step
// goes off the end of the data. A bare unbound name (no segments)
// returns NULL; an unbound name followed by *any* segment is a
// runtime error (locked design decision).
//
// The walker tracks two facts at each step: the current value and
// the "current name" — the name picked up by the most recent
// segment. `.:` plucks that name. Most segments produce an unnamed
// value (current name resets to null); only `.fieldName` and
// indexed/named lookups inside a Tmpl record set it.

const sliceTmpl = (items, lo, hi) => {
  // 1-based bounds [lo, hi] inclusive; out-of-range clipped to the
  // available range. Names are stripped (path traversal never
  // surfaces names except via `.:?`).
  const out = [];
  const start = Math.max(1, lo);
  const end   = Math.min(items.length, hi);
  for (let i = start; i <= end; i++) {
    const it = items[i - 1];
    out.push(it && it.kind === 'Named' ? it.value : it);
  }
  return mkTmpl(out);
};

// Length of a Text counts characters across its literal parts; embeds
// are not counted (they're unresolved templates).
const textLength = (parts) => {
  let n = 0;
  for (const p of parts) if ('lit' in p) n += p.lit.length;
  return n;
};

const flatTextChars = (parts) => {
  let s = '';
  for (const p of parts) if ('lit' in p) s += p.lit;
  return s;
};

const sliceText = (parts, lo, hi) => {
  const s = flatTextChars(parts);
  const start = Math.max(1, lo) - 1;
  const end   = Math.min(s.length, hi);
  return mkText([{ lit: s.slice(start, end) }]);
};

// Apply one path segment. Returns { value, name } or null (meaning
// "fell off the end" — caller substitutes NULL).
function walkSegment(cur, seg, node) {
  const v = cur.value;
  switch (seg.kind) {
    case 'index': {
      const n = seg.n;
      if (v.kind === 'Tmpl') {
        if (n < 1 || n > v.items.length) return null;
        const item = v.items[n - 1];
        if (item && item.kind === 'Named') {
          return { value: item.value, name: item.name };
        }
        return { value: item, name: null };
      }
      if (v.kind === 'Text') {
        const s = flatTextChars(v.parts);
        if (n < 1 || n > s.length) return null;
        return { value: mkText([{ lit: s[n - 1] }]), name: null };
      }
      return null;
    }
    case 'name': {
      if (v.kind !== 'Tmpl') return null;
      for (const item of v.items) {
        if (item && item.kind === 'Named' && item.name === seg.text) {
          return { value: item.value, name: item.name };
        }
      }
      return null;
    }
    case 'length': {
      let n;
      if      (v.kind === 'Tmpl') n = v.items.length;
      else if (v.kind === 'Text') n = textLength(v.parts);
      else return null;
      return { value: mkWord(String(n), 'number'), name: null };
    }
    case 'nameOf': {
      if (cur.name == null) return null;
      return { value: mkWord(cur.name), name: null };
    }
    case 'pattern': {
      if (v.kind !== 'Fn') return null;
      return { value: v.params, name: null };
    }
    case 'range': {
      const len =
        v.kind === 'Tmpl' ? v.items.length :
        v.kind === 'Text' ? textLength(v.parts) : null;
      if (len == null) return null;
      if (seg.from === null && seg.to === null) {
        if (len === 0) return null;
        return walkSegment(cur, { kind: 'index', n: len }, node);
      }
      const from = seg.from === null ? 1   : seg.from;
      const to   = seg.to   === null ? len : seg.to;
      if (v.kind === 'Tmpl') return { value: sliceTmpl(v.items, from, to), name: null };
      return { value: sliceText(v.parts, from, to), name: null };
    }
    default:
      throw new PunkRuntimeError(
        `unknown path segment '${seg.kind}'`, node.line, node.col,
      );
  }
}

function evalQuery(node, env) {
  const segments = node.segments || [];
  let cur;
  if (typeof node.head === 'string') {
    if (!env.has(node.head)) {
      if (segments.length === 0) return NULL;
      throw new PunkRuntimeError(
        `name '${node.head}' is not bound`, node.line, node.col,
      );
    }
    cur = { value: env.lookup(node.head), name: node.head };
  } else {
    // Head is a node attached via leading-dot paths (e.g. `{1 2}.1?`).
    cur = { value: evalItem(node.head, env), name: null };
  }
  for (const seg of segments) {
    const next = walkSegment(cur, seg, node);
    if (next === null) return NULL;
    cur = next;
  }
  return cur.value;
}

// ---------- Exec / function call ----------
//
// `name!args` looks up `name`, resolves any path segments, and then
// calls the resulting function (user Fn or builtin) with the
// (cascaded) args Tmpl. A user fn matches the args against its
// params; a builtin reads the args as a Tmpl directly.

function resolveExecTarget(node, env) {
  if (typeof node.head === 'string') {
    if (env.has(node.head)) {
      return { value: env.lookup(node.head), name: node.head };
    }
    if (Object.prototype.hasOwnProperty.call(builtins, node.head)) {
      return {
        value: { kind: 'Builtin', name: node.head, fn: builtins[node.head] },
        name: node.head,
      };
    }
    throw new PunkRuntimeError(
      `name '${node.head}' is not bound`, node.line, node.col,
    );
  }
  return { value: evalItem(node.head, env), name: null };
}

function evalExec(node, env) {
  let cur = resolveExecTarget(node, env);
  for (const seg of node.segments || []) {
    const next = walkSegment(cur, seg, node);
    if (next === null) {
      throw new PunkRuntimeError(
        `path step off the end while resolving call target`,
        node.line, node.col,
      );
    }
    cur = next;
  }
  const target = cur.value;
  const argsTmpl = node.args
    ? cascadeTmpl(node.args, env)
    : mkTmpl([]);

  return applyCallable(target, argsTmpl, env, node);
}

// Apply any callable value to an args Tmpl. Used by Exec, by !-cascade
// on Fn values, and by HOF builtins that want to invoke callbacks.
function applyCallable(target, argsTmpl, env, node) {
  if (target && target.kind === 'Builtin') {
    return target.fn(argsTmpl, env, { evalItem, cascadeTmpl, callFn: (fn, a, n) => applyCallable(fn, a, env, n) });
  }
  if (target && target.kind === 'Fn') {
    return callFn(target, argsTmpl, node);
  }
  if (target && target.kind === 'PartialFn') {
    const combined = mkTmpl([...target.prefilled, ...argsTmpl.items]);
    return applyCallable(target.target, combined, env, node);
  }
  if (target && target.kind === 'Tmpl') {
    return cascadeTmpl(target, env);
  }
  if (target && target.kind === 'Text') {
    return cascadeText(target, env);
  }
  throw new PunkRuntimeError(
    `cannot call a non-function value`, node && node.line, node && node.col,
  );
}

// Build a partial-application value. Mirrors Exec target resolution
// but doesn't call — captures (target, prefilled-args).
function evalPartial(node, env) {
  let cur = resolveExecTarget(node, env);
  for (const seg of node.segments || []) {
    const next = walkSegment(cur, seg, node);
    if (next === null) {
      throw new PunkRuntimeError(
        `path step off the end while resolving partial target`,
        node.line, node.col,
      );
    }
    cur = next;
  }
  const argsTmpl = node.args
    ? cascadeTmpl(node.args, env)
    : mkTmpl([]);
  return mkPartialFn(cur.value, argsTmpl.items);
}

function callFn(fn, args, node) {
  const bindings = match(args, fn.params);
  if (!bindings) {
    throw new PunkRuntimeError(
      `argument does not match function pattern`,
      node && node.line, node && node.col,
    );
  }
  const fnEnv = fn.env.child();
  // `_?` inside a fn body resolves to the whole args Tmpl passed in.
  fnEnv.bind('_', args, node);
  for (const [k, v] of bindings) fnEnv.bind(k, v, node);
  return cascadeBody(fn.body, fn.returnRange, fnEnv);
}

// Evaluate a Match node. Branches are tried top-to-bottom; the first
// pattern that matches wins.
//   - Predicate (body===null): TRUE on match, FALSE on miss.
//   - If-then (single branch with body): cascade body in matched env
//       on match, NULL on miss.
//   - Dispatch (multiple branches): on match, cascade matched body;
//       if no branch matches, runtime error.
// Subject is evaluated normally (Queries fire, Tmpls stay inert as a
// value to match against, etc.). Patterns operate on whatever the
// subject's value shape is; for non-Tmpl singletons the matcher
// wraps in a 1-item Tmpl so `(_)` etc. behave consistently.
function evalMatch(node, env) {
  const subject = evalItem(node.subject, env);
  const subjectAsTmpl = subject && subject.kind === 'Tmpl'
    ? subject
    : mkTmpl([subject]);

  const branches = node.branches;
  const isPredicate = branches.length === 1 && branches[0].body == null;

  for (const br of branches) {
    const bindings = match(subjectAsTmpl, br.pattern);
    if (bindings === null) continue;
    if (br.body == null) return TRUE;
    const m = env.child();
    for (const [k, v] of bindings) m.bind(k, v, node);
    return cascadeBody(br.body, null, m);
  }

  if (isPredicate) return FALSE;
  if (branches.length === 1) return NULL; // if-then miss
  throw new PunkRuntimeError(
    `no matching branch in dispatch`, node.line, node.col,
  );
}

// Evaluate ("cascade") the items of a body Tmpl in scope. Top-level
// items are reached (so Queries resolve, Execs run, Nameds bind).
// Nested Tmpls/Texts are also reached recursively: a `!` cascade
// resolves embedded queries and runs reached functions all the way
// down (per docs/punk-by-example.md § "When things actually run").
// When splicing a value into a parent Tmpl during cascade: a Tmpl
// result spreads ALL its items into the parent (composition). Other
// kinds stay as a single item.
function spreadIntoTmpl(node, out) {
  if (node && node.kind === 'Tmpl') {
    for (const it of node.items) out.push(it);
    return;
  }
  out.push(node);
}

function cascadeTmpl(tmpl, env) {
  const items = [];
  for (const it of tmpl.items) {
    if (it && it.kind === 'Tmpl') {
      // A literal sub-Tmpl in source stays as one item; cascade its
      // own children in scope.
      items.push(cascadeTmpl(it, env));
    } else if (it && it.kind === 'Text') {
      items.push(cascadeText(it, env));
    } else {
      // A Query/Exec/Named/etc. whose result is a Tmpl SPREADS into
      // the parent (composition rule).
      spreadIntoTmpl(evalItem(it, env), items);
    }
  }
  return mkTmpl(items);
}

function cascadeOne(node, env) {
  if (!node || typeof node !== 'object') return node;
  if (node.kind === 'Tmpl') return cascadeTmpl(node, env);
  if (node.kind === 'Text') return cascadeText(node, env);
  return evalItem(node, env);
}

function cascadeText(textNode, env) {
  const parts = [];
  for (const p of textNode.parts) {
    if ('lit' in p) { parts.push({ lit: p.lit }); continue; }
    const inner = cascadeTmpl(p.embed, env);
    // Stringify the resulting Tmpl into the text: spread items as
    // their textual forms, joined by single spaces.
    parts.push({ lit: stringifyForText(inner) });
  }
  return mkText(parts);
}

function stringifyForText(node) {
  if (!node) return '';
  if (node.kind === 'Word') return node.text;
  if (node.kind === 'Text') {
    // Inline a Text's parts as text (drop the quotes; embeds already
    // resolved at cascade time so they'd be lits, but be defensive).
    let s = '';
    for (const p of node.parts) {
      s += 'lit' in p ? p.lit : stringifyForText(p.embed);
    }
    return s;
  }
  if (node.kind === 'Tmpl') {
    return node.items.map(stringifyForText).join(' ');
  }
  // Fallback for unusual shapes — should be rare inside a cascade.
  return format(node);
}

// Apply the function-body return rule. A body Tmpl evaluates each
// item; a 1-item body returns that item directly; multi-item returns
// the whole Tmpl. A `returnRange` slices/picks from the items.
function cascadeBody(body, returnRange, env) {
  if (body.kind === 'Text') return cascadeText(body, env);
  if (body.kind !== 'Tmpl') return evalItem(body, env);

  // A 1-item body whose single item is a Text triggers a Text cascade
  // on that item (embeds are resolved). For other 1-item shapes the
  // item is evaluated and returned directly per the 1-item rule.
  if (body.items.length === 1 && body.items[0]
      && body.items[0].kind === 'Text' && !returnRange) {
    return cascadeText(body.items[0], env);
  }

  // Each body item cascades: nested Tmpls/Texts resolve their queries
  // (the body of a function is implicitly executed when the function
  // is called), but a nested Tmpl stays as one item (no spread into
  // the body's result list).
  const items = body.items.map((it) => cascadeOne(it, env));

  if (returnRange) {
    const { from, to } = returnRange;
    if (from == null && to == null) {
      return items.length ? items[items.length - 1] : NULL;
    }
    const len = items.length;
    const lo = from == null ? 1 : from;
    const hi = to == null ? len : to;
    const lo1 = Math.max(1, lo);
    const hi1 = Math.min(len, hi);
    if (hi1 < lo1) return mkTmpl([]);
    return mkTmpl(items.slice(lo1 - 1, hi1));
  }

  if (items.length === 1) return items[0];
  return mkTmpl(items);
}

// ---------- Top-level driver ----------

export function evalProgram(tree, env) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('evalProgram: expected a Tmpl root');
  }
  let last = NULL;
  for (const item of tree.items) {
    last = evalItem(item, env);
  }
  return last;
}
