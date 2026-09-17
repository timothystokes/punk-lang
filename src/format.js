// Format a Punk value back into source-equivalent text.
//
// This is what the REPL uses to display a result. The rule is simple:
// every stored value is already in source form (escapes preserved
// verbatim — see tokenize.js readEscape), so format just walks the
// value and emits the stored text/lit chars as-is. Escape resolution
// happens ONLY at the word→string boundary (when a word's chars are
// being treated as the chars of a string — split/join, embeds inside
// `"..."`, valueToText). Text-to-text display NEVER strips escapes,
// because doing so would silently rewrite the user's source.

import { mkTmpl } from './values.js';

export function format(value) {
  if (value === null || value === undefined) return 'NULL';
  switch (value.kind) {
    case 'Null': return 'NULL';
    case 'Word':
      return value.text;
    case 'Tmpl':
      return '{' + value.items.map((it) => formatItem(it, false)).join(' ') + '}';
    case 'Pattern': {
      const lhs = value.items.map((it) => formatItem(it, true)).join(' ');
      if (value.suchThat && value.suchThat.length) {
        const rhs = value.suchThat.map((it) => formatItem(it, true)).join(' ');
        return '(' + (lhs ? lhs + ' ' : '') + '| ' + rhs + ')';
      }
      return '(' + lhs + ')';
    }
    case 'Text': {
      let out = '"';
      for (const part of value.parts) {
        if ('lit' in part) out += part.lit;
        else out += format(part.embed);
      }
      return out + '"';
    }
    case 'Atom':
      return '@' + value.name;
    case 'Regex':
      return '/' + value.body + '/' + (value.flags || '');
    case 'Named':
      return formatNamed(value, false);
    case 'Query':
      return formatPath(value) + '?';
    case 'Exec':
      return formatPath(value) + '!' + (value.args ? format(value.args) : '');
    case 'Partial':
      return formatPath(value) + "'" + (value.args ? format(value.args) : '');
    case 'Range':
      return formatRange(value);
    case 'Fn': {
      const params = format(value.params);
      // The parser wraps a non-Tmpl body (e.g. a Text or a Pattern)
      // in a singleton Tmpl so the cascading evaluator has a uniform
      // shape. Reprint that as the bare delimited form it was written
      // as: `(s:_)"hello"` not `(s:_){"hello"}`.
      let bodyNode = value.body;
      if (bodyNode && bodyNode.kind === 'Tmpl' && bodyNode.items.length === 1) {
        const only = bodyNode.items[0];
        if (only && (only.kind === 'Text' || only.kind === 'Pattern'
                     || only.kind === 'Atom' || only.kind === 'Fn')) {
          bodyNode = only;
        }
      }
      const body = format(bodyNode);
      const rr = value.returnRange ? formatRange(value.returnRange) : '';
      return params + body + rr;
    }
    case 'Pipeline':
      return value.stages.map(format).join('->');
    default:
      throw new Error(`format: unknown value kind '${value.kind}'`);
  }
}

const formatRange = ({ from, to }) => {
  const f = from === null || from === undefined ? '' : String(from);
  const t = to === null || to === undefined ? '' : String(to);
  return f + '~' + t;
};

// Format one Tmpl/Pattern item. `inPattern` distinguishes the two
// contexts a Named node can appear in: inside a Pattern, `name:value`
// is a literal match criterion (bare Words are fine, per parse.js's
// Pattern exemption from rejectBareWord); inside a Tmpl, `name:value`
// constructs data, so a bare value/number/reserved Word must be
// printed wrapped in `{}` to stay re-parseable (see rejectBareWord).
const formatItem = (it, inPattern) => {
  if (it && it.kind === 'Named') return formatNamed(it, inPattern);
  return format(it);
};

const formatNamed = (value, inPattern) => {
  if (value._label) {
    // `[label]`, `*[label]`, `[label/re/f]` — labelled pattern slot.
    const v = value.value;
    if (v && v.kind === 'Word' && v.subkind === 'variadic') {
      return '*[' + value.name + ']';
    }
    if (v && v.kind === 'Word' && v.subkind === 'wildcard') {
      return '[' + value.name + ']';
    }
    if (v && v.kind === 'Regex') {
      return '[' + value.name + '/' + v.body + '/' + (v.flags || '') + ']';
    }
    // Fallback (shouldn't occur — only the above forms are produced).
    return '[' + value.name + ']';
  }
  const v = value.value;
  // Both a bare reserved-Word literal (as it exists during parsing)
  // and the evaluated `Null` singleton print as the source token
  // `NULL` — either way that's the same bare-value case rejectBareWord
  // disallows, so both need the `{}` wrap to stay re-parseable.
  const bareWord = v && (
    (v.kind === 'Word' && (v.subkind === 'value' || v.subkind === 'number' || v.subkind === 'reserved'))
    || v.kind === 'Null'
  );
  const rhs = (bareWord && !inPattern) ? format(mkTmpl([v])) : format(v);
  return value.name + ':' + rhs;
};

const formatSegment = (seg) => {
  switch (seg.kind) {
    case 'index':   return '.' + seg.n;
    case 'name':    return '.' + seg.text;
    case 'length':  return '.#';
    case 'nameOf':  return '.:';
    case 'pattern': return '._';
    case 'functionRef': return '.!';
    case 'range':   return '.' + formatRange(seg);
    case 'dynamic': return '.' + format(seg.expr);
    default:
      throw new Error(`format: unknown path segment '${seg.kind}'`);
  }
};

const formatPath = ({ head, segments }) => {
  let out = typeof head === 'string' ? head : format(head);
  for (const seg of segments || []) out += formatSegment(seg);
  return out;
};

// The REPL display rule (docs/punk-by-example.md:198): bare Words
// and Numbers can't appear standalone in source — they have no
// delimiter of their own — so the REPL wraps them in a structured
// template just to show what kind of thing came back. Reserved
// values (`TRUE`, `FALSE`, `NULL`) print bare; everything else with
// its own delimiters prints as-is.
export function formatRepl(value) {
  if (!value) return 'NULL';
  if (value.kind === 'Word' && value.subkind !== 'reserved') {
    return format(mkTmpl([value]));
  }
  if (value.kind === 'Named') {
    if (value._label) return format(value);
    return value.name + ':' + formatRepl(value.value);
  }
  return format(value);
}
