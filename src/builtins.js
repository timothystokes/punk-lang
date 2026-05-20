// Built-in functions.
//
// Each builtin is a JS function `(args, env, helpers) -> value`.
// `args` is a Tmpl value (already cascaded). Helpers are kept minimal
// for now — most builtins just read/produce values.

import { PunkRuntimeError } from './errors.js';
import { mkTmpl, mkWord, NULL } from './values.js';

// ---------- Helpers ----------

const fmtNum = (n) => {
  // Integer when exact, decimal otherwise. Avoid scientific.
  if (Number.isInteger(n)) return String(n);
  return String(+n.toFixed(12)).replace(/\.?0+$/, '');
};

const isNum = (v) =>
  v && v.kind === 'Word' && v.subkind === 'number';

// Coerce a value to a JS number. A singleton-Tmpl wrapping a number
// counts as that number (this is how `x:5` then `x?` flows through
// arithmetic — auto-wrap put it in a Tmpl).
function toNum(v, node) {
  if (isNum(v)) return Number(v.text);
  if (v && v.kind === 'Tmpl' && v.items.length === 1) {
    return toNum(v.items[0], node);
  }
  throw new PunkRuntimeError(
    'expected a number',
    node && node.line, node && node.col,
  );
}

const numWord = (n) => mkWord(fmtNum(n), 'number');

const argsItems = (args) =>
  (args && args.kind === 'Tmpl') ? args.items : [];

// ---------- Builtin registry ----------

export const builtins = {
  '+': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    return numWord(xs.reduce((a, b) => a + b, 0));
  },

  '*': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    return numWord(xs.reduce((a, b) => a * b, 1));
  },

  '-': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`-! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] - xs[1]);
  },

  '/': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`/! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] / xs[1]);
  },

  '^': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`^! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(Math.pow(xs[0], xs[1]));
  },

  '%': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`%! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] % xs[1]);
  },

  'min': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    return numWord(Math.min(...xs));
  },

  'max': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    return numWord(Math.max(...xs));
  },

  'abs':   (args) => numWord(Math.abs(toNum(argsItems(args)[0]))),
  'neg':   (args) => numWord(-toNum(argsItems(args)[0])),
  'floor': (args) => numWord(Math.floor(toNum(argsItems(args)[0]))),
  'ceil':  (args) => numWord(Math.ceil(toNum(argsItems(args)[0]))),
  'round': (args) => numWord(Math.round(toNum(argsItems(args)[0]))),
  'sqrt':  (args) => numWord(Math.sqrt(toNum(argsItems(args)[0]))),
};
