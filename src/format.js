// Formatting things as Punk source/result text (GRP-4, GRP-9).

import { NONE, isNone } from './values.js';

function wordText(w) {
  if (w.text !== null) return w.text;
  return w.parts.map((p) => (p.lit !== undefined ? p.lit : `{${fmtQuery(p.embed)}}`)).join('');
}

function fmtQuery(q) {
  const seg = (s) => (typeof s === 'string' ? s : wordText({ text: null, parts: s.parts }));
  return (q.local ? '.' : '') + q.segs.map(seg).join('.') + '?';
}

function fmtPattern(p) {
  const slot = (s) => {
    const base = s.type === 'one' ? '_' : s.type === 'rest' ? '#' : fmt(s.thing);
    return s.label ? `${s.label}:${base}` : base;
  };
  const left = p.left.map(slot);
  const right = p.right.map((r) => `${r.name}:${r.spec.type === 'one' ? '_' : fmt(r.spec.thing)}`);
  const all = right.length ? [...left, '|', ...right] : left;
  return `(${all.join(' ')})`;
}

// Inner text of a group, without its own brackets (also used by embeds).
export function textOf(v) {
  if (v.kind === 'Group') return v.items.map((x) => (x.kind === 'Group' ? textOf(x) : fmt(x))).join(' ');
  return fmt(v);
}

export function fmt(v) {
  switch (v.kind) {
    case 'Word': return wordText(v);
    case 'Group': return v.items.length === 1 ? fmt(v.items[0]) : `[${v.items.map(fmt).join(' ')}]`;
    case 'Named': return `${v.name}:${fmt(v.value)}`;
    case 'Pattern': return fmtPattern(v);
    case 'FnLit':
    case 'Fn': return `${fmtPattern(v.pattern)}${fmtBody(v.body)}`;
    case 'Builtin': return v.name;
    case 'Atom': return `@${v.name}`;
    case 'Partial': return `${fmt(v.fn)}!${fmt({ kind: 'Group', items: v.supplied })}`;
    case 'PipeFn': return `> ${v.stages.map(fmt).join(' > ')}`;
    case 'Query': return fmtQuery(v);
    case 'Call': return `${fmt(v.target)}!${v.args ? fmt(v.args) : ''}`;
    case 'Match': return `${fmt(v.thing)}${fmtPattern(v.pattern)}!`;
    case 'Pipe': return `${v.seed ? fmt(v.seed) + ' ' : ''}> ${v.stages.map(fmt).join(' > ')}`;
    default: return '?';
  }
}

function fmtBody(b) {
  return b.kind === 'Group' ? `[${b.items.map(fmt).join(' ')}]` : `[${fmt(b)}]`;
}

export function formatResult(v) {
  return isNone(v) || v === NONE ? '[]' : fmt(v);
}

// Readable layout: a group holding other groups of several items puts each
// item on its own indented line, recursively. Other groups stay on one line.
const nests = (v) => (v.kind === 'Named' ? nests(v.value) : v.kind === 'Group' && v.items.length > 1);

function pretty(v, pad) {
  if (v.kind === 'Named') return `${v.name}:${pretty(v.value, pad)}`;
  if (v.kind !== 'Group' || v.items.length < 2 || !v.items.some(nests)) return fmt(v);
  const inner = pad + '  ';
  return `[\n${v.items.map((x) => inner + pretty(x, inner)).join('\n')}\n${pad}]`;
}

export function formatPretty(v) {
  return isNone(v) || v === NONE ? '[]' : pretty(v, '');
}
