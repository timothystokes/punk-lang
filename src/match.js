// Pattern matcher.
//
//   matchPattern(patternNode, value, env) -> env | null
//
// A pattern describes a shape. Given a target value and an env, the matcher
// returns either:
//   - an extended env (success) — with any named slots bound, OR
//   - null (no match).
//
// The target is treated as a template: a scalar coerces to a 1-item list so
// `(_)` matches `42` the same way it matches `{42}`.
//
// Names on slots are local bindings, NOT match keys. `(name:John)` means
// "first slot is the literal John; if it matches, bind 'name' locally to
// the matched item". Names don't filter; only the shape on the right of `:`
// does. This is the rule called out in the docs.
//
// Slot kinds handled:
//   _            wildcard, matches one item, no binding
//   ___          variadic, matches zero or more items
//   <Word>       literal (number/text/TRUE/FALSE/NULL), strict equality
//   (...)        nested pattern (recurse into the item, which must be a tmpl)
//   "..."        regex slot — text-matched; capture groups bind a tmpl
//   name:<slot>  any of the above, with a local binding for the matched item
//   name:        followed by next slot (split across two AST words, since the
//                value side wasn't attached)

import {
  isTmpl, isText, isNum, isNamed, isBool, isNull,
  tmpl, named, text, num, equals, formatValue, NULL,
} from './values.js';
import { extend } from './env.js';
import {
  evalItem,
  forceTmplItems,
  endsWithBareColon,
  splitEmbeddedBind,
} from './eval.js';

export function matchPattern(patternNode, value, env) {
  if (patternNode.type !== 'Pattern') {
    throw new Error(`matchPattern: not a Pattern node`);
  }
  const items = targetItems(value);
  return matchSlots(patternNode.items, items, env);
}

// Coerce the target into a list of items. A tmpl exposes its content;
// anything else is treated as a single-item list. NamedThings inside a
// list are kept as-is — `unwrap` happens at each slot-match site so the
// matcher can compare against the value but a slot can still bind the
// NamedThing if needed later.
function targetItems(v) {
  if (isTmpl(v)) return forceTmplItems(v);
  return [v];
}

function matchSlots(rawSlots, items, env) {
  const slots = compactSlots(rawSlots.map(normalizeSlot));

  // At most one variadic.
  const varCount = slots.filter(s => s.kind === 'variadic').length;
  if (varCount > 1) {
    throw new Error(`only one ___ slot allowed per pattern`);
  }
  const varIdx = slots.findIndex(s => s.kind === 'variadic');

  if (varIdx === -1) {
    if (items.length !== slots.length) return null;
    return matchFixed(slots, items, env);
  }

  const pre  = slots.slice(0, varIdx);
  const post = slots.slice(varIdx + 1);
  const varSlot = slots[varIdx];
  if (items.length < pre.length + post.length) return null;

  let e = matchFixed(pre, items.slice(0, pre.length), env);
  if (!e) return null;

  const midItems = items.slice(pre.length, items.length - post.length);
  if (varSlot.name) {
    e = extend(e, { [varSlot.name]: tmpl(midItems, null) });
  }

  return matchFixed(post, items.slice(items.length - post.length), e);
}

// Collapse a `name:` slot (Word ending in bare colon) with the next slot
// into a single named slot. Mirrors the way evalSequence handles
// `welcome: {hi}` across two tokens.
function compactSlots(slots) {
  const out = [];
  let i = 0;
  while (i < slots.length) {
    const s = slots[i];
    if (s.kind === 'name-bind') {
      const next = slots[i + 1];
      if (!next) throw new Error(`dangling '${s.name}:' slot`);
      if (next.kind === 'name-bind') {
        throw new Error(`two consecutive name-binds: '${s.name}:' then '${next.name}:'`);
      }
      out.push({ ...next, name: s.name });
      i += 2;
    } else {
      out.push(s);
      i++;
    }
  }
  return out;
}

function normalizeSlot(node) {
  if (node.type === 'Pattern')  return { kind: 'pattern', node };
  if (node.type === 'Regex')    return { kind: 'regex',   node };
  if (node.type === 'Template') return { kind: 'template', node };
  if (node.type === 'Word') {
    // Bare wildcards.
    if (isBareWildcard(node, '_'))   return { kind: 'wild' };
    if (isBareWildcard(node, '___')) return { kind: 'variadic' };

    // `name:` — must consume the next slot as its value.
    if (endsWithBareColon(node)) {
      return { kind: 'name-bind', name: node.text.slice(0, -1) };
    }

    // `name:value` — embedded bare colon splits the Word.
    const split = splitEmbeddedBind(node);
    if (split) {
      const valueNode = split.valueNode;
      // Re-normalize the value side as if it were the whole slot.
      const inner = normalizeSlot(valueNode);
      if (inner.kind === 'name-bind' || inner.kind === 'variadic') {
        // `name:___` is meaningful (named variadic). `name:other:` is not.
        if (inner.kind === 'variadic') return { kind: 'variadic', name: split.name };
        throw new Error(`unexpected name-bind in value of '${split.name}:'`);
      }
      return { ...inner, name: split.name };
    }

    return { kind: 'literal', node };
  }
  if (node.type === 'Function') {
    throw new Error(`Functions can't appear inside a pattern`);
  }
  throw new Error(`unknown slot node type: ${node.type}`);
}

function isBareWildcard(node, want) {
  if (node.text !== want) return false;
  for (let i = 0; i < node.esc.length; i++) {
    if (node.esc[i]) return false;
  }
  return true;
}

function matchFixed(slots, items, env) {
  let e = env;
  for (let i = 0; i < slots.length; i++) {
    e = matchOne(slots[i], items[i], e);
    if (!e) return null;
  }
  return e;
}

// Match one slot against one item. Returns extended env or null.
// Named slots bind the UNWRAPPED value (so a NamedThing target binds the
// inner value, not the wrapper) — the docs say names are local bindings,
// not match keys.
function matchOne(slot, rawItem, env) {
  const item = unwrap(rawItem);

  switch (slot.kind) {
    case 'wild':
      return bind(env, slot.name, item);

    case 'variadic':
      // Should be handled by matchSlots, never reaches a single-item match.
      throw new Error(`variadic slot in fixed position`);

    case 'literal': {
      const lit = evalItem(slot.node, env).value;
      if (!equals(lit, item)) return null;
      return bind(env, slot.name, item);
    }

    case 'template': {
      const lit = evalItem(slot.node, env).value;
      if (!equals(lit, item)) return null;
      return bind(env, slot.name, item);
    }

    case 'pattern': {
      // Nested pattern: the item must be a tmpl (or coerced to one).
      const sub = matchPattern(slot.node, item, env);
      if (!sub) return null;
      return bind(sub, slot.name, item);
    }

    case 'regex': {
      const txt = textOf(item);
      if (txt === null) return null;
      const re = new RegExp(slot.node.pattern);
      const m  = re.exec(txt);
      if (!m) return null;
      const bound = bindFromRegexMatch(m, item);
      return bind(env, slot.name, bound);
    }

    default:
      throw new Error(`unhandled slot kind: ${slot.kind}`);
  }
}

// If a regex has no capture groups, bind the original item (text or num).
// If it has capture groups, bind a tmpl: {fullMatch g1 g2 ...} with named
// groups appended as NamedThings (so `.name?` reaches them too).
function bindFromRegexMatch(m, originalItem) {
  if (m.length === 1 && !m.groups) return originalItem;
  const items = [];
  for (let i = 0; i < m.length; i++) {
    items.push(m[i] === undefined ? NULL : text(m[i]));
  }
  if (m.groups) {
    for (const [k, v] of Object.entries(m.groups)) {
      if (v !== undefined) items.push(named(k, text(v)));
    }
  }
  return tmpl(items, null);
}

function bind(env, name, value) {
  if (!name) return env;
  return extend(env, { [name]: value });
}

function unwrap(v) {
  return isNamed(v) ? v.value : v;
}

function textOf(v) {
  if (isText(v)) return v.value;
  if (isNum(v))  return formatValue(v);
  if (isBool(v)) return v.value ? 'TRUE' : 'FALSE';
  if (isNull(v)) return 'NULL';
  return null;
}
