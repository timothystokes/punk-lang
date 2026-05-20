// Punk runtime values.
//
// Values are the things Punk programs produce. Most have the same
// shape as their AST counterparts but with no source metadata (no
// `line`, `col`, `glued`). The parser emits AST nodes; the evaluator
// converts AST → value by normalising and resolving as the rules
// allow.
//
// Value kinds:
//   Tmpl      { kind:'Tmpl',     items: Value[] }
//   Text      { kind:'Text',     parts: ({lit:string} | {embed:Value})[] }
//   Word      { kind:'Word',     text:string, subkind: 'value'|'number'|'reserved'|'op' }
//   Null      { kind:'Null' }                      — the only NULL value
//   Pattern   { kind:'Pattern',  items: Value[] }
//   Fn        { kind:'Fn',       params:Pattern, body:Tmpl, returnRange?:{from,to}, env:Env }
//   Box       { kind:'Box',      name:string }
//   Pipeline  { kind:'Pipeline', stages: Value[] }
//
// TRUE and FALSE are Word{subkind:'reserved'} singletons.
//
// AST kinds the evaluator never returns as values (they're code, not
// data): Query, Exec, Partial, Range, Named. A `Named` is a binding
// statement; it returns its bound value, but the Named wrapper itself
// is not a value the user can carry around.

export const TRUE  = Object.freeze({ kind: 'Word', subkind: 'reserved', text: 'TRUE'  });
export const FALSE = Object.freeze({ kind: 'Word', subkind: 'reserved', text: 'FALSE' });
export const NULL  = Object.freeze({ kind: 'Null' });

export const mkTmpl     = (items) => ({ kind: 'Tmpl', items });
export const mkText     = (parts) => ({ kind: 'Text', parts });
export const mkWord     = (text, subkind = 'value') => ({ kind: 'Word', subkind, text });
export const mkPattern  = (items) => ({ kind: 'Pattern', items });
export const mkFn       = (params, body, env, returnRange) =>
  returnRange
    ? { kind: 'Fn', params, body, env, returnRange }
    : { kind: 'Fn', params, body, env };
export const mkBox      = (name) => ({ kind: 'Box', name });
export const mkPipeline = (stages) => ({ kind: 'Pipeline', stages });

// Convenience predicates.
export const isTrue  = (v) => v && v.kind === 'Word' && v.subkind === 'reserved' && v.text === 'TRUE';
export const isFalse = (v) => v && v.kind === 'Word' && v.subkind === 'reserved' && v.text === 'FALSE';
export const isNull  = (v) => v && v.kind === 'Null';

// Structural equality. Ignores source metadata; compares value
// content. Two functions are equal only by identity (capturing scope
// makes structural fn equality meaningless).
export function equals(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'Null': return true;
    case 'Word':
      // subkind difference still matters for reserved vs ordinary;
      // numbers compare by numeric value.
      if (a.subkind === 'number' && b.subkind === 'number') {
        return Number(a.text) === Number(b.text);
      }
      return a.subkind === b.subkind && a.text === b.text;
    case 'Tmpl':
    case 'Pattern':
      return equalList(a.items, b.items);
    case 'Text':
      if (a.parts.length !== b.parts.length) return false;
      for (let i = 0; i < a.parts.length; i++) {
        const pa = a.parts[i], pb = b.parts[i];
        if ('lit' in pa && 'lit' in pb) {
          if (pa.lit !== pb.lit) return false;
        } else if ('embed' in pa && 'embed' in pb) {
          if (!equals(pa.embed, pb.embed)) return false;
        } else {
          return false;
        }
      }
      return true;
    case 'Box':
      return a.name === b.name;
    case 'Fn':
      return false; // identity only
    case 'Pipeline':
      return equalList(a.stages, b.stages);
    default:
      return false;
  }
}

function equalList(xs, ys) {
  if (xs.length !== ys.length) return false;
  for (let i = 0; i < xs.length; i++) {
    if (!equals(xs[i], ys[i])) return false;
  }
  return true;
}
