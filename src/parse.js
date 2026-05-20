// Punk parser.
//
// The parser turns a flat token list (from tokenize.js) into a tree
// of nodes. To keep things tractable it runs in three small passes,
// each exported and testable on its own:
//
//   1. parseTree(tokens)
//        Builds the bracket structure. Produces a tree of Tmpl/Text/
//        Pattern/Box/Word nodes. Words are still raw — their internal
//        structure (paths, suffixes, `name:value`) is not decoded yet.
//
//   2. parseWords(tree)            — TODO (next pass)
//        Walks the tree from (1) and decodes each raw Word into the
//        right kind: Named, Query, Exec, Partial, Range, or a plain
//        Word for true literals.
//
//   3. parseOperators(tree)        — TODO (next pass)
//        Recognises adjacency-based operators: `(p){...}` → Fn,
//        `body~` → ReturnMark, `a->b` → Pipeline.
//
// Each node carries `{line, col}` of its source position.

import { TOKEN_TYPES as T } from './tokenize.js';
import { PunkSyntaxError } from './errors.js';

// ---------------------------------------------------------------------------
// Node constructors
//
// Node kinds emitted by parseTree (later passes refine raw Words):
//   - Tmpl     { items[],    glued?,  line, col }
//   - Text     { parts[],    glued?,  line, col }
//      where each part is either { lit: string } or { embed: Node }
//   - Pattern  { items[],    glued?,  line, col }
//      pattern slots are still raw Words / Tmpls / nested Patterns
//   - Box      { items[],    glued?,  line, col }
//      contents inside [...]; later passes verify it's a single name
//   - Word     { text,       glued?,  line, col }
//      a raw word token; later passes split this into Named/Query/etc.
//
// `glued` means "no SPACE token between me and the previous sibling".
// It's the signal used in parseOperators for function bodies, call
// arguments, ranges, ReturnMarks, etc.

const mkTmpl    = (items, line, col)    => ({ kind: 'Tmpl',    items, line, col });
const mkText    = (parts, line, col)    => ({ kind: 'Text',    parts, line, col });
const mkPattern = (items, line, col)    => ({ kind: 'Pattern', items, line, col });
const mkBox     = (items, line, col)    => ({ kind: 'Box',     items, line, col });
const mkWord    = (text, line, col)     => ({ kind: 'Word',    text,  line, col });

// Nodes refined by parseWords:
//   - Word     { text, subkind, line, col }
//        subkind ∈ 'value' | 'number' | 'reserved' | 'wildcard' | 'variadic' | 'op'
//        ('op' is for operator-like words: `->`, `+`, etc. — really just
//         a value name; subkind is informational only.)
//   - Named    { name, value, line, col }
//   - Query    { head, segments[], line, col }
//   - Exec     { head, segments[], line, col }
//   - Partial  { head, segments[], line, col }
//   - Range    { from, to, line, col }       // from/to: integer or null
//
// `head` for Query/Exec/Partial is initially a string (the head name)
// when the word started with a name. For paths attached to a preceding
// sibling (`{1 2 3}.1?`) the head is set to that sibling node by the
// surrounding parseWords walk — see attachLeadingDotPaths.
//
// Path segments[]:
//   { kind: 'index',  n: <int> }                  // .1
//   { kind: 'name',   text: <string> }            // .fullname
//   { kind: 'length' }                            // .#  (final only)
//   { kind: 'nameOf' }                            // .:  (final only)
//   { kind: 'pattern' }                           // .() (final only)
//   { kind: 'range',  from: <int|null>, to: <int|null> }
//
// parseWords is pure: it returns a new tree.

const mkNamed   = (name, value, line, col)         => ({ kind: 'Named', name, value, line, col });
const mkQuery   = (head, segments, line, col)      => ({ kind: 'Query', head, segments, line, col });
const mkExec    = (head, segments, line, col)      => ({ kind: 'Exec', head, segments, line, col });
const mkPartial = (head, segments, line, col)      => ({ kind: 'Partial', head, segments, line, col });
const mkRange   = (from, to, line, col)            => ({ kind: 'Range', from, to, line, col });
const mkMatch   = (subject, branches, line, col)   => ({ kind: 'Match', subject, branches, line, col });

// ---------------------------------------------------------------------------
// parseTree — bracket structure pass
//
// Consumes a token stream and produces a single top-level Tmpl whose
// items are the program's top-level expressions.
//
// Throws PunkSyntaxError for any mismatched / unclosed delimiter.

export function parseTree(tokens) {
  if (!Array.isArray(tokens)) {
    throw new TypeError('parseTree: expected token array');
  }

  let i = 0;
  const peek = (n = 0) => tokens[i + n];
  const at = () => tokens[i];

  // Parse a sequence of items until we hit one of `stopTypes` (a Set
  // of token types) or EOF. Returns the items array.
  //
  // Tracks SPACE tokens so each emitted item carries a `glued` flag
  // indicating whether it's adjacent to the previous item with no
  // whitespace between them.
  const parseItems = (stopTypes) => {
    const items = [];
    let pendingSpace = false;
    let firstItem = true;

    while (i < tokens.length) {
      const tok = at();
      if (tok.type === T.EOF) break;
      if (stopTypes.has(tok.type)) break;

      if (tok.type === T.SPACE) {
        pendingSpace = true;
        i++;
        continue;
      }

      const node = parseOne();
      // First item in a frame has no "previous sibling" — glued is
      // meaningless there, so leave it false.
      node.glued = !firstItem && !pendingSpace;
      items.push(node);
      pendingSpace = false;
      firstItem = false;
    }

    return items;
  };

  // Parse a single non-space, non-stop item starting at `i`.
  const parseOne = () => {
    const tok = at();
    switch (tok.type) {
      case T.LBRACE:    return parseBraces();
      case T.LPAREN:    return parseParens();
      case T.LBRACK:    return parseBrackets();
      case T.QUOTE_OPEN: return parseText();
      case T.WORD: {
        i++;
        const w = mkWord(tok.text, tok.line, tok.col);
        if (tok.esc) w.esc = true;
        return w;
      }
      case T.ARROW:     i++; return mkWord('->', tok.line, tok.col); // pipeline op; parseOperators handles it
      // Stray closing delimiters at this point are unmatched.
      case T.RBRACE:
      case T.RPAREN:
      case T.RBRACK:
      case T.QUOTE_CLOSE:
        throw new PunkSyntaxError(`unexpected '${tok.text}'`, tok.line, tok.col);
      case T.TEXT:
        // TEXT tokens should only appear while we're inside parseText;
        // reaching one here means tokenize emitted something weird.
        throw new PunkSyntaxError(
          `unexpected text fragment outside of "..."`,
          tok.line, tok.col,
        );
      default:
        throw new PunkSyntaxError(
          `unexpected token type ${tok.type}`,
          tok.line, tok.col,
        );
    }
  };

  const parseBraces = () => {
    const open = at();
    i++; // consume LBRACE
    const items = parseItems(new Set([T.RBRACE]));
    if (at()?.type !== T.RBRACE) {
      throw new PunkSyntaxError("unclosed '{'", open.line, open.col);
    }
    i++; // consume RBRACE
    return mkTmpl(items, open.line, open.col);
  };

  const parseParens = () => {
    const open = at();
    i++;
    const items = parseItems(new Set([T.RPAREN]));
    if (at()?.type !== T.RPAREN) {
      throw new PunkSyntaxError("unclosed '('", open.line, open.col);
    }
    i++;
    return mkPattern(items, open.line, open.col);
  };

  const parseBrackets = () => {
    const open = at();
    i++;
    const items = parseItems(new Set([T.RBRACK]));
    if (at()?.type !== T.RBRACK) {
      throw new PunkSyntaxError("unclosed '['", open.line, open.col);
    }
    i++;
    return mkBox(items, open.line, open.col);
  };

  // Parse a "..." run. The tokenizer has already split it into TEXT
  // chunks, LBRACE-opened placeholders (which return us to STRUCT
  // mode), and a final QUOTE_CLOSE.
  const parseText = () => {
    const open = at();
    i++; // consume QUOTE_OPEN
    const parts = [];

    while (i < tokens.length) {
      const tok = at();
      if (tok.type === T.QUOTE_CLOSE) {
        i++;
        return mkText(parts, open.line, open.col);
      }
      if (tok.type === T.TEXT) {
        parts.push({ lit: tok.text });
        i++;
        continue;
      }
      if (tok.type === T.LBRACE) {
        // Embedded placeholder: parse a {...} as a Tmpl and store it
        // as an `embed` part. parseTree's normal LBRACE handler does
        // exactly that.
        const tmpl = parseBraces();
        parts.push({ embed: tmpl });
        continue;
      }
      // Anything else inside "..." is the tokenizer's bug, not the user's.
      throw new PunkSyntaxError(
        `unexpected token ${tok.type} inside text template`,
        tok.line, tok.col,
      );
    }

    throw new PunkSyntaxError('unclosed text template', open.line, open.col);
  };

  const items = parseItems(new Set());
  if (at()?.type !== T.EOF) {
    const tok = at();
    throw new PunkSyntaxError(
      `unexpected '${tok.text}'`,
      tok.line, tok.col,
    );
  }
  return mkTmpl(items, 1, 1);
}

// ---------------------------------------------------------------------------
// parseWords — decode raw Word tokens
//
// Walks the parseTree output and replaces each raw `Word` with the right
// refined node (Named / Query / Exec / Partial / Range / Word-with-subkind).
//
// Two structural changes to sibling lists also happen here:
//   - A Word that begins with `.` (a "leading-dot path") attaches to the
//     previous glued sibling as its head; that sibling is consumed.
//   - `name:value` where the value side of the colon is empty AND the
//     Word ends with `:` AND the next sibling is glued: that sibling
//     becomes the value of the Named node. Otherwise the value is
//     decoded from the colon-suffix of the same word.

const RESERVED_NAMES = new Set(['TRUE', 'FALSE', 'NULL']);

// JS-identifier-aligned + hyphen. No leading digit.
const NAME_HEAD = /[A-Za-z_$]/;
const NAME_CHAR = /[A-Za-z0-9_$\-]/;

const isNameHead = (ch) => NAME_HEAD.test(ch);
const isNameChar = (ch) => NAME_CHAR.test(ch);

const isName = (s) => {
  if (!s) return false;
  if (!isNameHead(s[0])) return false;
  for (let i = 1; i < s.length; i++) if (!isNameChar(s[i])) return false;
  return true;
};

// A non-negative integer literal (path segments only — no sign, no dot).
const INT_RE = /^[0-9]+$/;
const isInt = (s) => INT_RE.test(s);

// Is this string a valid path-head name? Names (JS-ident-style) ARE
// valid, but Punk also uses operator-style symbols as function names
// (`+`, `*`, `>`, `=` etc.). For the parse stage we accept anything
// non-empty that isn't a pure number literal and contains no `.`;
// "is this name actually bound" is checked by parseValidate / eval.
const isValidPathHead = (s) =>
  s.length > 0 && !isNumber(s) && !s.includes('.') && !s.includes('~');

// Number literal as used by Word subkind detection. Allows optional
// leading `-`, a decimal point, and an optional exponent. Doc lines
// for numbers may evolve; this matches the obvious cases.
const NUMBER_RE = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const isNumber = (s) => NUMBER_RE.test(s);

// Decode a range word like `5~15`, `~15`, `5~`, `~`.
// Returns { from, to } with integer or null; throws on bad shape.
const decodeRangeWord = (text, line, col) => {
  // exactly one `~`
  const parts = text.split('~');
  if (parts.length !== 2) {
    throw new PunkSyntaxError(`bad range '${text}'`, line, col);
  }
  const [a, b] = parts;
  const decode = (side) => {
    if (side === '') return null;
    if (!isInt(side)) {
      throw new PunkSyntaxError(`range bound '${side}' must be an integer`, line, col);
    }
    return parseInt(side, 10);
  };
  return { from: decode(a), to: decode(b) };
};

// Decode the segment list of a path. `segs` is the array of non-empty
// segment strings between dots. Throws on illegal segments.
//
// Recognised segment forms:
//   N        → { kind: 'index', n }
//   #        → { kind: 'length' }      (final only)
//   :        → { kind: 'nameOf' }      (final only)
//   ()       → { kind: 'pattern' }     (final only)
//   name     → { kind: 'name', text }
//   N~M etc. → { kind: 'range', from, to }
const decodeSegments = (segs, line, col) => {
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = i === segs.length - 1;
    if (s === '#') {
      if (!last) throw new PunkSyntaxError("'#' must be the final path segment", line, col);
      out.push({ kind: 'length' });
    } else if (s === ':') {
      if (!last) throw new PunkSyntaxError("':' must be the final path segment", line, col);
      out.push({ kind: 'nameOf' });
    } else if (s === '()') {
      if (!last) throw new PunkSyntaxError("'()' must be the final path segment", line, col);
      out.push({ kind: 'pattern' });
    } else if (s.includes('~')) {
      const { from, to } = decodeRangeWord(s, line, col);
      out.push({ kind: 'range', from, to });
    } else if (isInt(s)) {
      const n = parseInt(s, 10);
      out.push({ kind: 'index', n });
    } else if (isName(s)) {
      out.push({ kind: 'name', text: s });
    } else {
      throw new PunkSyntaxError(`bad path segment '${s}'`, line, col);
    }
  }
  return out;
};

// Split a path body (the part before the trailing ? / ! / ') into
// segments at unescaped dots. The body itself never contains escapes
// after tokenize (those are already decoded), but a `.` inside a `()`
// segment must be respected — though `()` is the entire segment, so a
// dot can only appear by itself. We just split on `.`.
//
// Returns the segments array; empty strings (from leading/trailing
// dots or doubled dots) are an error.
const splitPath = (body, line, col) => {
  const segs = body.split('.');
  for (const s of segs) {
    if (s === '') throw new PunkSyntaxError(`empty path segment in '${body}'`, line, col);
  }
  return segs;
};

// Decode a single non-leading-dot raw word into its refined node.
// May return any of: Word (with subkind), Named, Query, Exec, Partial,
// Range. The returned node copies glued/line/col from `w`.
//
// Special "leading-dot" words (starting with `.`) are NOT decoded here;
// they are handled by attachLeadingDotPaths which has access to the
// previous sibling.
const decodeWord = (w) => {
  const { text, line, col, glued } = w;
  const copy = (node) => { if (glued) node.glued = true; return node; };

  // Reserved literals
  if (RESERVED_NAMES.has(text) && !w.esc) {
    return copy({ kind: 'Word', text, subkind: 'reserved', line, col });
  }
  if (text === '_') {
    return copy({ kind: 'Word', text, subkind: 'wildcard', line, col });
  }
  if (text === '*') {
    return copy({ kind: 'Word', text, subkind: 'variadic', line, col });
  }
  // Bare `!` — used as the pipeline-execute marker. parseOperators
  // attaches semantic meaning; here we just allow it through.
  if (text === '!') {
    return copy({ kind: 'Word', text, subkind: 'bang', line, col });
  }

  // Bare `?` and `??` are match operators (predicate / dispatch).
  // The trailing `?` on a path word is consumed as a Query trigger;
  // a standalone `?` (after a delimited value) and the second `?` of
  // `??` (split off by the tokenizer) are match operators.
  // parseOperators wires them into Match nodes.
  if (text === '?' || text === '??') {
    return copy({ kind: 'Word', text, subkind: 'match-op', line, col });
  }

  // Range word (contains `~` and is not a path)
  const last = text[text.length - 1];
  const endsPath = last === '?' || last === '!' || last === "'";
  if (!endsPath && text.includes('~')) {
    const { from, to } = decodeRangeWord(text, line, col);
    return copy(mkRange(from, to, line, col));
  }

  // `name:value` (word contains `:` after a valid-name prefix).
  // Try this BEFORE the path check so `add:foo!5` splits at `:` first,
  // and AFTER the path check the value-part `foo!5` recursively decodes.
  //
  // Special exception: `xs.:?` is a path whose final segment is `:`, not
  // a `name:value` binding. We only treat `:` as a binder if the prefix
  // before the colon is itself a valid identifier name.
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0) {
    const namePart = text.slice(0, colonIdx);
    if (isName(namePart)) {
      if (RESERVED_NAMES.has(namePart)) {
        throw new PunkSyntaxError(
          `cannot bind to reserved name '${namePart}'`, line, col,
        );
      }
      const valuePart = text.slice(colonIdx + 1);
      if (valuePart === '') {
        return copy(mkNamed(namePart, null, line, col));
      }
      const valueNode = decodeWord(mkWord(valuePart, line, col));
      return copy(mkNamed(namePart, valueNode, line, col));
    }
    // The text has a colon but the prefix is not a valid name. The
    // only legitimate way a non-name can carry a `:` is a path whose
    // final segment is `.:?` (e.g. `xs.:?`) — that case is caught by
    // the path branch below. Anything else (e.g. `1foo:5`) is a bad
    // binding name.
    const last2 = text[text.length - 1];
    const looksLikePath =
      (last2 === '?' || last2 === '!' || last2 === "'")
      && text.includes('.');
    if (!looksLikePath) {
      throw new PunkSyntaxError(
        `'${namePart}' is not a valid binding name`, line, col,
      );
    }
  }

  // Mid-word `!` or `'` with a simple value on the right.
  // `add!5` → Exec(add, args:{5}); `times'2` → Partial(times, args:{2}).
  // Right side must be a single name or single non-negative integer.
  const midBangIdx = findMidBang(text);
  if (midBangIdx >= 0) {
    const head = text.slice(0, midBangIdx);
    const op = text[midBangIdx];
    const rhs = text.slice(midBangIdx + 1);
    if (rhs === '') {
      // shouldn't happen — findMidBang only returns non-end indices
      throw new PunkSyntaxError(`bad word '${text}'`, line, col);
    }
    if (!isName(rhs) && !isNumber(rhs) && /[!'?:.]/.test(rhs)) {
      throw new PunkSyntaxError(
        `'${text}': the value after '${op}' must be a single value`,
        line, col,
      );
    }
    // Head must itself be a valid path head.
    const segs = splitPath(head, line, col);
    const headRaw = segs[0];
    if (isInt(headRaw)) {
      throw new PunkSyntaxError(
        `a number cannot head a path ('${text}')`, line, col,
      );
    }
    if (!isValidPathHead(headRaw)) {
      throw new PunkSyntaxError(
        `'${headRaw}' is not a valid path head`, line, col,
      );
    }
    const tail = decodeSegments(segs.slice(1), line, col);
    const make = op === '!' ? mkExec : mkPartial;
    const argWord = decodeWord(mkWord(rhs, line, col));
    const argTmpl = mkTmpl([argWord], line, col);
    const node = make(headRaw, tail, line, col);
    node.args = argTmpl;
    return copy(node);
  }

  // Path-end (Query / Exec / Partial with no embedded args)
  if (endsPath) {
    const body = text.slice(0, -1);
    if (body === '') {
      throw new PunkSyntaxError(`'${last}' with no path`, line, col);
    }
    const segs = splitPath(body, line, col);
    const headRaw = segs[0];
    if (isInt(headRaw)) {
      throw new PunkSyntaxError(
        `a number cannot head a path ('${text}')`, line, col,
      );
    }
    if (!isValidPathHead(headRaw)) {
      throw new PunkSyntaxError(
        `'${headRaw}' is not a valid path head`, line, col,
      );
    }
    const tail = decodeSegments(segs.slice(1), line, col);
    const make =
      last === '?' ? mkQuery :
      last === '!' ? mkExec  : mkPartial;
    return copy(make(headRaw, tail, line, col));
  }

  // Bare number literal
  if (isNumber(text)) {
    return copy({ kind: 'Word', text, subkind: 'number', line, col });
  }

  // Plain value word (operator-like punctuation also lands here).
  if (isName(text)) {
    return copy({ kind: 'Word', text, subkind: 'value', line, col });
  }
  return copy({ kind: 'Word', text, subkind: 'op', line, col });
};

// Find the index of the first mid-word `!` or `'` (i.e., not the
// terminating char). Returns -1 if there isn't one. This is used to
// detect the `name!arg` / `name'arg` short forms.
const findMidBang = (text) => {
  for (let i = 0; i < text.length - 1; i++) {
    const c = text[i];
    if (c === '!' || c === "'") return i;
  }
  return -1;
};

// Walk a sibling list, decoding each Word. Handles two sibling-aware
// rules:
//   (a) A raw Word starting with `.` attaches to the previous sibling
//       (which must be glued? No — the dot-word must itself be glued).
//   (b) A `Named` with value=null absorbs the next glued sibling.
const walkSiblings = (items) => {
  // First pass: decode each non-leading-dot word in place. Leading-dot
  // words stay as raw Word for the second pass.
  const decoded = items.map((it) => {
    if (it.kind !== 'Word') return walkNode(it);
    if (it.text.startsWith('.')) return it; // defer
    return decodeWord(it);
  });

  // Second pass (left-to-right): attach leading-dot paths to prev sibling.
  const attached = [];
  for (const it of decoded) {
    if (it.kind === 'Word' && it.text.startsWith('.')) {
      const prev = attached[attached.length - 1];
      if (!prev || !it.glued) {
        throw new PunkSyntaxError(
          `'${it.text}' has no path head`, it.line, it.col,
        );
      }
      // Build a Query/Exec/Partial whose head is `prev`.
      const { text, line, col } = it;
      const last = text[text.length - 1];
      if (last !== '?' && last !== '!' && last !== "'") {
        throw new PunkSyntaxError(
          `'${text}' is not a valid path`, line, col,
        );
      }
      const body = text.slice(1, -1); // strip leading `.` and suffix
      if (body === '') {
        throw new PunkSyntaxError(`'${text}' has no segments`, line, col);
      }
      const segs = splitPath(body, line, col);
      const decodedSegs = decodeSegments(segs, line, col);
      const make =
        last === '?' ? mkQuery :
        last === '!' ? mkExec  : mkPartial;
      // The new node inherits prev's `glued` flag (it sits where prev sat).
      const node = make(prev, decodedSegs, prev.line, prev.col);
      if (prev.glued) node.glued = true;
      attached[attached.length - 1] = node;
      continue;
    }
    attached.push(it);
  }

  // Note: dangling `Named` (value === null) is intentionally NOT
  // resolved here. parseOperators handles it last, AFTER Fn formation,
  // arg attachment, and pipeline collapse — so the value it absorbs is
  // already in its final form.

  return attached;
};

// Recurse into a single node, returning a new node with its children
// processed by walkSiblings.
const walkNode = (node) => {
  switch (node.kind) {
    case 'Tmpl': {
      const items = walkSiblings(node.items);
      const out = mkTmpl(items, node.line, node.col);
      if (node.glued) out.glued = true;
      return out;
    }
    case 'Pattern': {
      const items = walkSiblings(node.items);
      const out = mkPattern(items, node.line, node.col);
      if (node.glued) out.glued = true;
      return out;
    }
    case 'Box': {
      const items = walkSiblings(node.items);
      const out = mkBox(items, node.line, node.col);
      if (node.glued) out.glued = true;
      return out;
    }
    case 'Text': {
      const parts = node.parts.map((p) =>
        'embed' in p ? { embed: walkNode(p.embed) } : p,
      );
      const out = mkText(parts, node.line, node.col);
      if (node.glued) out.glued = true;
      return out;
    }
    case 'Word':
      // A bare Word at this point (not inside a sibling walk) — should
      // not normally happen because walkSiblings catches them. Decode
      // defensively.
      if (node.text.startsWith('.')) {
        throw new PunkSyntaxError(
          `'${node.text}' has no path head`, node.line, node.col,
        );
      }
      return decodeWord(node);
    default:
      return node;
  }
};

export function parseWords(tree) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('parseWords: expected a Tmpl root');
  }
  return walkNode(tree);
}

// ---------------------------------------------------------------------------
// parseOperators — sibling-level adjacency merges
//
// Runs after parseWords. Performs five passes on every sibling list in
// the tree, in this exact order:
//
//   1. Fn formation:
//        Pattern  +  glued <node>   →  Fn { params, body }
//        body is wrapped in a 1-item Tmpl if the glued node isn't itself
//        a Tmpl.
//   2. Return-range:
//        Fn  +  glued Range          →  Fn (returnRange set)
//   3. Args attachment:
//        Exec/Partial (no .args)  +  glued Tmpl   →  Exec/Partial (args set)
//   4. Pipeline collapse:
//        a -> b -> c [!]              →  Pipeline { stages, execute }
//        execute is true iff the chain ends with an Exec OR a bare `!`
//        Word glued after the last stage.
//   5. Resolve PendingNamed:
//        Named (value=null)  +  glued <node>   →  Named (value set)
//
// All passes are pure: each returns a new sibling list. The tree is
// recursed first so inner siblings are already merged before their
// container is considered.

const mkFn       = (params, body, line, col)  => ({ kind: 'Fn', params, body, line, col });
const mkPipeline = (stages, execute, line, col) =>
  ({ kind: 'Pipeline', stages, execute, line, col });

// Walk node tree depth-first; recurse into children first, then run
// the five-pass sibling merge on this node's items (if it has any).
const opsWalk = (node) => {
  switch (node.kind) {
    case 'Tmpl':
    case 'Pattern':
    case 'Box': {
      const items = node.items.map(opsWalk);
      const merged = mergeSiblings(items);
      const out = { ...node, items: merged };
      return out;
    }
    case 'Text': {
      const parts = node.parts.map((p) =>
        'embed' in p ? { embed: opsWalk(p.embed) } : p,
      );
      return { ...node, parts };
    }
    case 'Named':
      if (node.value !== null) {
        return { ...node, value: opsWalk(node.value) };
      }
      return node;
    case 'Query':
    case 'Exec':
    case 'Partial': {
      // The head may be a node (when attached from a leading-dot path)
      // — recurse into it. Also recurse into embedded args (rare;
      // arg tmpls from mid-`!` short forms contain only a single
      // primitive value, but be safe).
      const out = { ...node };
      if (node.head && typeof node.head === 'object') {
        out.head = opsWalk(node.head);
      }
      if (node.args) out.args = opsWalk(node.args);
      return out;
    }
    default:
      return node;
  }
};

// The five-pass merge on one sibling list.
const mergeSiblings = (items) => {
  let xs = items;
  xs = passArgsAttach(xs);
  xs = passFnFormation(xs);
  xs = passArgsAttach(xs);
  xs = passMatch(xs);
  xs = passReturnRange(xs);
  xs = passPostfixBang(xs);
  xs = passPipeline(xs);
  xs = passResolveNamed(xs);
  return xs;
};

// Match form — `Match { subject, branches:[{pattern, body|null}] }`.
//
// Recognises three shapes (after passFnFormation has merged
// `Pattern + Tmpl` into Fn):
//
//   1. Predicate, bareword subject  : Query glued Pattern
//                                     → Match(subject=Query, [{pat, body:null}])
//   2. If-then, bareword subject    : Query glued Fn
//                                     → Match(subject=Query, [{fn.params, body:fn.body}])
//   3. Explicit match op            : <value> glued Word(match-op) glued ...
//        - followed by Pattern      → predicate
//        - followed by Fn           → if-then
//        - followed by Tmpl-of-Fns  → dispatch (multi-arm)
//
// Subject can be any value-kind: Query (the most common shape), Tmpl,
// Text, Box, Pattern, Fn — anything an outer `!` can later cascade.
const isMatchOp = (n) => n && n.kind === 'Word' && n.subkind === 'match-op';

const tmplOfFnsBranches = (tmpl) => {
  // Each item must be a Fn; otherwise return null (caller decides).
  const out = [];
  for (const it of tmpl.items) {
    if (!it || it.kind !== 'Fn') return null;
    out.push({ pattern: it.params, body: it.body });
  }
  return out;
};

const matchValueSubject = (n) => {
  if (!n) return false;
  switch (n.kind) {
    case 'Query': case 'Tmpl': case 'Text': case 'Box':
    case 'Pattern': case 'Fn': case 'Exec': case 'Partial':
    case 'Word': case 'Range':
      return true;
    default: return false;
  }
};

const passMatch = (xs) => {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    const a = xs[i + 1];
    const b = xs[i + 2];

    // Case 1 & 2 — Query glued Pattern/Fn (bareword subject; the `?`
    // was consumed by the path word).
    if (cur.kind === 'Query' && a && a.glued
        && (a.kind === 'Pattern' || a.kind === 'Fn')) {
      const branches = a.kind === 'Pattern'
        ? [{ pattern: stripGlued(a), body: null }]
        : [{ pattern: a.params, body: a.body }];
      const node = mkMatch(stripGlued(cur), branches, cur.line, cur.col);
      if (cur.glued) node.glued = true;
      out.push(node);
      i += 1;
      continue;
    }

    // Case 3 — explicit match op `?` between subject and arm(s).
    if (matchValueSubject(cur) && a && a.glued && isMatchOp(a)
        && b && b.glued) {
      let branches = null;
      if (b.kind === 'Pattern') {
        branches = [{ pattern: stripGlued(b), body: null }];
      } else if (b.kind === 'Fn') {
        branches = [{ pattern: b.params, body: b.body }];
      } else if (b.kind === 'Tmpl') {
        branches = tmplOfFnsBranches(b);
        if (branches === null) {
          throw new PunkSyntaxError(
            `match-dispatch arms must all be functions (pattern + body)`,
            b.line, b.col,
          );
        }
      }
      if (branches !== null) {
        const node = mkMatch(stripGlued(cur), branches, cur.line, cur.col);
        if (cur.glued) node.glued = true;
        out.push(node);
        i += 2;
        continue;
      }
      throw new PunkSyntaxError(
        `match operator '${a.text}' must be followed by a pattern, a function, or a template of functions`,
        a.line, a.col,
      );
    }

    // A standalone match-op that didn't pair up is a stray operator.
    if (isMatchOp(cur)) {
      throw new PunkSyntaxError(
        `stray '${cur.text}' — match operator needs a value on the left and a pattern/function on the right`,
        cur.line, cur.col,
      );
    }

    out.push(cur);
  }
  return out;
};


// Pass 1 — `Pattern + glued <node>` → `Fn`.
const passFnFormation = (xs) => {
  // Right-to-left so nested `(p1)(p2){body}` forms the inner Fn first,
  // then becomes the body of the outer Pattern.
  const out = [];
  for (let i = xs.length - 1; i >= 0; i--) {
    const cur = xs[i];
    const next = out[out.length - 1]; // next sibling to the right
    if (cur.kind === 'Pattern' && next && next.glued) {
      out.pop();
      const bodyTmpl = next.kind === 'Tmpl'
        ? next
        : mkTmpl([stripGlued(next)], next.line, next.col);
      const fn = mkFn(cur, bodyTmpl, cur.line, cur.col);
      if (cur.glued) fn.glued = true;
      out.push(fn);
      continue;
    }
    out.push(cur);
  }
  return out.reverse();
};

// Pass 2 — `Fn + glued Range` → set returnRange.
const passReturnRange = (xs) => {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    const next = xs[i + 1];
    if (cur.kind === 'Fn' && next && next.kind === 'Range' && next.glued) {
      const fn = { ...cur, returnRange: { from: next.from, to: next.to } };
      out.push(fn);
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
};

// Pass 3 — `Exec/Partial (no args) + glued value` → attach args.
// A glued Tmpl attaches as-is; any other glued value-kind attaches as
// a singleton-Tmpl (`f!"hi"` ≡ `f!{"hi"}`, `f![b]` ≡ `f!{[b]}`).
const passArgsAttach = (xs) => {
  const out = [];
  const isSingleArg = (n) => n && (
    n.kind === 'Text' || n.kind === 'Box' || n.kind === 'Fn' ||
    n.kind === 'Pattern' || n.kind === 'Query' || n.kind === 'Exec' ||
    n.kind === 'Partial' || n.kind === 'Range'
    // Bare Word is handled by mid-word `!` in decodeWord; if a Word
    // ends up as a separate token here, it's not glued to the bang
    // anyway.
  );
  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    const next = xs[i + 1];
    const after = xs[i + 2];
    if (
      (cur.kind === 'Exec' || cur.kind === 'Partial') &&
      !cur.args && next && next.glued
    ) {
      // Don't eat a Pattern that will form a Fn with the next sibling.
      // (passFnFormation runs after this pass and pairs Pattern + glued
      //  body. We want the resulting Fn to be the args here, not the
      //  bare Pattern.)
      if (next.kind === 'Pattern' && after && after.glued) {
        out.push(cur);
        continue;
      }
      if (next.kind === 'Tmpl') {
        const node = { ...cur, args: stripGlued(next) };
        if (cur.glued) node.glued = true;
        out.push(node);
        i++;
        continue;
      }
      if (isSingleArg(next)) {
        const node = {
          ...cur,
          args: mkTmpl([stripGlued(next)], next.line, next.col),
        };
        if (cur.glued) node.glued = true;
        out.push(node);
        i++;
        continue;
      }
    }
    out.push(cur);
  }
  return out;
};

// Pass 4 — postfix `!` glued to a value: `{...}!`, `"..."!`, `[name]!`
// → an Exec whose head IS the value, no args. At eval-time this means
// "cascade through the value": for a Tmpl/Text, resolve embedded
// queries/Execs; for a Fn, call with no args.
const passPostfixBang = (xs) => {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    const next = xs[i + 1];
    if (
      next && next.kind === 'Word' && next.subkind === 'bang' && next.glued
      // Only on values that don't already carry their own `!`/`?` rule.
      && (cur.kind === 'Tmpl' || cur.kind === 'Text' || cur.kind === 'Box'
          || cur.kind === 'Fn'  || cur.kind === 'Pattern' || cur.kind === 'Pipeline')
    ) {
      // If this is the start of a pipeline (cur + glued ->), let
      // passPipeline handle it. Otherwise consume the bang here.
      const after = xs[i + 2];
      if (after && after.kind === 'Word' && after.text === '->' && after.glued) {
        out.push(cur);
        continue;
      }
      const exec = {
        kind: 'Exec',
        head: stripGlued(cur),
        segments: [],
        line: cur.line, col: cur.col,
      };
      if (cur.glued) exec.glued = true;
      out.push(exec);
      i++; // consume bang
      continue;
    }
    out.push(cur);
  }
  return out;
};

// Pass 5 — collapse `->` chains into Pipeline.
// A pipeline is a sequence of stages separated by `Word('->')` items.
// Every `->` must be glued on BOTH sides (the tokenizer already ensures
// no-whitespace via the ARROW token; here glue is enforced via the
// `glued` flag on each Word adjacent to it).
const passPipeline = (xs) => {
  const out = [];
  let i = 0;
  while (i < xs.length) {
    // Try to start a pipeline at index i.
    const start = xs[i];
    // Heuristic: a pipeline starts if the next non-current sibling is
    // `Word('->')` and that arrow is glued to its neighbours.
    const arrowAt = (k) => {
      const w = xs[k];
      return w && w.kind === 'Word' && w.text === '->';
    };
    if (i + 1 < xs.length && arrowAt(i + 1) && xs[i + 1].glued) {
      const stages = [start];
      let j = i + 1;
      while (arrowAt(j) && xs[j].glued) {
        const stage = xs[j + 1];
        if (!stage || !stage.glued || stage.kind === 'Word' && stage.text === '->') {
          throw new PunkSyntaxError(
            `'->' must be followed by a glued value`,
            xs[j].line, xs[j].col,
          );
        }
        stages.push(stage);
        j += 2;
      }
      // Detect trailing bare `!` glued after the last stage.
      let execute = false;
      const tail = xs[j];
      const lastStage = stages[stages.length - 1];
      if (tail && tail.kind === 'Word' && tail.text === '!' && tail.glued) {
        execute = true;
        j++;
      } else if (lastStage.kind === 'Exec') {
        // `...->log!` — the Exec at the tail acts as the executor.
        execute = true;
      }
      const pipe = mkPipeline(stages.map(stripGlued), execute, start.line, start.col);
      if (start.glued) pipe.glued = true;
      out.push(pipe);
      i = j;
      continue;
    }
    out.push(start);
    i++;
  }
  return out;
};

// Pass 5 — resolve `Named { value: null }` by absorbing the next glued sibling.
const passResolveNamed = (xs) => {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    if (cur.kind === 'Named' && cur.value === null) {
      const next = xs[i + 1];
      if (!next || !next.glued) {
        throw new PunkSyntaxError(
          `'${cur.name}:' has no value`, cur.line, cur.col,
        );
      }
      const resolved = { ...cur, value: stripGlued(next) };
      out.push(resolved);
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
};

// Return a shallow copy of `node` with its `glued` flag removed.
// Used when absorbing a sibling into a parent (glue no longer applies).
const stripGlued = (node) => {
  if (!node || !('glued' in node)) return node;
  const copy = { ...node };
  delete copy.glued;
  return copy;
};

export function parseOperators(tree) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('parseOperators: expected a Tmpl root');
  }
  return opsWalk(tree);
}

// ---------------------------------------------------------------------------
// parseValidate
//
// Pass 4 of the parser. Catches purely structural mistakes that survived
// the earlier passes. Name resolution is NOT done here — that lives in
// eval where the built-in environment is known.
//
// Checks:
//   1. Bare `!` (Word{subkind:'bang'}) anywhere in the tree
//        — parseOperators absorbs valid ones into Pipelines, so a
//          survivor means a stray `!` with nothing to execute.
//   2. Range value with both bounds where `to < from`, or `from === to`
//        (degenerate; use the literal instead).
//   3. Same check on Range path-segments inside Query/Exec/Partial.
//   4. PendingNamed (Named{value:null}) survivor → `xs:` with no value.
//   5. Fn with a returnRange but a body of zero items
//        — nothing to slice; the range can never produce a value.
//   6. Standalone Range value (in a Tmpl, not inside a path or a Fn
//      return-range) with an open end (`from === null` or `to === null`):
//      `{~5}` and `{5~}` have no implicit endpoint as a value.
//
// Note: `_` (wildcard) and `*` (variadic) Words can appear anywhere —
// they are only "slots" when they're direct children of a Pattern, and
// elsewhere they're just ordinary text.

const validateNode = (node, stack) => {
  if (!node || typeof node !== 'object') return;

  switch (node.kind) {
    case 'Word': {
      // `_` (wildcard) and `*` (variadic) are only "special" when they
      // are direct slots inside a Pattern. Anywhere else they're just
      // ordinary Words — no error, they behave like any other text.
      if (node.subkind === 'bang') {
        throw new PunkSyntaxError(
          "stray '!' — nothing to execute (bare '!' is only valid as the trigger of a -> pipeline)",
          node.line, node.col,
        );
      }
      return;
    }

    case 'Named': {
      if (node.value === null) {
        throw new PunkSyntaxError(
          `'${node.name}:' has nothing on the right to bind to`,
          node.line, node.col,
        );
      }
      validateNode(node.value, [...stack, node]);
      return;
    }

    case 'Range': {
      validateRangeBounds(node, /*standalone*/ true, stack);
      return;
    }

    case 'Query':
    case 'Exec':
    case 'Partial': {
      if (node.head && typeof node.head === 'object') {
        validateNode(node.head, [...stack, node]);
      }
      for (const seg of (node.segments || [])) {
        if (seg.kind === 'range') {
          // Path-segment range — bounds are seg.from / seg.to (ints or null).
          validateRangeBounds(seg, /*standalone*/ false, stack, node);
        }
      }
      if (node.args) validateNode(node.args, [...stack, node]);
      return;
    }

    case 'Fn': {
      if (node.returnRange && node.body && node.body.items.length === 0) {
        throw new PunkSyntaxError(
          'function has a return-range but an empty body — nothing to slice',
          node.line, node.col,
        );
      }
      validateNode(node.params, [...stack, node]);
      validateNode(node.body, [...stack, node]);
      return;
    }

    case 'Pipeline': {
      const childStack = [...stack, node];
      for (const stage of node.stages) validateNode(stage, childStack);
      return;
    }

    case 'Tmpl':
    case 'Pattern':
    case 'Box': {
      const childStack = [...stack, node];
      for (const item of node.items) validateNode(item, childStack);
      return;
    }

    case 'Text': {
      const childStack = [...stack, node];
      for (const part of node.parts) {
        if (part && typeof part === 'object' && 'embed' in part) {
          validateNode(part.embed, childStack);
        }
      }
      return;
    }

    default:
      return;
  }
};

const validateRangeBounds = (node, standalone, stack, owner) => {
  const { from, to } = node;
  if (standalone) {
    // Standalone Range value (inside a Tmpl, NOT as a Fn return-range).
    // Fn return-ranges are stored on the Fn node, not as a sibling Range —
    // so any Range we land on here is a value-position range.
    if (from === null || to === null) {
      throw new PunkSyntaxError(
        "open-ended range needs a path or collection to anchor to — "
        + "give it both a 'from' and a 'to' as a value",
        node.line, node.col,
      );
    }
  }
  if (from !== null && to !== null) {
    if (to < from && standalone) {
      throw new PunkSyntaxError(
        `range '${from}~${to}' goes backwards (to < from)`,
        node.line, node.col,
      );
    }
  }
};

export function parseValidate(tree) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('parseValidate: expected a Tmpl root');
  }
  validateNode(tree, []);
  return tree;
}
