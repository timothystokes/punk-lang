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

const isWildcard = (n) => n && n.kind === 'Word' && n.subkind === 'wildcard';
const isVariadic = (n) => n && n.kind === 'Word' && n.subkind === 'variadic';

const slotInner = (slot) => slot.kind === 'Named' ? slot.value : slot;

const bind = (bindings, name, value) => {
  if (bindings.has(name)) {
    if (!equals(bindings.get(name), value)) return false;
  } else {
    bindings.set(name, value);
  }
  return true;
};

// Match a single value-item against a single (non-variadic) pattern
// slot. Returns true (and mutates bindings) or false.
function matchSlot(item, slot, bindings) {
  // Names aren't part of the contract — if the item is Named, unwrap it
  // so its shape (and value) drives matching uniformly.
  const unwrapped = item && item.kind === 'Named' ? item.value : item;
  if (slot.kind === 'Named') {
    if (!matchSlot(unwrapped, slot.value, bindings)) return false;
    return bind(bindings, slot.name, unwrapped);
  }
  if (isWildcard(slot)) return true;
  if (slot.kind === 'Pattern') {
    if (!unwrapped || unwrapped.kind !== 'Tmpl') return false;
    return matchPatternItems(unwrapped.items, slot.items, bindings);
  }
  // Bare literal — exact value equality.
  return equals(unwrapped, slot);
}

function matchPatternItems(items, slots, bindings) {
  // Find variadic position (at most one — parseValidate enforces).
  let varIdx = -1;
  for (let i = 0; i < slots.length; i++) {
    const inner = slotInner(slots[i]);
    if (isVariadic(inner)) { varIdx = i; break; }
  }

  if (varIdx === -1) {
    if (items.length !== slots.length) return false;
    for (let i = 0; i < items.length; i++) {
      if (!matchSlot(items[i], slots[i], bindings)) return false;
    }
    return true;
  }

  const head = slots.slice(0, varIdx);
  const tail = slots.slice(varIdx + 1);
  if (items.length < head.length + tail.length) return false;

  for (let i = 0; i < head.length; i++) {
    if (!matchSlot(items[i], head[i], bindings)) return false;
  }
  for (let i = 0; i < tail.length; i++) {
    const itemIdx = items.length - tail.length + i;
    if (!matchSlot(items[itemIdx], tail[i], bindings)) return false;
  }
  // Variadic captures the middle. Bind to a Tmpl of those items if named.
  const variadicSlot = slots[varIdx];
  if (variadicSlot.kind === 'Named') {
    const captured = items.slice(head.length, items.length - tail.length);
    if (!bind(bindings, variadicSlot.name, { kind: 'Tmpl', items: captured })) return false;
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
