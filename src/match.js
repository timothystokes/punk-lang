// Pattern matching.
//
// `match(value, pattern)` returns a Map of name -> value if `value`
// matches the structural shape described by `pattern`. Returns null
// on no match.
//
// Patterns describe shape; names in a pattern are bindings, not part
// of the contract. `(name:_)` binds a wildcard slot to a name;
// `(_)` does the same shape match without binding.
//
// Slot kinds inside a Pattern:
//   - `_`          wildcard, 1 item
//   - `___`        variadic, 0+ items (greedy under positional constraint)
//   - bare literal Word/Number/Reserved — must equal that value
//   - nested Pattern — the slot value must be a Tmpl matching the pattern
//   - Named slot {name, inner}: match `inner`, bind `name` to the matched value
//
// Patterns only apply to Tmpl values (the only shape with items).
// Matching a non-Tmpl against a Pattern always fails.

import { equals } from './values.js';
import { slotInfo, slotName, slotIsRest, isPureWildcard } from './slot.js';

const bind = (bindings, name, value) => {
  if (bindings.has(name)) {
    if (!equals(bindings.get(name), value)) return false;
  } else {
    bindings.set(name, value);
  }
  return true;
};

// Render a value to the string used for regex matching: Text → its
// rendered chars; Word → its text; everything else → null (no match).
function itemAsString(v) {
  if (!v) return null;
  if (v.kind === 'Word') return v.text;
  if (v.kind === 'Text') {
    // Text parts are either lit strings or embedded sub-tmpls. For
    // pattern matching we only support a pure-literal Text. Anything
    // with an embed is not a single concrete string.
    let s = '';
    for (const p of v.parts) {
      if ('lit' in p) s += p.lit;
      else return null;
    }
    // Resolve `\X` escapes in the lit chars (\n → newline, etc.).
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) {
        const n = s[i + 1];
        if (n === 'n') out += '\n';
        else if (n === 't') out += '\t';
        else out += n;
        i++;
      } else out += c;
    }
    return out;
  }
  return null;
}

// Build the Tmpl that a named regex slot binds to: first item is the
// full match, followed by one item per capture group. Named groups
// become Named items in the same position.
function regexMatchTmpl(execResult, regex) {
  const items = [];
  const mkText = (s) => ({ kind: 'Text', parts: [{ lit: s }] });
  items.push(mkText(execResult[0]));
  const names = [];
  const nameRe = /\(\?<([A-Za-z_][A-Za-z0-9_]*)>/g;
  let m;
  while ((m = nameRe.exec(regex.source)) !== null) names.push(m[1]);
  for (let g = 1; g < execResult.length; g++) {
    const text = execResult[g] === undefined ? '' : execResult[g];
    const value = mkText(text);
    let groupName = null;
    if (execResult.groups) {
      for (const k of Object.keys(execResult.groups)) {
        if (execResult.groups[k] === execResult[g] && names.includes(k)) {
          groupName = k;
          break;
        }
      }
    }
    if (groupName) {
      items.push({ kind: 'Named', name: groupName, value });
    } else {
      items.push(value);
    }
  }
  return { kind: 'Tmpl', items };
}

// Match a single value-item against a single (non-variadic) pattern
// slot. Returns true (and mutates bindings) or false.
function matchSlot(item, slot, bindings) {
  // Names aren't part of the contract — if the item is Named, unwrap it
  // so its shape (and value) drives matching uniformly.
  const unwrapped = item && item.kind === 'Named' ? item.value : item;
  const info = slotInfo(slot);
  // Regex-named slot: `n:/.../` binds n to [full, ...groups].
  if (info.name != null && info.inner && info.inner.kind === 'Regex') {
    const s = itemAsString(unwrapped);
    if (s === null) return false;
    let re;
    try { re = new RegExp(info.inner.body, info.inner.flags || ''); }
    catch { return false; }
    const r = re.exec(s);
    if (!r) return false;
    return bind(bindings, info.name, regexMatchTmpl(r, re));
  }
  // Named slot with inner shape: match inner, then bind name to ORIGINAL
  // (Named-preserved) item so reflection via `.:?` can see the name.
  if (info.name != null) {
    if (info.inner === null) {
      // `x:_` — wildcard binding
      return bind(bindings, info.name, item);
    }
    if (!matchSlot(unwrapped, info.inner, bindings)) return false;
    return bind(bindings, info.name, item);
  }
  // Unnamed slot:
  if (info.inner === null) return true; // bare `_`
  if (info.inner.kind === 'Regex') {
    const s = itemAsString(unwrapped);
    if (s === null) return false;
    try {
      const re = new RegExp(info.inner.body, info.inner.flags || '');
      return re.test(s);
    } catch { return false; }
  }
  if (info.inner.kind === 'Pattern') {
    if (!unwrapped || unwrapped.kind !== 'Tmpl') return false;
    return matchPatternItems(unwrapped.items, info.inner.items, bindings);
  }
  // Bare literal — exact value equality. Auto-wrap means runtime values
  // are often a singleton Tmpl (e.g. `{GET}` for `method:GET`); unwrap
  // for the equality check so pattern literals (parsed as bare Words)
  // still match.
  let cmp = unwrapped;
  if (cmp && cmp.kind === 'Tmpl' && cmp.items.length === 1) {
    cmp = cmp.items[0];
  }
  return equals(cmp, info.inner);
}

function matchPatternItems(items, slots, bindings) {
  // Variadic, if present, is always the LAST slot (parseValidate enforces).
  const lastIdx = slots.length - 1;
  const hasVariadic = slots.length > 0 && slotIsRest(slots[lastIdx]);

  if (!hasVariadic) {
    if (items.length !== slots.length) return false;
    for (let i = 0; i < items.length; i++) {
      if (!matchSlot(items[i], slots[i], bindings)) return false;
    }
    // Single-slot raw wildcard `(_)` also binds `_` so `_?` can resolve it.
    if (slots.length === 1 && isPureWildcard(slots[0]) && slotName(slots[0]) === null) {
      bind(bindings, '_', items[0]);
    }
    return true;
  }

  const head = slots.slice(0, lastIdx);
  if (items.length < head.length) return false;

  for (let i = 0; i < head.length; i++) {
    if (!matchSlot(items[i], head[i], bindings)) return false;
  }
  // Trailing variadic captures everything left over. Bind to a Tmpl of
  // those items if named.
  const restName = slotName(slots[lastIdx]);
  if (restName != null) {
    const captured = items.slice(head.length);
    if (!bind(bindings, restName, { kind: 'Tmpl', items: captured })) return false;
  }
  return true;
}

export function match(value, pattern) {
  if (!pattern || pattern.kind !== 'Pattern') {
    throw new TypeError('match: second arg must be a Pattern');
  }
  if (!value || value.kind !== 'Tmpl') return null;
  const bindings = new Map();
  if (!matchPatternItems(value.items, pattern.items, bindings)) return null;
  return bindings;
}
