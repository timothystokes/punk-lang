// Punk things. See docs/punk-specification.md.
//
// Values:   Word, Group, Named, Pattern, Fn, Partial, Builtin, PipeFn
// AST-only: Query, Call, Match, Pipe, Cases, FnLit (resolved by eval.js)
//
// A Group of one element IS that element (GRP-1), and the empty
// Group is the non-thing NONE (THING-7). Always build groups with mkGroup.

export const NONE = Object.freeze({ kind: 'Group', items: Object.freeze([]) });

// Escaped characters travel through the tokenizer/parser as private-use
// placeholders so they never act as syntax (LEX-8); words decode them.
export const ESC_BASE = 0xe000;
export const escChar = (c) => (c.charCodeAt(0) > 255 ? c : String.fromCharCode(ESC_BASE + c.charCodeAt(0)));
const decode = (s) => s.replace(/[\ue000-\ue0ff]/g, (c) => String.fromCharCode(c.charCodeAt(0) - ESC_BASE));

export const mkWord = (text) => ({ kind: 'Word', text: decode(String(text)) });
export const mkWordParts = (parts) => ({
  kind: 'Word',
  text: null,
  parts: parts.map((p) => (p.lit !== undefined ? { lit: decode(p.lit) } : p)),
});
export const mkNamed = (name, value) => ({ kind: 'Named', name, value });
export const TRUE = mkWord('TRUE');
export const FALSE = mkWord('FALSE');
export const mkBool = (b) => (b ? TRUE : FALSE);

export function mkGroup(items) {
  if (items.length === 0) return NONE;
  if (items.length === 1) return items[0];
  return { kind: 'Group', items };
}

export const isNone = (v) => v.kind === 'Group' && v.items.length === 0;
export const isTrue = (v) => v.kind === 'Word' && v.text === 'TRUE';

export function itemsOf(v) {
  if (v.kind === 'Group') return v.items;
  return [v];
}

export const unwrapNamed = (v) => (v.kind === 'Named' ? v.value : v);

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
export const isNumericText = (s) => NUMERIC.test(s.trim());

export function toNum(v) {
  const x = unwrapNamed(v);
  if (x.kind === 'Word' && x.text !== null && isNumericText(x.text)) return Number(x.text);
  return 0;
}

export function numWord(n) {
  return Number.isFinite(n) ? mkWord(String(n)) : NONE;
}

// Deep structural equality over names and values (LIB-4).
export function equals(a, b) {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'Word':
      if (a.text !== null && b.text !== null) {
        if (a.text === b.text) return true;
        return isNumericText(a.text) && isNumericText(b.text) && Number(a.text) === Number(b.text);
      }
      return false;
    case 'Group':
      return a.items.length === b.items.length && a.items.every((x, i) => equals(x, b.items[i]));
    case 'Named':
      return a.name === b.name && equals(a.value, b.value);
    default:
      return false;
  }
}
