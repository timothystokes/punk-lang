// Slot helpers — unify access to Pattern.items.
//
// Pattern.items are stored as raw AST nodes (Word, Named, Pattern,
// Regex, etc.). This module is the single place that interprets a
// raw item as a "slot" with three properties:
//
//   - name   string|null   — the binding name (`x` for `x:_`, null for `_`)
//   - rest   bool          — true iff this slot captures the trailing rest
//   - inner  node|null     — the shape the slot matches:
//                              null     for `_` and `*` (pure wildcard)
//                              Pattern  for `(...)` nested
//                              Regex    for `/.../`
//                              Word|... for a literal slot (must equal value)
//
// Every consumer that asks "is this slot variadic / what's its name /
// what does it match" should go through these helpers so the raw
// shape is irrelevant to call-sites.

export const isWildcardWord = (n) =>
  n && n.kind === 'Word' && n.subkind === 'wildcard';

export const isVariadicWord = (n) =>
  n && n.kind === 'Word' && n.subkind === 'variadic';

// Strip an outer Named wrapper to expose the inner shape.
const stripNamed = (n) => (n && n.kind === 'Named' ? n.value : n);

// Decode a raw pattern item into { name, rest, inner }.
export function slotInfo(raw) {
  const name = raw && raw.kind === 'Named' ? raw.name : null;
  const body = stripNamed(raw);
  if (isWildcardWord(body)) return { name, rest: false, inner: null };
  if (isVariadicWord(body)) return { name, rest: true,  inner: null };
  return { name, rest: false, inner: body };
}

export const slotName    = (raw) => slotInfo(raw).name;
export const slotIsRest  = (raw) => slotInfo(raw).rest;
export const slotInner   = (raw) => slotInfo(raw).inner;
export const isPureWildcard = (raw) => {
  const i = slotInfo(raw);
  return i.inner === null && !i.rest;
};
