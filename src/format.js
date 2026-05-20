// Format a Punk value back into source-equivalent text.
//
// This is what the REPL uses to display a result. The rule of thumb
// is: print the value in a way that, if pasted back into Punk source,
// would produce the same value (subject to the REPL's display
// wrappings for bare Words and Numbers).

import { mkTmpl } from './values.js';

// Characters that need a leading `\` when they appear inside a Word's
// text but are not at a position the language gives them meaning.
const WORD_ESCAPE = new Set([
  '{', '}', '(', ')', '[', ']', '"', '\\', '#',
]);

const formatWordText = (text) => {
  let out = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\t') { out += '\\' + ch; continue; }
    if (ch === '\n') { out += '\\n'; continue; }
    if (WORD_ESCAPE.has(ch)) { out += '\\' + ch; continue; }
    out += ch;
  }
  return out;
};

const formatTextLit = (text) => {
  // Inside a `"..."` block: only `"` and `\` need escaping; spaces
  // and newlines are preserved verbatim.
  let out = '';
  for (const ch of text) {
    if (ch === '"' || ch === '\\') { out += '\\' + ch; continue; }
    out += ch;
  }
  return out;
};

export function format(value) {
  if (value === null || value === undefined) return 'NULL';
  switch (value.kind) {
    case 'Null': return 'NULL';
    case 'Word':
      if (value.subkind === 'reserved' || value.subkind === 'number') {
        return value.text;
      }
      return formatWordText(value.text);
    case 'Tmpl':
      return '{' + value.items.map(format).join(' ') + '}';
    case 'Pattern':
      return '(' + value.items.map(format).join(' ') + ')';
    case 'Text': {
      let out = '"';
      for (const part of value.parts) {
        if ('lit' in part) out += formatTextLit(part.lit);
        else out += format(part.embed);
      }
      return out + '"';
    }
    case 'Box':
      return '[' + value.name + ']';
    case 'Named':
      return value.name + ':' + format(value.value);
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
      const body = format(value.body);
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

const formatSegment = (seg) => {
  switch (seg.kind) {
    case 'index':   return '.' + seg.n;
    case 'name':    return '.' + seg.text;
    case 'length':  return '.#';
    case 'nameOf':  return '.:';
    case 'pattern': return '.()';
    case 'range':   return '.' + formatRange(seg);
    default:
      throw new Error(`format: unknown path segment '${seg.kind}'`);
  }
};

const formatPath = ({ head, segments }) => {
  let out = head;
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
  return format(value);
}
