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
import { builtins, builtinArity } from './builtins.js';
import { format } from './format.js';

// Arity of any callable (Fn / Builtin / PartialFn). Returns
//   { slots, variadic }  — for variadic, `slots` is the slot count
//                          including the variadic tail.
//   null                  — unknown (variadic builtin without metadata).
// Partials report their *remaining* arity (target minus what's already
// prefilled), preserving the target's variadic flag.
function getArity(callable) {
  if (!callable) return null;
  if (callable.kind === 'Fn') {
    const items = (callable.params && callable.params.items) || [];
    let variadic = false;
    for (const slot of items) {
      const inner = slot && slot.kind === 'Named' ? slot.value : slot;
      if (inner && inner.kind === 'Word' && inner.subkind === 'variadic') {
        variadic = true;
      }
    }
    return { slots: items.length, variadic };
  }
  if (callable.kind === 'Builtin') {
    const a = builtinArity[callable.name];
    return a ? { slots: a.slots, variadic: a.variadic } : null;
  }
  if (callable.kind === 'PartialFn') {
    const inner = getArity(callable.target);
    if (!inner) return null;
    const remaining = inner.slots - callable.prefilled.length;
    return { slots: Math.max(remaining, 0), variadic: inner.variadic };
  }
  return null;
}


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
    case 'Regex':
      return stripMeta(node);

    case 'Word':
      // Reserved-name Words resolve to their singleton runtime values.
      if (node.subkind === 'reserved') {
        if (node.text === 'NULL')  return NULL;
        if (node.text === 'TRUE')  return TRUE;
        if (node.text === 'FALSE') return FALSE;
      }
      return stripMeta(node);

    case 'Pipeline':
      // A non-execute pipeline is a composed-function value (returned
      // as-is). An execute=true pipeline runs now: stage[0] is the
      // initial value; each remaining stage is resolved as a callable
      // and applied to the running value.
      if (node.execute) return runPipeline(node, env, /*seed*/ null);
      return stripMeta(node);

    case 'Fn': {
      // Named-pattern splice: when the Fn's params Pattern contains a
      // single Query item (e.g. `(point?){body}`), resolve the query
      // and splice the resolved Pattern's slots in place. The named
      // pattern's slot names become visible in the body.
      let params = stripMeta(node.params);
      if (params && params.kind === 'Pattern'
          && params.items.length === 1
          && params.items[0] && params.items[0].kind === 'Query') {
        const resolved = evalItem(params.items[0], env);
        if (!resolved || resolved.kind !== 'Pattern') {
          throw new Error(
            `named-pattern reference must resolve to a Pattern, got ${resolved && resolved.kind}`,
          );
        }
        params = stripMeta(resolved);
      }
      return mkFn(
        params,
        stripMeta(node.body),
        env,
        node.returnRange || null,
      );
    }

    case 'Range':
      return expandRange(node);

    case 'Named': {
      let value;
      // `name:Q.?` — when the value side is a spread Query, we want the
      // FULL thing (Named-preserved). Mirrors the cascadeTmpl rule.
      if (node.value && node.value.kind === 'Query' && node.value.spread) {
        const full = evalQueryFull(node.value, env);
        if (full === null) {
          value = NULL;
        } else if (full.name != null) {
          value = { kind: 'Named', name: full.name, value: full.value };
        } else {
          value = full.value;
        }
      } else {
        value = evalItem(node.value, env);
      }
      // Short-form wrap: parse-time wrapWalk already wrapped syntactic
      // bare-Word values (`n:5` → `n:{5}`). Here we catch the dynamic
      // case: `c:X!{2 3}` where the value evaluates to a Word at
      // runtime. The same Word kinds (value/number/reserved) wrap to
      // a singleton Tmpl so queries through the name are uniform.
      if (value && value.kind === 'Word'
          && (value.subkind === 'value'
              || value.subkind === 'number'
              || value.subkind === 'reserved')) {
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

// Walk a stored string by *logical char*: an escape `\X` counts as
// one logical char (the 2-char string `\X`). Used so path indexing
// and length on a Text reflect what the user sees, not the raw
// storage byte count.
const logicalChars = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      out.push('\\' + s[i + 1]);
      i++;
    } else {
      out.push(ch);
    }
  }
  return out;
};

const textLogicalChars = (parts) => {
  const out = [];
  for (const p of parts) if ('lit' in p) out.push(...logicalChars(p.lit));
  return out;
};

// Length of a Text counts characters across its literal parts; embeds
// are not counted (they're unresolved templates). A `\X` escape
// counts as one character (the logical char model — see logicalChars).
const textLength = (parts) => textLogicalChars(parts).length;

const sliceText = (parts, lo, hi) => {
  const chars = textLogicalChars(parts);
  const start = Math.max(1, lo) - 1;
  const end   = Math.min(chars.length, hi);
  return mkText([{ lit: chars.slice(start, end).join('') }]);
};

// Apply one path segment. Returns { value, name } or null (meaning
// "fell off the end" — caller substitutes NULL).
function walkSegment(cur, seg, node, env) {
  // If the current value is itself a Named, unwrap to walk into its
  // value. The Named-name is reflected by the `:` segment (nameOf),
  // not by walking — so it doesn't leak into deeper steps here.
  let v = cur.value;
  if (v && v.kind === 'Named') v = v.value;
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
      if (v.kind === 'Fn') {
        // Element-tree path: index walks into the Fn body Tmpl.
        const body = v.body;
        if (!body || body.kind !== 'Tmpl') return null;
        if (n < 1 || n > body.items.length) return null;
        const item = body.items[n - 1];
        if (item && item.kind === 'Named') {
          return { value: item.value, name: item.name };
        }
        return { value: item, name: null };
      }
      if (v.kind === 'Text') {
        const chars = textLogicalChars(v.parts);
        if (n < 1 || n > chars.length) return null;
        return { value: mkText([{ lit: chars[n - 1] }]), name: null };
      }
      if (v.kind === 'Word' && v.subkind === 'number') {
        const s = v.text;
        if (n < 1 || n > s.length) return null;
        return { value: mkWord(s[n - 1], 'number'), name: null };
      }
      if (v.kind === 'Word') {
        const s = v.text;
        if (n < 1 || n > s.length) return null;
        return { value: mkWord(s[n - 1]), name: null };
      }
      return null;
    }
    case 'name': {
      if (v.kind === 'Tmpl') {
        for (const item of v.items) {
          if (item && item.kind === 'Named' && item.name === seg.text) {
            return { value: item.value, name: item.name };
          }
        }
        return null;
      }
      if (v.kind === 'Fn') {
        // Element-tree path: name reads an attribute (named slot in
        // the Fn's pattern).
        const params = v.params;
        if (params && params.kind === 'Pattern') {
          for (const item of params.items || []) {
            if (item && item.kind === 'Named' && item.name === seg.text) {
              return { value: item.value, name: item.name };
            }
          }
        }
        return null;
      }
      return null;
    }
    case 'length': {
      let n;
      if      (v.kind === 'Tmpl') n = v.items.length;
      else if (v.kind === 'Text') n = textLength(v.parts);
      else if (v.kind === 'Word') n = v.text.length;
      else return null;
      return { value: mkWord(String(n), 'number'), name: null };
    }
    case 'nameOf': {
      // Prefer the value's own Named name (data) over the binding name
      // (label). `x:Jan:{...}; x.:?` should give `Jan`, not `x`.
      const raw = cur.value;
      if (raw && raw.kind === 'Named') {
        return { value: mkWord(raw.name), name: null };
      }
      if (cur.name == null) return null;
      return { value: mkWord(cur.name), name: null };
    }
    case 'pattern': {
      if (v.kind !== 'Fn') return null;
      return { value: v.params, name: null };
    }
    case 'range': {
      const isNum  = v.kind === 'Word' && v.subkind === 'number';
      const isWord = v.kind === 'Word';
      const len =
        v.kind === 'Tmpl' ? v.items.length :
        v.kind === 'Text' ? textLength(v.parts) :
        isWord            ? v.text.length    : null;
      if (len == null) return null;
      if (seg.from === null && seg.to === null) {
        if (len === 0) return null;
        return walkSegment(cur, { kind: 'index', n: len }, node, env);
      }
      const from = seg.from === null ? 1   : seg.from;
      const to   = seg.to   === null ? len : seg.to;
      if (v.kind === 'Tmpl') return { value: sliceTmpl(v.items, from, to), name: null };
      if (isWord) {
        const lo = Math.max(1, from), hi = Math.min(len, to);
        if (lo > hi) return null;
        return { value: mkWord(v.text.slice(lo - 1, hi), isNum ? 'number' : 'value'), name: null };
      }
      return { value: sliceText(v.parts, from, to), name: null };
    }
    case 'dynamic': {
      // The parser wraps the user's expression in a Tmpl. Evaluate
      // by cascading (so embedded Queries / Execs actually resolve)
      // and then unwrap the single-item result.
      const t = cascadeTmpl(seg.expr, env);
      if (!t || t.kind !== 'Tmpl' || t.items.length !== 1) {
        throw new PunkRuntimeError(
          `dynamic path step must resolve to a single value`,
          node.line, node.col,
        );
      }
      const only = t.items[0];
      let r = (only && only.kind === 'Named') ? only.value : only;
      // Unwrap short-form singleton tmpl (a bare-bound `n:1` evaluates
      // to `{1}` under the short-form rule).
      if (r && r.kind === 'Tmpl' && r.items.length === 1) {
        const inner = r.items[0];
        r = (inner && inner.kind === 'Named') ? inner.value : inner;
      }
      if (!r) return null;
      if (r.kind === 'Word' && r.subkind === 'number') {
        const n = parseInt(r.text, 10);
        if (!Number.isFinite(n)) {
          throw new PunkRuntimeError(
            `dynamic path step resolved to non-integer number '${r.text}'`,
            node.line, node.col,
          );
        }
        return walkSegment(cur, { kind: 'index', n }, node, env);
      }
      if (r.kind === 'Word') {
        return walkSegment(cur, { kind: 'name', text: r.text }, node, env);
      }
      if (r.kind === 'Text') {
        const s = textLogicalChars(r.parts).join('');
        return walkSegment(cur, { kind: 'name', text: s }, node, env);
      }
      throw new PunkRuntimeError(
        `dynamic path step must resolve to a name or number (got ${r.kind})`,
        node.line, node.col,
      );
    }
    default:
      throw new PunkRuntimeError(
        `unknown path segment '${seg.kind}'`, node.line, node.col,
      );
  }
}

function evalQuery(node, env) {
  const result = evalQueryFull(node, env);
  if (result === null) return NULL;
  return result.value;
}

// Like evalQuery, but returns { value, name } so callers can reconstruct
// the original Named (for `.?` spread semantics). Returns null on
// off-the-end walks.
function evalQueryFull(node, env) {
  const segments = node.segments || [];
  let cur;
  if (typeof node.head === 'string') {
    if (env.has(node.head)) {
      const bound = env.lookup(node.head);
      // If the bound value is itself a Named (e.g. map iteration of a
      // Named item, or `x:a:5`), unwrap: the data-name takes precedence
      // over the binding-name. `team?` returns the inner value; `team.:?`
      // reflects on the Named's name; `team.?` reconstructs the full
      // Named pair.
      if (bound && bound.kind === 'Named') {
        cur = { value: bound.value, name: bound.name };
      } else {
        cur = { value: bound, name: node.head };
      }
    } else if (Object.prototype.hasOwnProperty.call(builtins, node.head)) {
      cur = {
        value: { kind: 'Builtin', name: node.head, fn: builtins[node.head] },
        name: node.head,
      };
    } else {
      if (segments.length === 0) return null;
      throw new PunkRuntimeError(
        `name '${node.head}' is not bound`, node.line, node.col,
      );
    }
  } else {
    cur = { value: evalItem(node.head, env), name: null };
  }
  for (const seg of segments) {
    const next = walkSegment(cur, seg, node, env);
    if (next === null) return null;
    cur = next;
  }
  return cur;
}

// ---------- Exec / function call ----------
//
// `name!args` looks up `name`, resolves any path segments, and then
// calls the resulting function (user Fn or builtin) with the
// (cascaded) args Tmpl. A user fn matches the args against its
// params; a builtin reads the args as a Tmpl directly.

// Auto-dereference a chain head ending in `?`: after the initial lookup,
// if the resulting value is a Word that names another binding in scope,
// follow that binding too. Lets `p?.print!` resolve when `p` is bound to
// the Word `printer` and `printer` itself names a tmpl.
function derefHeadWord(cur, env) {
  let v = cur.value;
  let name = cur.name;
  while (v && v.kind === 'Word' && v.subkind !== 'number' && env.has(v.text)) {
    name = v.text;
    v = env.lookup(v.text);
  }
  return { value: v, name };
}

function resolveHeadName(head, node, env) {
  let derefWord = false;
  let name = head;
  if (name.endsWith('?')) {
    derefWord = true;
    name = name.slice(0, -1);
  }
  let cur;
  if (env.has(name)) {
    const bound = env.lookup(name);
    if (bound && bound.kind === 'Named') {
      cur = { value: bound.value, name: bound.name };
    } else {
      cur = { value: bound, name };
    }
  } else if (Object.prototype.hasOwnProperty.call(builtins, name)) {
    cur = {
      value: { kind: 'Builtin', name, fn: builtins[name] },
      name,
    };
  } else {
    throw new PunkRuntimeError(
      `name '${name}' is not bound`, node.line, node.col,
    );
  }
  if (derefWord) cur = derefHeadWord(cur, env);
  return cur;
}

function resolveExecTarget(node, env) {
  if (typeof node.head === 'string') {
    return resolveHeadName(node.head, node, env);
  }
  let cur = { value: evalItem(node.head, env), name: null };
  // If the head is a Query with no segments (a bare `name?`) and the
  // resolved value is a Word that itself names a binding, follow that
  // binding — same as the head-name deref path for `name?.foo!`.
  if (node.head && node.head.kind === 'Query'
      && (!node.head.segments || node.head.segments.length === 0)) {
    cur = derefHeadWord(cur, env);
  }
  return cur;
}

function evalExec(node, env) {
  let cur = resolveExecTarget(node, env);
  for (const seg of node.segments || []) {
    const next = walkSegment(cur, seg, node, env);
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
    return target.fn(argsTmpl, env, { evalItem, cascadeTmpl, callFn: (fn, a, n) => applyCallable(fn, a, env, n), node });
  }
  if (target && target.kind === 'Fn') {
    // A Fn extracted from an inert Tmpl (literal binding like
    // `printer:{print:(...){...}}`) carries no captured env — its body
    // was never evalItem'd. Bind it lazily to the caller's env so the
    // call site at least sees outer scope and builtins.
    const fn = target.env ? target : { ...target, env };
    return callFn(fn, argsTmpl, node);
  }
  if (target && target.kind === 'PartialFn') {
    const arity = getArity(target.target);
    if (!arity || arity.variadic) {
      // Unknown arity, or target is variadic — spread args (today's behaviour).
      const combined = mkTmpl([...target.prefilled, ...argsTmpl.items]);
      return applyCallable(target.target, combined, env, node);
    }
    const remaining = arity.slots - target.prefilled.length;
    if (remaining <= 0) {
      // Fully prefilled — call must be no-arg.
      if (argsTmpl.items.length !== 0) {
        throw new PunkRuntimeError(
          `fully-prefilled partial takes no further arguments, got ${argsTmpl.items.length}`,
          node && node.line, node && node.col,
        );
      }
      return applyCallable(target.target, mkTmpl(target.prefilled), env, node);
    }
    let combinedItems;
    if (remaining === 1) {
      // One slot left. The caller supplied exactly one value for it.
      // Direct calls cascade their args, so a Tmpl literal in source
      // spreads its queries into argsTmpl.items; the slot then receives
      // the full argsTmpl as that single value. Pipeline calls wrap the
      // piped value in a single-item argsTmpl; the slot must receive
      // the wrapped value, not the wrapper.
      if (argsTmpl.items.length === 1) {
        combinedItems = [...target.prefilled, argsTmpl.items[0]];
      } else {
        combinedItems = [...target.prefilled, argsTmpl];
      }
    } else {
      // Multiple slots left — spread items, count must match.
      if (argsTmpl.items.length !== remaining) {
        throw new PunkRuntimeError(
          `partial expects ${remaining} further argument${remaining === 1 ? '' : 's'}, got ${argsTmpl.items.length}`,
          node && node.line, node && node.col,
        );
      }
      combinedItems = [...target.prefilled, ...argsTmpl.items];
    }
    return applyCallable(target.target, mkTmpl(combinedItems), env, node);
  }
  if (target && target.kind === 'Pipeline') {
    // A composed pipeline (execute=false) is callable: feed the args
    // through its stages. Calling convention: the single arg becomes
    // the seed value (so `clean!Hello` is equivalent to `Hello->clean!`).
    const items = argsTmpl.items;
    if (items.length !== 1) {
      throw new PunkRuntimeError(
        `a composed pipeline takes exactly one argument`,
        node && node.line, node && node.col,
      );
    }
    return runPipeline(target, env, items[0]);
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

// Run a Pipeline. When `seed` is non-null, every stage is treated as a
// callable applied left-to-right with `seed` as the running value. When
// `seed` is null, stage[0] is evaluated as the initial value and the
// remaining stages are callables. A stage that is a bare value-Word is
// resolved via env lookup (the user's "references are assumed to be
// functions" rule); a Query stage is evaluated; anything else is taken
// as a value and must already be a callable.
function runPipeline(node, env, seed) {
  const stages = node.stages;
  let current;
  let i;
  if (seed !== null) {
    current = seed;
    i = 0;
  } else {
    const s0 = stages[0];
    if (s0 && s0.kind === 'Box') {
      // Reading a box as the initial value of a pipeline.
      current = readBox(s0, env);
    } else {
      current = cascadeOne(s0, env);
    }
    i = 1;
  }
  for (; i < stages.length; i++) {
    const stage = stages[i];
    if (stage && stage.kind === 'Box') {
      // Writing the running value into the box; the value passes
      // through unchanged so further stages still see it.
      writeBox(stage, current, env);
      continue;
    }
    const callable = resolveStageCallable(stage, env);
    current = applyCallable(callable, mkTmpl([current]), env, stage);
  }
  return current;
}

function readBox(boxNode, env) {
  const store = env.rootBoxes();
  if (!store.has(boxNode.name)) {
    throw new PunkRuntimeError(
      `box '[${boxNode.name}]' has not been written to`,
      boxNode.line, boxNode.col,
    );
  }
  return store.get(boxNode.name);
}

function writeBox(boxNode, value, env) {
  env.rootBoxes().set(boxNode.name, value);
}

function resolveStageCallable(stage, env) {
  if (stage && stage.kind === 'Word' && stage.subkind === 'value') {
    // bare name — look it up like an Exec head.
    return resolveCallableName(stage.text, stage, env);
  }
  if (stage && stage.kind === 'Exec' && stage.segments.length === 0 && !stage.args) {
    // A bare `foo!` at the end of a pipeline is the trigger; the
    // Exec node names the callable, it doesn't run on its own.
    return resolveCallableName(stage.head, stage, env);
  }
  // Everything else: evaluate and trust the result is callable.
  return evalItem(stage, env);
}

function resolveCallableName(name, stage, env) {
  const found = env.lookup(name);
  if (found !== undefined) return found;
  if (Object.prototype.hasOwnProperty.call(builtins, name)) {
    return { kind: 'Builtin', name, fn: builtins[name] };
  }
  throw new PunkRuntimeError(
    `name '${name}' is not bound`, stage.line, stage.col,
  );
}

// Build a partial-application value. Mirrors Exec target resolution
// but doesn't call — captures (target, prefilled-args).
function evalPartial(node, env) {
  let cur = resolveExecTarget(node, env);
  for (const seg of node.segments || []) {
    const next = walkSegment(cur, seg, node, env);
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
  const prefilled = argsTmpl.items;
  const arity = getArity(cur.value);
  if (arity && !arity.variadic && prefilled.length > arity.slots) {
    throw new PunkRuntimeError(
      `partial prefills ${prefilled.length} args but target only takes ${arity.slots}`,
      node.line, node.col,
    );
  }
  return mkPartialFn(cur.value, prefilled);
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
  fnEnv.bind('*', args, node);
  // Pattern slots are shape-checks, not Named bindings: the RHS of a
  // slot is `_`/`*`/literal/ref? and is NEVER short-form wrapped.
  // Bind whatever value matched the slot directly.
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
    // Pattern slots are shape-checks, not Named bindings — RHS is
    // never wrapped. Bind matched values directly.
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
//
// Placement rules (P1 — uniform query model):
//   - `?` (Query/Exec/Named/etc.): the result lands as ONE item in the
//     parent — never spread. A Tmpl value lands NESTED.
//   - `.?` (Query with spread flag): the FULL thing inlines into the
//     parent — Named lands as Named (name kept); an unwrapped Tmpl
//     drops its `{}` and its items spread inline; bare items are
//     identity.
function spreadFull(items, full, env) {
  // `full` is { value, name } from evalQueryFull.
  if (full.name != null) {
    items.push({ kind: 'Named', name: full.name, value: full.value });
    return;
  }
  const v = full.value;
  if (v && v.kind === 'Tmpl') {
    // Spread items but evaluate each — a referenced tmpl may hold
    // unresolved Exec/Query items that must run when used.
    for (const it of v.items) {
      if (env && it && (it.kind === 'Exec' || it.kind === 'Query' || it.kind === 'Pipeline')) {
        items.push(evalItem(it, env));
      } else {
        items.push(it);
      }
    }
    return;
  }
  items.push(v);
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
    } else if (it && it.kind === 'Query' && it.spread) {
      const full = evalQueryFull(it, env);
      if (full === null) { items.push(NULL); continue; }
      spreadFull(items, full, env);
    } else if (it && it.kind === 'Named') {
      // Named-item INSIDE a tmpl literal is a data pair, NOT a binding
      // into outer scope. Evaluate the value side; do not env.bind.
      items.push({ kind: 'Named', name: it.name, value: evalDataValue(it.value, env) });
    } else {
      // Query/Exec/etc. results land as ONE item — no spread.
      items.push(evalItem(it, env));
    }
  }
  return mkTmpl(items);
}

// Evaluate the value side of a Named pair WITHOUT binding into env.
// Used for data-Named items inside tmpl literals — they are tagged
// pairs, not bindings. Short-form wrapping is done at parse-time
// (see parse.js passResolveNamed); nothing extra to do here.
function evalDataValue(node, env) {
  if (!node || typeof node !== 'object') return node;
  if (node.kind === 'Tmpl') return cascadeTmpl(node, env);
  if (node.kind === 'Text') return cascadeText(node, env);
  if (node.kind === 'Query' && node.spread) {
    const full = evalQueryFull(node, env);
    if (full === null) return NULL;
    if (full.name != null) return { kind: 'Named', name: full.name, value: full.value };
    return full.value;
  }
  return evalItem(node, env);
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
    // Splice the embed's result into the surrounding Text. `stringifyForText`
    // gives us the chars-of-the-string (escapes resolved); we then re-encode
    // for Text-lit storage so the resulting Text is well-formed source.
    parts.push({ lit: escapeForText(stringifyForText(inner)) });
  }
  return mkText(parts);
}

// Resolve `\X` escape sequences to actual chars. `\n` → newline,
// `\t` → tab, any other `\X` → bare X. Used when converting a value
// to the chars-of-a-string that get spliced into a Text.
function resolveEscapes(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      if (nx === 'n') out += '\n';
      else if (nx === 't') out += '\t';
      else out += nx;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

// Pre-escape a JS char-string for safe storage inside a Text-lit.
// Only `{`, `}`, `\`, `"` are structural inside `"..."` and so need
// a `\` prefix in storage; every other char survives verbatim.
function escapeForText(s) {
  let out = '';
  for (const ch of s) {
    if (ch === '{' || ch === '}' || ch === '"' || ch === '\\') out += '\\' + ch;
    else out += ch;
  }
  return out;
}

function stringifyForText(node) {
  if (!node) return '';
  if (node.kind === 'Word') return resolveEscapes(node.text);
  if (node.kind === 'Text') {
    // Already a Text — its lit parts are in text-lit-storage form, so
    // resolve them back to chars-of-the-string.
    let s = '';
    for (const p of node.parts) {
      s += 'lit' in p ? resolveEscapes(p.lit) : stringifyForText(p.embed);
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

  // A function's body IS a template. Calling the function evaluates
  // the body's items and returns the result template — no unwrap,
  // even for a 1-item body. Callers inline with `.?` if they want
  // the items spliced into the surrounding template.
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

// Same as `evalProgram` but returns every top-level item's value
// wrapped in a Tmpl — the natural semantics for REPL submissions, as
// if the user had typed `{ ... }!`. Bindings still mutate `env` so
// they persist across submissions.
//
// Special case: if there is exactly one top-level item and its value
// is already a Tmpl, return that value as-is. Tmpls don't get
// re-wrapped — a value already "inside a template" doesn't need
// another wrapper.
export function evalProgramAsTmpl(tree, env) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('evalProgramAsTmpl: expected a Tmpl root');
  }
  const items = [];
  for (const item of tree.items) {
    items.push(evalItem(item, env));
  }
  if (items.length === 1 && items[0] && items[0].kind === 'Tmpl') {
    return items[0];
  }
  return mkTmpl(items);
}
