// Runtime value representation for Punk.
//
// All values are plain tagged objects — no classes, no methods. Operate on
// them with the helper functions below.
//
// Value kinds:
//   {kind: 'num',   value: number}              42, -5, 0.5
//   {kind: 'text',  value: string}              a Thing (bareword/atom)
//   {kind: 'tmpl',  items: Value[]}             a Template { ... } (also used for lists)
//   {kind: 'named', name: string, value: Value} a NamedThing (name:value)
//   {kind: 'bool',  value: boolean}             TRUE / FALSE
//   {kind: 'null'}                              NULL
//   {kind: 'fn',    pattern, body, env}         a user function (closure)
//   {kind: 'builtin', name, fn}                 a host-provided function
//   {kind: 'regex', source, re}                 a compiled regex literal
//   {kind: 'box',   cell: {value}}              a mutable cell (Punk Box)

export const num     = (v) => ({ kind: 'num',  value: v });
export const text    = (v) => ({ kind: 'text', value: v });
// Template values are LAZY: they store the AST of their items plus the env
// they were defined in. Items are NOT evaluated at template-construction
// time. A query that reaches into a template forces its items (later phase).
//
//   {kind: 'tmpl', items: ASTNode[], env: Env}
//
// Runtime-constructed lists (built-ins like list!) wrap their items as
// Word AST nodes carrying a literal Value reference — see `liftValue`.
export const tmpl    = (items, env = null) => ({ kind: 'tmpl', items, env });
export const named   = (name, value) => ({ kind: 'named', name, value });
export const bool    = (v) => ({ kind: 'bool', value: !!v });
export const NULL    = Object.freeze({ kind: 'null' });
export const TRUE    = Object.freeze({ kind: 'bool', value: true });
export const FALSE   = Object.freeze({ kind: 'bool', value: false });
export const fn      = (pattern, body, env, name = null) => ({ kind: 'fn', pattern, body, env, name });
export const builtin = (name, fn, arity = -1) => ({ kind: 'builtin', name, fn, arity });
export const regex   = (source) => ({ kind: 'regex', source, re: new RegExp(source) });
export const box     = (value) => ({ kind: 'box', cell: { value } });
// A JavaScript-host value, lazily projected into Punk. Methods/properties
// are reached via path queries (.name) and called like normal builtins.
export const jsobj   = (raw) => ({ kind: 'jsobj', raw });

export const isNum     = (v) => v && v.kind === 'num';
export const isText    = (v) => v && v.kind === 'text';
export const isTmpl    = (v) => v && v.kind === 'tmpl';
export const isNamed   = (v) => v && v.kind === 'named';
export const isBool    = (v) => v && v.kind === 'bool';
export const isNull    = (v) => v && v.kind === 'null';
export const isFn      = (v) => v && (v.kind === 'fn' || v.kind === 'builtin');
export const isRegex   = (v) => v && v.kind === 'regex';
export const isBox     = (v) => v && v.kind === 'box';
export const isJsobj   = (v) => v && v.kind === 'jsobj';

// Per spec: only FALSE and NULL are falsey. Everything else (incl. 0, {}, ())
// is truthy. Named things take their truthiness from their value.
export function isTruthy(v) {
  if (!v) return false;
  if (v.kind === 'null') return false;
  if (v.kind === 'bool') return v.value;
  if (v.kind === 'named') return isTruthy(v.value);
  return true;
}

// Exact equality: two values are equal iff they would serialise identically.
export function equals(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'num':   return a.value === b.value;
    case 'text':  return a.value === b.value;
    case 'bool':  return a.value === b.value;
    case 'null':  return true;
    case 'named': return a.name === b.name && equals(a.value, b.value);
    case 'tmpl':
      if (a.items.length !== b.items.length) return false;
      for (let i = 0; i < a.items.length; i++) {
        if (!equals(a.items[i], b.items[i])) return false;
      }
      return true;
    case 'regex': return a.source === b.source;
    // Functions and boxes compare by identity only.
    case 'fn': case 'builtin': case 'box': return false;
    case 'jsobj': return a.raw === b.raw;
    default: return false;
  }
}

// Serialise a value back to source-like text. Decimals get a leading 0;
// negative numbers print with a `-` prefix; templates render as `{a b c}`.
export function formatValue(v) {
  if (!v) return '';
  switch (v.kind) {
    case 'null': return 'NULL';
    case 'bool': return v.value ? 'TRUE' : 'FALSE';
    case 'num':  return formatNumber(v.value);
    case 'text': return v.value;
    case 'named': return `${v.name}:${formatValue(v.value)}`;
    case 'tmpl':  return `{${joinTmplItems(v.items)}}`;
    case 'regex': return `"${v.source}"`;
    case 'fn':      return `<fn${v.name ? ' ' + v.name : ''}>`;
    case 'builtin': return `<builtin ${v.name}>`;
    case 'box':     return `[${formatValue(v.cell.value)}]`;
    case 'jsobj': {
      const r = v.raw;
      if (typeof r === 'function') return `<js-fn${r.name ? ' ' + r.name : ''}>`;
      return `<js ${typeof r}>`;
    }
    default: return `<?${v.kind}>`;
  }
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  // Decimals always have a leading 0 (per spec); negatives with `-` in front.
  const s = String(n);
  if (s.startsWith('.'))   return '0' + s;
  if (s.startsWith('-.'))  return '-0' + s.slice(1);
  return s;
}

// Template items can be either Values (have `.kind`) or AST nodes (have `.type`).
// formatItem dispatches accordingly so a lazy template prints source-ish.
function formatItem(item) {
  if (!item) return '';
  if (item.kind) return formatValue(item);
  return formatNode(item);
}

function formatNode(n) {
  switch (n.type) {
    case 'Word':     return n.text;
    case 'Regex':    return `"${n.pattern}"`;
    case 'Template': return `{${joinNodeItems(n.items)}}`;
    case 'Pattern':  return `(${joinNodeItems(n.items)})`;
    case 'Function': return formatNode(n.pattern) + formatNode(n.body);
    case 'Box':      return `[${joinNodeItems(n.items)}]`;
    default:         return `<?${n.type}>`;
  }
}

// Items in a template/pattern body are space-separated, BUT a Word that ends
// with a bare ':' glues to the next item with no space (it's a name-bind:
// `name:value`). Same for adjacent NamedThing values, etc.
function joinNodeItems(items) {
  let out = '';
  for (let i = 0; i < items.length; i++) {
    const prev = items[i - 1];
    const cur  = items[i];
    const glued = prev && isBareColonTail(prev);
    if (i > 0 && !glued) out += ' ';
    out += formatItem(cur);
  }
  return out;
}

function isBareColonTail(node) {
  if (!node) return false;
  // AST Word ending in un-escaped colon
  if (node.type === 'Word' && node.text.endsWith(':')) {
    const last = node.text.length - 1;
    return !(node.esc && node.esc[last]);
  }
  return false;
}

// Same logic as joinNodeItems but for runtime values (or mixed Value/AST).
// Pre-evaluated NamedThing values already render as `name:value` so they
// don't need gluing. The only glue case here is an un-evaluated AST Word
// ending in bare ':' followed by its target.
function joinTmplItems(items) {
  let out = '';
  for (let i = 0; i < items.length; i++) {
    const prev = items[i - 1];
    const cur  = items[i];
    const glued = prev && isBareColonTail(prev);
    if (i > 0 && !glued) out += ' ';
    out += formatItem(cur);
  }
  return out;
}
