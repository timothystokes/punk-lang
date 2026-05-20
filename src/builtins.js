// Built-in functions.
//
// Each builtin is a JS function `(args, env, helpers) -> value`.
// `args` is a Tmpl value (already cascaded). Helpers are kept minimal
// for now — most builtins just read/produce values.

import { PunkRuntimeError } from './errors.js';
import {
  mkTmpl, mkText, mkWord, NULL, TRUE, FALSE,
  isTrue, isFalse, equals,
} from './values.js';
import * as fs from 'node:fs';

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

// Render a value to a JS string for text-flavoured builtins.
// Tmpls join their items with a single space (matches "structured
// input is implicitly joined with a single space" rule for text
// builtins). Text concatenates its parts. Words/numbers/reserved use
// their text directly. Null → "NULL".
function valueToText(v) {
  if (!v) return '';
  switch (v.kind) {
    case 'Text':
      return v.parts.map((p) => 'lit' in p ? p.lit : valueToText(p.embed)).join('');
    case 'Word':
      return v.text;
    case 'Null':
      return 'NULL';
    case 'Tmpl':
      return v.items.map(valueToText).join(' ');
    default:
      throw new PunkRuntimeError(`cannot convert ${v.kind} to text`);
  }
}

const mkTextLit = (s) => s === '' ? mkText([]) : mkText([{ lit: s }]);

const boolValue = (b) => b ? TRUE : FALSE;

// The "value being operated on" by a 1-arg builtin. Callers write
// `f!X` (shortcut for `f!{X}`), `f!"text"`, or `f!{x y z}`. In the
// first two cases the args Tmpl is a singleton wrapper — unwrap it.
// In the multi-item case, the whole Tmpl IS the value (a list/struct).
const singleArg = (args) => {
  const xs = argsItems(args);
  if (xs.length === 1) return xs[0];
  return args || mkTmpl([]);
};

const isTextV = (v) => v && v.kind === 'Text';
const isTmplV = (v) => v && v.kind === 'Tmpl';
const isFnV   = (v) => v && v.kind === 'Fn';
const isBox   = (v) => v && v.kind === 'Box';

// ---------- Builtin registry ----------

export const builtins = {
  // ----- Arithmetic ---------------------------------------------------
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
  'rand':  () => {
    // Float in [0, 1] inclusive. 21+32 = 53 bits of randomness divided
    // by (2^53 - 1) so both endpoints are reachable.
    const MAX = 2 ** 53 - 1;
    const hi = Math.floor(Math.random() * 0x200000);   // 2^21
    const lo = Math.floor(Math.random() * 0x100000000); // 2^32
    const n = hi * 0x100000000 + lo;
    return numWord(n / MAX);
  },

  // ----- Comparison ---------------------------------------------------
  '=': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(equals(xs[0], xs[1]));
  },
  '<>': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<>! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(!equals(xs[0], xs[1]));
  },
  '<': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] < xs[1]);
  },
  '>': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`>! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] > xs[1]);
  },
  '<=': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] <= xs[1]);
  },
  '>=': (args) => {
    const xs = argsItems(args).map((v) => toNum(v));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`>=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] >= xs[1]);
  },

  // ----- Boolean ------------------------------------------------------
  'and': (args) => {
    for (const v of argsItems(args)) {
      if (isTrue(v))  continue;
      if (isFalse(v)) return FALSE;
      throw new PunkRuntimeError('and!: expected TRUE or FALSE');
    }
    return TRUE;
  },
  'or': (args) => {
    for (const v of argsItems(args)) {
      if (isFalse(v)) continue;
      if (isTrue(v))  return TRUE;
      throw new PunkRuntimeError('or!: expected TRUE or FALSE');
    }
    return FALSE;
  },
  'not': (args) => {
    const v = singleArg(args);
    if (isTrue(v))  return FALSE;
    if (isFalse(v)) return TRUE;
    throw new PunkRuntimeError('not!: expected TRUE or FALSE');
  },
  'xor': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`xor! expects 2 arguments, got ${xs.length}`);
    }
    const a = isTrue(xs[0]), b = isTrue(xs[1]);
    return boolValue(a !== b);
  },

  // ----- Type checks --------------------------------------------------
  'isnum':   (args) => boolValue(isNum(singleArg(args))),
  'istext':  (args) => boolValue(isTextV(singleArg(args))),
  'islist':  (args) => {
    const v = singleArg(args);
    if (!isTmplV(v)) return FALSE;
    // True for empty or multi-item; a singleton came from auto-wrap.
    return boolValue(v.items.length !== 1);
  },
  'isfn':    (args) => boolValue(isFnV(singleArg(args))),
  'isempty': (args) => {
    const v = singleArg(args);
    if (isTmplV(v)) return boolValue(v.items.length === 0);
    if (isTextV(v)) return boolValue(valueToText(v).length === 0);
    return FALSE;
  },

  // ----- Text ---------------------------------------------------------
  'upper': (args) => mkTextLit(valueToText(singleArg(args)).toUpperCase()),
  'lower': (args) => mkTextLit(valueToText(singleArg(args)).toLowerCase()),
  'trim':  (args) => mkTextLit(valueToText(singleArg(args)).trim()),
  'chars': (args) => {
    const s = valueToText(singleArg(args));
    return mkTmpl([...s].map((c) => mkWord(c)));
  },
  'split': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`split! expects 2 arguments, got ${xs.length}`);
    }
    const sep    = valueToText(xs[0]);
    const target = valueToText(xs[1]);
    return mkTmpl(target.split(sep).map((s) => mkWord(s)));
  },
  'join': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`join! expects 2 arguments, got ${xs.length}`);
    }
    const sep   = valueToText(xs[0]);
    const items = isTmplV(xs[1]) ? xs[1].items : [xs[1]];
    return mkTextLit(items.map(valueToText).join(sep));
  },
  // ----- Conversion ---------------------------------------------------
  'num': (args) => {
    const s = valueToText(singleArg(args));
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s.trim())) {
      throw new PunkRuntimeError(`num!: cannot parse '${s}' as a number`);
    }
    return numWord(Number(s));
  },

  // ----- Assertions ---------------------------------------------------
  'assert': (args) => {
    const xs = argsItems(args);
    if (xs.length === 2) {
      if (equals(xs[0], xs[1])) return NULL;
      throw new PunkRuntimeError(
        `assertion failed: expected ${describe(xs[0])}, got ${describe(xs[1])}`,
      );
    }
    // 1-arg form: truthy check. Only FALSE and NULL are falsy.
    const v = singleArg(args);
    if (isFalse(v)) throw new PunkRuntimeError('assertion failed: FALSE');
    if (v && v.kind === 'Null') throw new PunkRuntimeError('assertion failed: NULL');
    return NULL;
  },

  // ----- IO -----------------------------------------------------------
  'print': (args) => {
    // eslint-disable-next-line no-console
    console.log(valueToText(singleArg(args)));
    return NULL;
  },
  'exists': (args) => {
    const path = valueToText(singleArg(args));
    // Lazy require to avoid loading fs at import time in non-node envs.
    
    
    return boolValue(fs.existsSync(path));
  },
  'read': (args) => {
    const path = valueToText(singleArg(args));
    
    
    const txt = fs.readFileSync(path, 'utf8');
    return mkTmpl(txt.split(/\r?\n/).map((l) => mkTextLit(l)));
  },
  'write': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`write! expects 2 arguments, got ${xs.length}`);
    }
    const path = valueToText(xs[0]);
    
    
    fs.writeFileSync(path, valueToText(xs[1]));
    return NULL;
  },
  'append': (args) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`append! expects 2 arguments, got ${xs.length}`);
    }
    const path = valueToText(xs[0]);
    
    
    fs.appendFileSync(path, valueToText(xs[1]));
    return NULL;
  },
};

// Compact debug-style description of a value for assertion messages.
function describe(v) {
  try {
    // Avoid circular import — formatting fallback.
    if (!v) return '?';
    if (v.kind === 'Null') return 'NULL';
    if (v.kind === 'Word') return v.text;
    if (v.kind === 'Tmpl') return '{' + v.items.map(describe).join(' ') + '}';
    if (v.kind === 'Text') return '"' + v.parts.map((p) => 'lit' in p ? p.lit : describe(p.embed)).join('') + '"';
    return v.kind;
  } catch {
    return '?';
  }
}
