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
import { format } from './format.js';
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
  if (v && v.kind === 'Named') return toNum(v.value, node);
  if (isNum(v)) return Number(v.text);
  if (v && v.kind === 'Tmpl' && v.items.length === 1) {
    return toNum(v.items[0], node);
  }
  const loc = (v && v.line) ? v : node;
  throw new PunkRuntimeError(
    'expected a number',
    loc && loc.line, loc && loc.col,
  );
}

const numWord = (n) => mkWord(fmtNum(n), 'number');

const argsItems = (args) =>
  (args && args.kind === 'Tmpl') ? args.items : [];

// Resolve word-source escapes to actual chars for string contexts
// (join, embeds in `"..."`, etc.). The two-char sequences `\n` and
// `\t` are preserved verbatim — they're handy split delimiters and
// the user explicitly wrote them; only the real-IO boundary turns
// them into actual newline/tab bytes. Every other `\X` resolves to
// bare `X` (so `\?` → `?`, `\\` → `\`, `\<space>` → space).
function resolveWordEscapes(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      if (nx === 'n' || nx === 't') {
        out += '\\' + nx;
      } else {
        out += nx;
      }
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

// Resolve `\n` → newline (0x0A) and `\t` → tab (0x09) in a string.
// Used by stdio/file IO at the moment chars leave Punk's world. Does
// not touch any other escapes — those must already be resolved (or
// kept literal) by the time they reach IO.
function resolveForIO(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      if (nx === 'n') { out += '\n'; i++; continue; }
      if (nx === 't') { out += '\t'; i++; continue; }
    }
    out += ch;
  }
  return out;
}

// Chars that have struct-context meaning and so must be escaped when
// a chunk of arbitrary text is forced into Word storage (split, etc.)
// so the resulting Word is inert and round-trips back through join.
//
// Notably `-` is NOT in this set (only `>` is — it forms `->` with a
// preceding `-`; escaping `>` blocks pipeline-arrow formation). `<`
// is included alongside `>` so angle-bracket pairs look consistent
// to the programmer (e.g. HTML/XML written in words: `\<p\>`).
// Digits are not escaped either: `42` is already a valid Word.
const WORD_ESCAPE_CHARS = new Set([
  '{', '}', '(', ')', '[', ']', '"', '\\', '#',
  '!', '?', "'", '.', '~', ':', '<', '>',
  ' ', '\t', '\n',
]);

function escapeForWord(s) {
  let out = '';
  for (const ch of s) {
    if (WORD_ESCAPE_CHARS.has(ch)) out += '\\' + ch;
    else out += ch;
  }
  return out;
}

// Render a value to a JS string for text-flavoured builtins.
// Tmpls join their items with a single space (matches "structured
// input is implicitly joined with a single space" rule for text
// builtins). Text concatenates its parts. Words/numbers/reserved use
// their text directly. Null → "NULL".
// Walk a stored string by *logical char*: an escape `\X` counts as
// one logical char (returned as the 2-char string `\X`); any other
// char is returned on its own. Used by `chars!`, `length!`, and
// anywhere a Punk "char-of-the-string" is needed (which differs from
// a JS code unit/point because escapes are 2-char sequences but one
// logical thing in Punk's view).
function logicalChars(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      out.push('\\' + s[i + 1]);
      i++;
    } else {
      out.push(ch);
    }
  }
  return out;
}

// Render a logical char (as returned by `logicalChars`) into a Word's
// text-storage form. If the logical char is already an escape `\X`,
// it's preserved verbatim. Otherwise the bare char gets escaped if
// it's struct-special in word context, so the resulting Word is
// inert when slotted back into struct context.
function logicalCharToWordText(lc) {
  if (lc.length === 2 && lc[0] === '\\') return lc;
  return WORD_ESCAPE_CHARS.has(lc) ? '\\' + lc : lc;
}

// `chars!` and `length!` need the raw stored form of a value, not the
// resolved-to-JS-chars form (which would split `\n` into `\` + `n`).
function storageString(v) {
  if (!v) return '';
  if (v.kind === 'Word') return v.text;
  if (v.kind === 'Text') {
    return v.parts.map((p) => 'lit' in p ? p.lit : storageString(p.embed)).join('');
  }
  if (v.kind === 'Tmpl') return v.items.map(storageString).join(' ');
  if (v.kind === 'Null') return 'NULL';
  throw new PunkRuntimeError(`cannot take chars of ${v.kind}`);
}
//
// Word: stored text is in struct-source form; resolve word escapes
//   (drop `\` for everything except `\n`/`\t`) so the result is the
//   chars the user meant.
// Text: lit storage IS the chars-of-the-string already (text→text
//   is identity — user-written escapes are not stripped). Embeds
//   recurse. NB: this means `\n` inside a Text remains the two-char
//   sequence `\n` here too; it only becomes a real newline at the
//   stdio/file IO boundary.
// Tmpl: each item rendered and joined with a single space.
// Null → "NULL".
function valueToText(v) {
  if (!v) return '';
  switch (v.kind) {
    case 'Text':
      return v.parts.map((p) => 'lit' in p ? p.lit : valueToText(p.embed)).join('');
    case 'Word':
      return resolveWordEscapes(v.text);
    case 'Null':
      return 'NULL';
    case 'Tmpl':
      return v.items.map(valueToText).join(' ');
    default:
      throw new PunkRuntimeError(`cannot convert ${v.kind} to text`);
  }
}

// Chars that ARE structural inside `"..."` and must be `\`-prefixed
// when a raw JS string is stored into Text-lit form.
const TEXT_STRUCTURAL = new Set(['{', '}', '"', '\\']);

function escapeForText(s) {
  let out = '';
  for (const ch of s) {
    if (TEXT_STRUCTURAL.has(ch)) out += '\\' + ch;
    else out += ch;
  }
  return out;
}

const mkTextLit = (s) => s === '' ? mkText([]) : mkText([{ lit: escapeForText(s) }]);

const boolValue = (b) => b ? TRUE : FALSE;

// The "value being operated on" by a 1-arg builtin. Callers write
// `f!X` (shortcut for `f!{X}`), `f!"text"`, or `f!{x y z}`. In the
// first two cases the args Tmpl is a singleton wrapper — unwrap it.
// In the multi-item case, the whole Tmpl IS the value (a list/struct).
const singleArg = (args, _env, ctx) => {
  const xs = argsItems(args);
  if (xs.length === 1) return xs[0];
  return args || mkTmpl([]);
};

const isTextV = (v) => v && v.kind === 'Text';
const isTmplV = (v) => v && v.kind === 'Tmpl';
const isFnV   = (v) => v && v.kind === 'Fn';
const isBox   = (v) => v && v.kind === 'Box';

// ---------- Builtin registry ----------

// Arity metadata for builtins that have a fixed pattern. Used by
// partial application (`fn'{...}`) to validate prefilled-arg counts
// and to know how many args remain for the resulting partial.
// `variadic: true` means the last slot soaks up 0+ extras (target
// behaves like `(... *)`), so a partial of it always keeps a trailing
// variadic and any number of prefills below `slots` is fine.
// Builtins not listed here are treated as fully variadic — partials
// of them simply spread later args into the call.
export const builtinArity = {
  'map':    { slots: 2, variadic: false },
  'filter': { slots: 2, variadic: false },
  'find':   { slots: 2, variadic: false },
  'each':   { slots: 2, variadic: false },
  'count':  { slots: 2, variadic: false },
  'reduce': { slots: 3, variadic: false },
  'sort':   { slots: 2, variadic: false },
  'replace':{ slots: 3, variadic: false },
  'split':  { slots: 2, variadic: false },
  'join':   { slots: 2, variadic: false },
};

export const builtins = {
  // ----- Arithmetic ---------------------------------------------------
  '+': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    return numWord(xs.reduce((a, b) => a + b, 0));
  },
  'X': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    return numWord(xs.reduce((a, b) => a * b, 1));
  },
  '-': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`-! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] - xs[1]);
  },
  '/': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`/! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] / xs[1]);
  },
  '^': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`^! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(Math.pow(xs[0], xs[1]));
  },
  '%': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`%! expects 2 arguments, got ${xs.length}`);
    }
    return numWord(xs[0] % xs[1]);
  },
  'min': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    return numWord(Math.min(...xs));
  },
  'max': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    return numWord(Math.max(...xs));
  },
  'abs':   (args, _env, ctx) => numWord(Math.abs(toNum(argsItems(args)[0], ctx && ctx.node))),
  'neg':   (args, _env, ctx) => numWord(-toNum(argsItems(args)[0], ctx && ctx.node)),
  'floor': (args, _env, ctx) => numWord(Math.floor(toNum(argsItems(args)[0], ctx && ctx.node))),
  'ceil':  (args, _env, ctx) => numWord(Math.ceil(toNum(argsItems(args)[0], ctx && ctx.node))),
  'round': (args, _env, ctx) => numWord(Math.round(toNum(argsItems(args)[0], ctx && ctx.node))),
  'sqrt':  (args, _env, ctx) => numWord(Math.sqrt(toNum(argsItems(args)[0], ctx && ctx.node))),
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
  '=': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(equals(xs[0], xs[1]));
  },
  '<>': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<>! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(!equals(xs[0], xs[1]));
  },
  '<': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] < xs[1]);
  },
  '>': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`>! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] > xs[1]);
  },
  '<=': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`<=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] <= xs[1]);
  },
  '>=': (args, _env, ctx) => {
    const xs = argsItems(args).map((v) => toNum(v, ctx && ctx.node));
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`>=! expects 2 arguments, got ${xs.length}`);
    }
    return boolValue(xs[0] >= xs[1]);
  },

  // ----- Boolean ------------------------------------------------------
  'and': (args, _env, ctx) => {
    for (const v of argsItems(args)) {
      if (isTrue(v))  continue;
      if (isFalse(v)) return FALSE;
      throw new PunkRuntimeError('and!: expected TRUE or FALSE');
    }
    return TRUE;
  },
  'or': (args, _env, ctx) => {
    for (const v of argsItems(args)) {
      if (isFalse(v)) continue;
      if (isTrue(v))  return TRUE;
      throw new PunkRuntimeError('or!: expected TRUE or FALSE');
    }
    return FALSE;
  },
  'not': (args, _env, ctx) => {
    const v = singleArg(args);
    if (isTrue(v))  return FALSE;
    if (isFalse(v)) return TRUE;
    throw new PunkRuntimeError('not!: expected TRUE or FALSE');
  },
  'xor': (args, _env, ctx) => {
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
  'islist':  (args, _env, ctx) => {
    const v = singleArg(args);
    if (!isTmplV(v)) return FALSE;
    // True for empty or multi-item; a singleton came from auto-wrap.
    return boolValue(v.items.length !== 1);
  },
  'isfn':    (args) => boolValue(isFnV(singleArg(args))),
  'isempty': (args, _env, ctx) => {
    const v = singleArg(args);
    if (isTmplV(v)) return boolValue(v.items.length === 0);
    if (isTextV(v)) return boolValue(valueToText(v).length === 0);
    return FALSE;
  },

  // ----- Text ---------------------------------------------------------
  'upper': (args) => mkTextLit(valueToText(singleArg(args)).toUpperCase()),
  'lower': (args) => mkTextLit(valueToText(singleArg(args)).toLowerCase()),
  'trim':  (args) => mkTextLit(valueToText(singleArg(args)).trim()),
  'chars': (args, _env, ctx) => {
    const s = storageString(singleArg(args));
    return mkTmpl(logicalChars(s).map((lc) => mkWord(logicalCharToWordText(lc))));
  },
  'split': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`split! expects 2 arguments, got ${xs.length}`);
    }
    const sep    = valueToText(xs[0]);
    const target = valueToText(xs[1]);
    return mkTmpl(target.split(sep).map((s) => mkWord(escapeForWord(s))));
  },
  'replace': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 3) {
      throw new PunkRuntimeError(`replace! expects 3 arguments, got ${xs.length}`);
    }
    const old = valueToText(xs[0]);
    const neu = valueToText(xs[1]);
    const target = valueToText(xs[2]);
    if (old === '') return mkTextLit(target);
    return mkTextLit(target.split(old).join(neu));
  },
  'join': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`join! expects 2 arguments, got ${xs.length}`);
    }
    const sep   = valueToText(xs[0]);
    const items = isTmplV(xs[1]) ? xs[1].items : [xs[1]];
    return mkTextLit(items.map(valueToText).join(sep));
  },
  // ----- Conversion ---------------------------------------------------
  'num': (args, _env, ctx) => {
    const s = valueToText(singleArg(args));
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s.trim())) {
      throw new PunkRuntimeError(`num!: cannot parse '${s}' as a number`);
    }
    return numWord(Number(s));
  },

  // ----- Assertions ---------------------------------------------------
  'assert': (args, _env, ctx) => {
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
  'print': (args, _env, ctx) => {
    const v = singleArg(args);
    // Text values print as raw chars (verbatim stored content, with
    // `\n`/`\t` finally turning into real newline/tab at the IO
    // boundary). Other shapes print in struct form via `format` —
    // they're structured data, not a string.
    const out = (v && v.kind === 'Text')
      ? resolveForIO(valueToText(v))
      : format(v);
    // eslint-disable-next-line no-console
    console.log(out);
    return NULL;
  },
  'exists': (args, _env, ctx) => {
    const path = resolveForIO(valueToText(singleArg(args)));
    return boolValue(fs.existsSync(path));
  },
  'read': (args, _env, ctx) => {
    const path = resolveForIO(valueToText(singleArg(args)));
    const txt = fs.readFileSync(path, 'utf8');
    return mkTmpl(txt.split(/\r?\n/).map((l) => mkTextLit(l)));
  },
  'write': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`write! expects 2 arguments, got ${xs.length}`);
    }
    const path = resolveForIO(valueToText(xs[0]));
    fs.writeFileSync(path, resolveForIO(valueToText(xs[1])));
    return NULL;
  },
  'append': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`append! expects 2 arguments, got ${xs.length}`);
    }
    const path = resolveForIO(valueToText(xs[0]));
    fs.appendFileSync(path, resolveForIO(valueToText(xs[1])));
    return NULL;
  },

  // ----- Collections --------------------------------------------------
  // HOFs take behaviour first, data last (so `'`-partial is useful).
  // Iteration callbacks see (value index key):
  //   - value: the unwrapped value of a Named item, or the item itself
  //   - index: 1-based position
  //   - key:   Word(name) for Named items, else NULL
  // Callbacks must accept the full 3-arg call (use `___` if ignoring).
  // reduce! is special: its callback is (acc value).
  'map':    (args, env, ctx) => collMap(args, ctx),
  'filter': (args, env, ctx) => collFilter(args, ctx),
  'find':   (args, env, ctx) => collFind(args, ctx),
  'each':   (args, env, ctx) => collEach(args, ctx),
  'count':  (args, env, ctx) => collCount(args, ctx),
  'reduce': (args, env, ctx) => collReduce(args, ctx),
  'sort':   (args, env, ctx) => collSort(args, ctx),
  'rev':    (args, _env, ctx) => {
    const xs = argsItems(singleArg(args));
    return mkTmpl(xs.slice().reverse());
  },
  'unique': (args, _env, ctx) => {
    const xs = argsItems(singleArg(args));
    const out = [];
    for (const it of xs) {
      if (!out.some((o) => equals(o, it))) out.push(it);
    }
    return mkTmpl(out);
  },
  'contains': (args, _env, ctx) => {
    const xs = argsItems(args);
    if (xs.length !== 2) {
      throw new PunkRuntimeError(`contains! expects 2 arguments, got ${xs.length}`);
    }
    const needle = xs[0];
    const haystack = isTmplV(xs[1]) ? xs[1].items : [xs[1]];
    return boolValue(haystack.some((h) => equals(h, needle)));
  },
};

// ---------- Collection helpers ----------

// Pull `fn` and `data` out of an HOF args Tmpl. HOF args are
// `{fn ...data}` where ...data is one item if it's a Tmpl, or all
// trailing items collectively forming the data list.
function takeFnAndData(args, name, ctx) {
  const node = ctx && ctx.node;
  const xs = argsItems(args);
  if (xs.length < 2) {
    throw new PunkRuntimeError(
      `${name}! expects at least 2 arguments`,
      node && node.line, node && node.col,
    );
  }
  const fn = xs[0];
  if (!isFnV(fn)) {
    throw new PunkRuntimeError(
      `${name}!: first argument must be a function`,
      node && node.line, node && node.col,
    );
  }
  // Data is the last item (must be a Tmpl).
  const last = xs[xs.length - 1];
  if (!isTmplV(last)) {
    throw new PunkRuntimeError(
      `${name}!: last argument must be a template`,
      node && node.line, node && node.col,
    );
  }
  return { fn, data: last.items, middle: xs.slice(1, -1) };
}

// Inspect a callback's *positional* arity for HOF dispatch.
// Returns the number of positional slots (1 or 2). Variadic-trailing slot
// counts as the upper bound (still legal to call with item-only).
// For Builtins / non-Fn callables, defaults to 1.
function hofArity(fn, hofName) {
  let target = fn;
  let prefilled = 0;
  while (target && target.kind === 'PartialFn') {
    prefilled += target.prefilled.length;
    target = target.target;
  }
  if (!target || target.kind !== 'Fn') return 1;
  const items = (target.params && target.params.items) || [];
  const remaining = items.length - prefilled;
  // Detect variadic trailing slot (last slot is `*` or `name:*`).
  let variadic = false;
  if (items.length > 0) {
    const last = items[items.length - 1];
    const inner = last && last.kind === 'Named' ? last.value : last;
    if (inner && inner.kind === 'Word' && inner.subkind === 'variadic') {
      variadic = true;
    }
  }
  // Effective non-variadic slot count we must satisfy.
  const fixed = variadic ? remaining - 1 : remaining;
  if (variadic) {
    // Variadic callbacks: pass (item) — variadic captures zero extras.
    if (fixed > 1) {
      throw new PunkRuntimeError(
        `${hofName}!: callback takes (item) or (item index), got ${remaining} slots`,
      );
    }
    return 1;
  }
  if (remaining === 1) return 1;
  if (remaining === 2) return 2;
  throw new PunkRuntimeError(
    `${hofName}!: callback takes (item) or (item index), got ${remaining} slots`,
  );
}

// Build the args Tmpl for a HOF callback call, respecting the callback's
// declared arity. Item is passed as-is (Named-preserved).
function cbArgs(item, i, fn, hofName) {
  const arity = hofArity(fn, hofName);
  if (arity === 2) return mkTmpl([item, numWord(i)]);
  return mkTmpl([item]);
}

function collMap(args, ctx) {
  const { fn, data } = takeFnAndData(args, 'map', ctx);
  const out = [];
  for (let i = 0; i < data.length; i++) {
    out.push(ctx.callFn(fn, cbArgs(data[i], i + 1, fn, 'map'), null));
  }
  return mkTmpl(out);
}

function collFilter(args, ctx) {
  const { fn, data } = takeFnAndData(args, 'filter', ctx);
  const out = [];
  for (let i = 0; i < data.length; i++) {
    const r = ctx.callFn(fn, cbArgs(data[i], i + 1, fn, 'filter'), null);
    if (isTrue(r)) out.push(data[i]);
  }
  return mkTmpl(out);
}

function collFind(args, ctx) {
  const { fn, data } = takeFnAndData(args, 'find', ctx);
  for (let i = 0; i < data.length; i++) {
    const r = ctx.callFn(fn, cbArgs(data[i], i + 1, fn, 'find'), null);
    if (isTrue(r)) return data[i];
  }
  return NULL;
}

function collEach(args, ctx) {
  const { fn, data } = takeFnAndData(args, 'each', ctx);
  for (let i = 0; i < data.length; i++) {
    ctx.callFn(fn, cbArgs(data[i], i + 1, fn, 'each'), null);
  }
  return NULL;
}

function collCount(args, ctx) {
  const { fn, data } = takeFnAndData(args, 'count', ctx);
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    const r = ctx.callFn(fn, cbArgs(data[i], i + 1, fn, 'count'), null);
    if (isTrue(r)) n++;
  }
  return numWord(n);
}

function collReduce(args, ctx) {
  // `reduce!{fn seed data}` — callback is (acc value).
  const xs = argsItems(args);
  if (xs.length !== 3) {
    throw new PunkRuntimeError(`reduce! expects 3 arguments, got ${xs.length}`);
  }
  const [fn, seed, dataT] = xs;
  if (!isFnV(fn)) throw new PunkRuntimeError(`reduce!: first argument must be a function`);
  if (!isTmplV(dataT)) throw new PunkRuntimeError(`reduce!: third argument must be a template`);
  let acc = seed;
  for (const it of dataT.items) {
    const v = it && it.kind === 'Named' ? it.value : it;
    acc = ctx.callFn(fn, mkTmpl([acc, v]), null);
  }
  return acc;
}

function collSort(args, ctx) {
  const xs = argsItems(args);
  // Unary: sort!{data}; with comparator: sort!{fn data}.
  let fn = null;
  let data;
  if (xs.length === 1 && isTmplV(xs[0])) {
    data = xs[0].items.slice();
  } else if (xs.length === 2 && isFnV(xs[0]) && isTmplV(xs[1])) {
    fn = xs[0];
    data = xs[1].items.slice();
  } else {
    // Treat whole args as a list of items to sort.
    data = xs.slice();
  }
  const cmp = fn
    ? (a, b) => {
        const r = ctx.callFn(fn, mkTmpl([a, b]), null);
        // TRUE means a comes before b.
        return isTrue(r) ? -1 : 1;
      }
    : defaultCompare;
  data.sort(cmp);
  return mkTmpl(data);
}

function defaultCompare(a, b) {
  if (isNum(a) && isNum(b)) return Number(a.text) - Number(b.text);
  const sa = valueToText(a), sb = valueToText(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

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
