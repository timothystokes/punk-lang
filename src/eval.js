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
import { mkTmpl, mkText, mkWord, mkFn, NULL } from './values.js';
import { match } from './match.js';
import { builtins } from './builtins.js';

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

    case 'Partial':
      throw new PunkRuntimeError(
        `evaluation of '${node.kind}' is not yet implemented`,
        node.line, node.col,
      );

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

  if (target && target.kind === 'Builtin') {
    return target.fn(argsTmpl, env, { evalItem, cascadeTmpl });
  }
  if (target && target.kind === 'Fn') {
    return callFn(target, argsTmpl, node);
  }
  throw new PunkRuntimeError(
    `cannot call a non-function value`, node.line, node.col,
  );
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
  for (const [k, v] of bindings) fnEnv.bind(k, v, node);
  return cascadeBody(fn.body, fn.returnRange, fnEnv);
}

// Evaluate ("cascade") the items of a body Tmpl in scope. Top-level
// items are reached (so Queries resolve, Execs run, Nameds bind).
// Nested Tmpl/Text values remain inert.
function cascadeTmpl(tmpl, env) {
  const items = tmpl.items.map((it) => evalItem(it, env));
  return mkTmpl(items);
}

function cascadeText(textNode, env) {
  const parts = textNode.parts.map((p) => {
    if ('lit' in p) return { lit: p.lit };
    // An embed is a Tmpl node containing the things to splice in.
    const inner = cascadeTmpl(p.embed, env);
    // If the embed reduces to a single textual word/text, splice as text;
    // otherwise format the whole tmpl content into the text.
    if (inner.items.length === 1) {
      const it = inner.items[0];
      if (it && it.kind === 'Word') return { lit: it.text };
      if (it && it.kind === 'Text') {
        // splice its parts in
        return null; // handled below by flattening
      }
    }
    return { embed: inner };
  });
  // Drop nulls (we never produced any above except the splice case).
  return mkText(parts.filter((p) => p !== null));
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

  const items = body.items.map((it) => evalItem(it, env));

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
