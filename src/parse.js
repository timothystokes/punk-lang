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
//   { kind: 'index',   n: <int> }                  // .1
//   { kind: 'name',    text: <string> }            // .fullname
//   { kind: 'length' }                             // .#  (final only)
//   { kind: 'nameOf' }                             // .:  (final only)
//   { kind: 'pattern' }                            // .() (final only)
//   { kind: 'range',   from: <int|null>, to: <int|null> }
//   { kind: 'dynamic', expr: <Node> }              // .{q?}  — eval expr; result
//                                                  //   chooses index (number) or
//                                                  //   name (text) at runtime
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
  // Re-glue adjacent WORD nodes that the tokenizer split.
  //
  // Tokenize now terminates a word at every unescaped `!`, `?`, `'`
  // and emits the marker as its own single-char WORD token. The rest
  // of the parser still operates on "fat" words like `add!5` or
  // `foo.bar?` — so this pass rebuilds them by concatenating any run
  // of glued WORD nodes into one Word.
  //
  // After the merge, mirror the historic `??`-split: a path-word that
  // ends with `??` (length > 2) gets its trailing `?` peeled off as a
  // glued standalone WORD, so the second `?` can be wired up as a
  // match operator by parseOperators.
  const reglueWords = (items) => {
    const isMarker = (t) => t === '!' || t === '?' || t === "'";
    const merged = [];
    for (const it of items) {
      const prev = merged[merged.length - 1];
      if (
        prev && prev.kind === 'Word' && it.kind === 'Word'
        && it.glued && prev._fromWordTok && it._fromWordTok
        && isMarker(it.text)
      ) {
        prev.text += it.text;
        if (it.esc) prev.esc = true;
        continue;
      }
      merged.push(it);
    }
    const out = [];
    for (const it of merged) {
      if (
        it.kind === 'Word' && it._fromWordTok
        && it.text.length > 2 && it.text.endsWith('??')
      ) {
        const head = { ...it, text: it.text.slice(0, -1) };
        const tail = mkWord('?', it.line, it.col + it.text.length - 1);
        tail.glued = true;
        tail._fromWordTok = true;
        out.push(head, tail);
      } else {
        out.push(it);
      }
    }
    for (const it of out) if (it._fromWordTok) delete it._fromWordTok;
    return out;
  };

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

    return reglueWords(items);
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
        w._fromWordTok = true;
        return w;
      }
      case T.REGEX: {
        i++;
        return {
          kind: 'Regex', body: tok.body, flags: tok.flags,
          text: tok.text, line: tok.line, col: tok.col,
        };
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

// Escapes (`\X` two-char sequences) are preserved verbatim in token
// text. Helpers below operate on a "structural" view of the text in
// which each `\X` is an opaque literal char that never carries
// structural meaning (never a path-dot, name-char, bang, etc.).
const hasEscape = (s) => s.includes('\\');

// Was the final character of `s` written unescaped? Counts trailing
// backslashes: an even number means the last char is structural.
const endsWithUnescaped = (s, c) => {
  if (s.length === 0 || s[s.length - 1] !== c) return false;
  let n = 0;
  for (let i = s.length - 2; i >= 0 && s[i] === '\\'; i--) n++;
  return n % 2 === 0;
};

// Does `s` contain an unescaped occurrence of `c`?
const hasUnescaped = (s, c) => {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === c) return true;
  }
  return false;
};

// First index of an unescaped `c` in `s`, or -1.
const indexOfUnescaped = (s, c) => {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === c) return i;
  }
  return -1;
};

// Names cannot contain any escape (or any escaped char). A backslash
// anywhere disqualifies the word from being a name.
const isName = (s) => {
  if (!s) return false;
  if (hasEscape(s)) return false;
  if (!isNameHead(s[0])) return false;
  for (let i = 1; i < s.length; i++) if (!isNameChar(s[i])) return false;
  return true;
};

// A non-negative integer literal (path segments only — no sign, no dot).
const INT_RE = /^[0-9]+$/;
const isInt = (s) => !hasEscape(s) && INT_RE.test(s);

// Number literal as used by Word subkind detection. Allows optional
// leading `-`, a decimal point, and an optional exponent. Escapes in
// the text disqualify it from being a number.
const NUMBER_RE = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const isNumber = (s) => !hasEscape(s) && NUMBER_RE.test(s);

// Is this string a valid path-head name? Names (JS-ident-style) ARE
// valid, but Punk also uses operator-style symbols as function names
// (`+`, `*`, `>`, `=` etc.). For the parse stage we accept anything
// non-empty that isn't a pure number literal and contains no
// *unescaped* `.` or `~`. Escapes elsewhere already disqualify since
// a head with escapes is a literal value-word, not a callable name.
const isValidPathHead = (s) => {
  if (s.length === 0) return false;
  if (hasEscape(s)) return false;
  if (isNumber(s)) return false;
  return !s.includes('.') && !s.includes('~');
};

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
// segments at unescaped dots. Escaped dots (`\.`) are preserved
// verbatim inside their segment.
//
// Returns the segments array; empty strings (from leading/trailing
// dots or doubled dots) are an error.
const splitPath = (body, line, col) => {
  const segs = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      cur += c + body[i + 1];
      i++;
      continue;
    }
    if (c === '.') {
      if (cur === '') {
        throw new PunkSyntaxError(`empty path segment in '${body}'`, line, col);
      }
      segs.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur === '') {
    throw new PunkSyntaxError(`empty path segment in '${body}'`, line, col);
  }
  segs.push(cur);
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
  const endsPath = endsWithUnescaped(text, '?')
    || endsWithUnescaped(text, '!')
    || endsWithUnescaped(text, "'");
  const last = endsPath ? text[text.length - 1] : null;

  // A Word ending in an unescaped `.` is only valid as the head of a
  // dynamic-path chain (handled earlier by assembleDynamicPaths). If
  // we reach decodeWord with a trailing dot, the chain didn't form —
  // so this is a syntax error. Use `\.` to embed a literal dot.
  if (!endsPath && endsWithUnescaped(text, '.')) {
    throw new PunkSyntaxError(
      `'${text}' — a word cannot end with '.' (use \\. for a literal dot)`,
      line, col,
    );
  }

  if (!endsPath && hasUnescaped(text, '~')) {
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
  const colonIdx = indexOfUnescaped(text, ':');
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

  // Path-end (Query / Exec / Partial with no embedded args)
  if (endsPath) {
    let body = text.slice(0, -1);
    // `.?` spread terminator: a trailing dot just before `?` flips this
    // into a "spread the full thing" query (P1 — uniform query model).
    let spread = false;
    if (last === '?' && body.length >= 1 && body[body.length - 1] === '.'
        && !(body.length >= 2 && body[body.length - 2] === '\\')) {
      spread = true;
      body = body.slice(0, -1);
    }
    if (body === '') {
      if (spread) {
        throw new PunkSyntaxError(`'.?' with no path head`, line, col);
      }
      throw new PunkSyntaxError(`'${last}' with no path`, line, col);
    }
    const segs = splitPath(body, line, col);
    const headRaw = segs[0];
    let headNode = null;
    if (isInt(headRaw)) {
      // A number can head a path only when every tail segment is a
      // "meta" segment that's defined on any value: `.()` (pattern) or
      // `.:` (name). Anything else (`.1`, `.#`, `.1~3`) implies the
      // head is a container, which a number is not.
      const tailSegs = segs.slice(1);
      const allMeta = tailSegs.length > 0
        && tailSegs.every((s) => s === '()' || s === ':');
      if (!allMeta) {
        throw new PunkSyntaxError(
          `a number cannot head a path ('${text}')`, line, col,
        );
      }
      headNode = { kind: 'Word', text: headRaw, subkind: 'number', line, col };
    } else if (!isValidPathHead(headRaw)) {
      throw new PunkSyntaxError(
        `'${headRaw}' is not a valid path head`, line, col,
      );
    }
    const tail = decodeSegments(segs.slice(1), line, col);
    const make =
      last === '?' ? mkQuery :
      last === '!' ? mkExec  : mkPartial;
    const node = make(headNode || headRaw, tail, line, col);
    if (spread) node.spread = true;
    return copy(node);
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

// Coalesce adjacent glued path/range segments back into one fat Word.
//
// Tokenize emits every unescaped `.` and `~` as its own WORD (along
// with the special path tails `.()` and `.#?`). Path/range assembly is
// a parser concern, not a tokenizer concern, so we do the gathering
// here — right at the sibling-walk boundary — instead of in
// parseTree's reglueWords.
//
// A run of glued WORDs is coalesced into one fat Word whenever the new
// chunk starts with `.` / `~` OR the running text ends with `.` / `~`.
// The result is what decodeWord / decodeRangeWord / splitPath expect.
const coalesceDots = (items) => {
  const startsSep = (t) => t[0] === '.' || t[0] === '~';
  const endsSep = (t) => {
    const last = t[t.length - 1];
    return last === '.' || last === '~';
  };
  const out = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.kind !== 'Word') { out.push(it); i++; continue; }
    let cur = it;
    let j = i + 1;
    while (j < items.length) {
      const nx = items[j];
      if (nx.kind !== 'Word' || !nx.glued) break;
      // Don't merge across a path terminator: if `cur` already ends in
      // `?`/`!`/`'` (unescaped), what follows starts a NEW path/exec
      // (e.g. `p.birthday?.?` → [Word('p.birthday?'), Word('.?')]).
      const curLast = cur.text[cur.text.length - 1];
      const curEsc = cur.text.length >= 2 && cur.text[cur.text.length - 2] === '\\';
      if (!curEsc && (curLast === '?' || curLast === '!' || curLast === "'")) break;
      const canMerge = startsSep(nx.text) || endsSep(cur.text);
      if (!canMerge) break;
      cur = {
        ...cur,
        text: cur.text + nx.text,
        esc: cur.esc || nx.esc,
      };
      j++;
    }
    out.push(cur);
    i = j;
  }
  return out;
};

// Assemble dynamic-path sequences.
//
// After coalesceDots, a path like `xs.{n?}?` shows up as the items
// `[Word('xs.'), Tmpl({n?}), Word('?')]` (with Word/Word merging into
// `xs.` but stopping at the Tmpl). This pass collapses such a chain
// into a single Query/Exec/Partial node whose segments may include a
// new `dynamic` kind carrying the inner Tmpl as an expression to be
// evaluated at runtime.
//
// Two trigger shapes are recognised:
//   (a) Word-headed: a Word ending with `.` (and containing at least
//       one `.`) immediately followed by a glued Tmpl.
//         e.g. `xs.{n?}?` → [Word('xs.'), Tmpl, Word('?')]
//   (b) Prev-sibling-headed: a previously-emitted sibling followed by
//       a glued Word that starts AND ends with `.` (or is just `.`),
//       followed by a glued Tmpl.
//         e.g. `(1 2 3).{n?}?` → [Pattern, Word('.'), Tmpl, Word('?')]
//
// The chain is walked greedily, alternating Tmpl and dot-Word fragments,
// until a glued Word ending in `?`/`!`/`'` terminates it.
const assembleDynamicPaths = (items) => {
  const out = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    const nx = items[i + 1];

    // (a) Word-headed.
    if (it.kind === 'Word'
      && it.text.length >= 2 && it.text.endsWith('.')
      && it.text.includes('.')
      && nx && nx.glued && nx.kind === 'Tmpl') {
      const built = collectDynPath(items, i, /*headOverride=*/null);
      out.push(built.node);
      i = built.next;
      continue;
    }

    // (b) Prev-sibling-headed.
    const prev = out[out.length - 1];
    if (prev && it.kind === 'Word' && it.glued
      && it.text.startsWith('.') && it.text.endsWith('.')
      && nx && nx.glued && nx.kind === 'Tmpl') {
      out.pop();
      // The prev sibling was emitted by this pass before its inner
      // siblings were walked. As it becomes the head of a Query node,
      // it won't be revisited by walkSiblings — so walk it now.
      const headNode = (prev.kind === 'Word') ? prev : walkNode(prev);
      if (prev.glued) headNode.glued = true;
      const built = collectDynPath(items, i, /*headOverride=*/headNode);
      out.push(built.node);
      i = built.next;
      continue;
    }

    out.push(it);
    i++;
  }
  return out;
};

// Walk a glued path chain starting at items[i] and produce one
// Query/Exec/Partial node. `headOverride` is non-null when the chain
// is attached to a preceding sibling (case b above).
const collectDynPath = (items, i, headOverride) => {
  const startWithItem = headOverride === null;
  const lineRef = items[i].line;
  const colRef = items[i].col;

  // Interleaved string/Tmpl parts. Strings carry raw fragment text
  // including any leading/trailing `.` separators.
  const parts = [];
  parts.push(items[i].text);
  let j = i + 1;

  // After a string-fragment ending in `.`, the next item must be a
  // glued Tmpl. After a Tmpl, the next item must be a glued Word
  // (either ending in `.` to continue, or in `?`/`!`/`'` to terminate).
  while (j < items.length) {
    const t = items[j];
    if (!t.glued || t.kind !== 'Tmpl') {
      throw new PunkSyntaxError(
        "dynamic path step expected after '.'",
        items[j - 1].line, items[j - 1].col,
      );
    }
    parts.push(t);
    j++;
    const after = items[j];
    if (!after || !after.glued || after.kind !== 'Word') {
      throw new PunkSyntaxError(
        "dynamic path step must be followed by a literal segment or terminator (?, !, ')",
        t.line, t.col,
      );
    }
    parts.push(after.text);
    j++;
    const lc = after.text[after.text.length - 1];
    if (lc === '?' || lc === '!' || lc === "'") break;
    if (!after.text.startsWith('.') || !after.text.endsWith('.')) {
      throw new PunkSyntaxError(
        `bad mid-path fragment '${after.text}'`,
        after.line, after.col,
      );
    }
  }

  // Last string fragment must end in a path terminator.
  const lastStr = parts[parts.length - 1];
  if (typeof lastStr !== 'string') {
    throw new PunkSyntaxError(
      "incomplete dynamic path — missing terminator (?, !, ')",
      lineRef, colRef,
    );
  }
  const term = lastStr[lastStr.length - 1];
  if (term !== '?' && term !== '!' && term !== "'") {
    throw new PunkSyntaxError(
      "incomplete dynamic path — missing terminator (?, !, ')",
      lineRef, colRef,
    );
  }

  // Flatten parts into a list of raw segments ({str} or {tmpl}).
  const rawSegs = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const isFirst = k === 0;
    const isLast = k === parts.length - 1;
    if (typeof p !== 'string') {
      rawSegs.push({ tmpl: p });
      continue;
    }
    let body = p;
    if (isLast) body = body.slice(0, -1); // strip terminator
    if (startWithItem && isFirst) {
      // First fragment must look like "x." or "x.foo." — head + maybe
      // some literal segments, then a trailing '.' linking to the Tmpl.
      if (!body.endsWith('.')) {
        throw new PunkSyntaxError(
          `expected '.' before dynamic step in '${p}'`, lineRef, colRef,
        );
      }
      body = body.slice(0, -1);
      const segStrs = splitPath(body, lineRef, colRef);
      for (const s of segStrs) rawSegs.push({ str: s });
    } else {
      // Non-first OR prev-sibling-headed-first.
      //   - If this is also the last fragment, body may be "" (when
      //     the original word was just the terminator).
      //   - Otherwise body must start with '.' and (unless last) also
      //     end with '.' linking to the following Tmpl.
      if (body === '') continue; // pure terminator-only last fragment
      if (!body.startsWith('.')) {
        throw new PunkSyntaxError(
          `expected '.' at start of '${p}'`, lineRef, colRef,
        );
      }
      body = body.slice(1);
      if (!isLast) {
        // Middle fragment: must end with '.' (after leading-dot strip).
        // Body could now be "" (original was ".") — that's a pure link.
        if (body !== '') {
          if (!body.endsWith('.')) {
            throw new PunkSyntaxError(
              `expected '.' at end of '${p}'`, lineRef, colRef,
            );
          }
          body = body.slice(0, -1);
        }
      }
      if (body === '') continue;
      const segStrs = splitPath(body, lineRef, colRef);
      for (const s of segStrs) rawSegs.push({ str: s });
    }
  }

  // Build head and segment ASTs.
  let head;
  let segStart = 0;
  if (startWithItem) {
    if (rawSegs.length === 0 || !rawSegs[0].str) {
      throw new PunkSyntaxError('dynamic path missing head', lineRef, colRef);
    }
    const hs = rawSegs[0].str;
    if (isInt(hs)) {
      head = { kind: 'Word', text: hs, subkind: 'number', line: lineRef, col: colRef };
    } else if (isValidPathHead(hs)) {
      head = hs;
    } else {
      throw new PunkSyntaxError(`'${hs}' is not a valid path head`, lineRef, colRef);
    }
    segStart = 1;
  } else {
    head = headOverride;
  }

  const segs = [];
  const tail = rawSegs.slice(segStart);
  for (let k = 0; k < tail.length; k++) {
    const rs = tail[k];
    const isLast = k === tail.length - 1;
    if (rs.tmpl) {
      segs.push({ kind: 'dynamic', expr: walkNode(rs.tmpl) });
    } else {
      const s = rs.str;
      if (s === '#') {
        if (!isLast) throw new PunkSyntaxError("'#' must be the final path segment", lineRef, colRef);
        segs.push({ kind: 'length' });
      } else if (s === ':') {
        if (!isLast) throw new PunkSyntaxError("':' must be the final path segment", lineRef, colRef);
        segs.push({ kind: 'nameOf' });
      } else if (s === '()') {
        if (!isLast) throw new PunkSyntaxError("'()' must be the final path segment", lineRef, colRef);
        segs.push({ kind: 'pattern' });
      } else if (s.includes('~')) {
        const { from, to } = decodeRangeWord(s, lineRef, colRef);
        segs.push({ kind: 'range', from, to });
      } else if (isInt(s)) {
        segs.push({ kind: 'index', n: parseInt(s, 10) });
      } else if (isName(s)) {
        segs.push({ kind: 'name', text: s });
      } else {
        throw new PunkSyntaxError(`bad path segment '${s}'`, lineRef, colRef);
      }
    }
  }

  const make = term === '?' ? mkQuery : term === '!' ? mkExec : mkPartial;
  const node = make(head, segs, lineRef, colRef);
  // Propagate glue. For Word-headed, the chain sits where items[i] was;
  // for prev-sibling-headed, it sits where the head sibling was.
  if (startWithItem) {
    if (items[i].glued) node.glued = true;
  } else {
    if (headOverride.glued) node.glued = true;
  }
  return { node, next: j };
};

// Walk a sibling list, decoding each Word. Handles two sibling-aware
// rules:
//   (a) A raw Word starting with `.` attaches to the previous sibling
//       (which must be glued? No — the dot-word must itself be glued).
//   (b) A `Named` with value=null absorbs the next glued sibling.
const walkSiblings = (items) => {
  items = coalesceDots(items);
  items = assembleDynamicPaths(items);
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
      let body = text.slice(1, -1); // strip leading `.` and suffix
      let spread = false;
      if (last === '?') {
        if (body.length >= 1 && body[body.length - 1] === '.'
            && !(body.length >= 2 && body[body.length - 2] === '\\')) {
          spread = true;
          body = body.slice(0, -1);
        } else if (body === '') {
          // text was exactly `.?` — the leading dot IS the spread marker.
          spread = true;
        }
      }
      let decodedSegs;
      if (body === '') {
        if (!spread) {
          throw new PunkSyntaxError(`'${text}' has no segments`, line, col);
        }
        decodedSegs = [];
      } else {
        const segs = splitPath(body, line, col);
        decodedSegs = decodeSegments(segs, line, col);
      }
      const make =
        last === '?' ? mkQuery :
        last === '!' ? mkExec  : mkPartial;
      // The new node inherits prev's `glued` flag (it sits where prev sat).
      const node = make(prev, decodedSegs, prev.line, prev.col);
      if (spread) node.spread = true;
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

  // Stray match-op detection: a `?` or `??` must have a value sibling
  // immediately to its left. parseOperators also catches this, but the
  // parseWords-only path needs to fail too (e.g. a bare `?` program).
  for (let i = 0; i < attached.length; i++) {
    const n = attached[i];
    if (n && n.kind === 'Word' && n.subkind === 'match-op') {
      const prev = attached[i - 1];
      if (!prev || prev.kind === 'Word') {
        throw new PunkSyntaxError(
          `stray '${n.text}' — match operator needs a value on the left and a pattern/function on the right`,
          n.line, n.col,
        );
      }
    }
  }

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
      // primitive value, but be safe). Dynamic segments hold a
      // sub-expression that needs operator passes too.
      const out = { ...node };
      if (node.head && typeof node.head === 'object') {
        out.head = opsWalk(node.head);
      }
      if (node.segments && node.segments.some((s) => s.kind === 'dynamic')) {
        out.segments = node.segments.map((s) =>
          s.kind === 'dynamic' ? { ...s, expr: opsWalk(s.expr) } : s,
        );
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
  // After building a body-bearing Match, require the next sibling to be
  // a glued `!` Word; consume it. The `!` makes execution explicit and
  // unambiguous (a Match without bodies is a predicate and needs none).
  const requireBangAfter = (i, atNode) => {
    const t = xs[i];
    if (!t || t.kind !== 'Word' || t.subkind !== 'bang' || !t.glued) {
      throw new PunkSyntaxError(
        `body-bearing conditional must end with '!' (e.g. x?(p){body}! or x??{...}!)`,
        atNode.line, atNode.col,
      );
    }
  };

  for (let i = 0; i < xs.length; i++) {
    const cur = xs[i];
    const a = xs[i + 1];
    const b = xs[i + 2];

    // Case 1 & 2 — Query glued Pattern/Fn (bareword subject; the `?`
    // was consumed by the path word).
    if (cur.kind === 'Query' && a && a.glued
        && (a.kind === 'Pattern' || a.kind === 'Fn')) {
      const hasBody = a.kind === 'Fn';
      const branches = a.kind === 'Pattern'
        ? [{ pattern: stripGlued(a), body: null }]
        : [{ pattern: a.params, body: a.body }];
      const node = mkMatch(stripGlued(cur), branches, cur.line, cur.col);
      if (cur.glued) node.glued = true;
      let advance = 1;
      if (hasBody) {
        requireBangAfter(i + 2, node);
        advance = 2;
      }
      out.push(node);
      i += advance;
      continue;
    }

    // Case 3 — explicit match op `?` between subject and arm(s).
    if (matchValueSubject(cur) && a && a.glued && isMatchOp(a)
        && b && b.glued) {
      let branches = null;
      let hasBody = false;
      if (b.kind === 'Pattern') {
        branches = [{ pattern: stripGlued(b), body: null }];
      } else if (b.kind === 'Fn') {
        branches = [{ pattern: b.params, body: b.body }];
        hasBody = true;
      } else if (b.kind === 'Tmpl') {
        branches = tmplOfFnsBranches(b);
        if (branches === null) {
          throw new PunkSyntaxError(
            `match-dispatch arms must all be functions (pattern + body)`,
            b.line, b.col,
          );
        }
        hasBody = true;
      }
      if (branches !== null) {
        const node = mkMatch(stripGlued(cur), branches, cur.line, cur.col);
        if (cur.glued) node.glued = true;
        let advance = 2;
        if (hasBody) {
          requireBangAfter(i + 3, node);
          advance = 3;
        }
        out.push(node);
        i += advance;
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
//
// CHAINED ATTACH: a single Exec/Partial-with-no-args can absorb a run
// of consecutive glued siblings, drilling into its own args each time
// (the previous absorption becomes a nested Exec/Partial-no-args that
// the next absorption targets via innermostNeedingArgs). This is how
// short-form chains like `not!and!5` end up nested
// Exec(not, [Exec(and, [5])]) without any mid-bang scanning in
// decodeWord.
const passArgsAttach = (xs) => {
  const isSingleArg = (n) => n && (
    n.kind === 'Text' || n.kind === 'Box' || n.kind === 'Fn' ||
    n.kind === 'Pattern' || n.kind === 'Query' || n.kind === 'Exec' ||
    n.kind === 'Partial' || n.kind === 'Range' ||
    // A glued value/number/op Word is the mid-bang RHS in the
    // short-form chain `add!5` → tokens are now [add, !, 5]; reglue
    // gives [Word add!, Word 5]; this pass attaches the Word as args.
    (n.kind === 'Word' &&
      (n.subkind === 'value' || n.subkind === 'number'
       || n.subkind === 'op' || n.subkind === 'reserved'))
  );
  // Drill down: if cur is an Exec/Partial whose args is a singleton
  // Tmpl wrapping another Exec/Partial-with-no-args, recurse into the
  // inner one. This is how chained mid-bang words like `not!and!`
  // end up with the next glued sibling attached to the innermost call.
  const innermostNeedingArgs = (node) => {
    if (!(node.kind === 'Exec' || node.kind === 'Partial')) return null;
    if (!node.args) return node;
    if (node.args.kind === 'Tmpl' && node.args.items.length === 1) {
      const inner = innermostNeedingArgs(node.args.items[0]);
      if (inner) return inner;
    }
    return null;
  };
  // Return a clone of `root` with `args` swapped onto whichever inner
  // node `innermostNeedingArgs` selected. Walks the same singleton-Tmpl
  // chain.
  const setInnerArgs = (node, args) => {
    if (!(node.kind === 'Exec' || node.kind === 'Partial')) return node;
    if (!node.args) return { ...node, args };
    if (node.args.kind === 'Tmpl' && node.args.items.length === 1) {
      const newInner = setInnerArgs(node.args.items[0], args);
      if (newInner === node.args.items[0]) return node;
      return { ...node, args: { ...node.args, items: [newInner] } };
    }
    return node;
  };
  const out = [];
  let i = 0;
  while (i < xs.length) {
    let cur = xs[i];
    i++;
    // Greedily absorb glued args into the deepest Exec/Partial slot.
    while (i < xs.length) {
      const next = xs[i];
      if (!next.glued) break;
      // Special: a Query whose head is a glued Tmpl AND prev is an
      // Exec/Partial-needing-args — the Tmpl is the args, and the
      // Query's segments wrap the call (post-Exec query on result).
      // Example: `f!{a b}.1.?` parses initially as Exec(f) + glued
      // Query(head={a b}, segments=[.1,.?]). We want the Tmpl to
      // become f's args and the Query to wrap f.
      if (next.kind === 'Query'
          && next.head && next.head.kind === 'Tmpl' && next.head.glued
          && innermostNeedingArgs(cur)) {
        const argTmpl = stripGlued(next.head);
        const wasGlued = cur.glued;
        cur = setInnerArgs(cur, argTmpl);
        const wrapped = mkQuery(cur, next.segments, cur.line, cur.col);
        if (next.spread) wrapped.spread = true;
        if (wasGlued) wrapped.glued = true;
        cur = wrapped;
        i++;
        continue;
      }
      if (!isSingleArg(next) && next.kind !== 'Tmpl') break;
      const inner = innermostNeedingArgs(cur);
      if (!inner) break;
      // Don't eat a Pattern that will form a Fn with the next sibling.
      if (next.kind === 'Pattern' && i + 1 < xs.length && xs[i + 1].glued) break;
      const argTmpl = next.kind === 'Tmpl'
        ? stripGlued(next)
        : mkTmpl([stripGlued(next)], next.line, next.col);
      const wasGlued = cur.glued;
      cur = setInnerArgs(cur, argTmpl);
      if (wasGlued) cur.glued = true;
      i++;
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
      // Also defer if cur is glued to a preceding `->` — the bang is
      // the pipeline-trigger marker, not a postfix on `cur` itself.
      const prev = xs[i - 1];
      if (cur.glued && prev && prev.kind === 'Word' && prev.text === '->' && prev.glued) {
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
      // Detect trailing bare `!` glued after the last stage, OR a
      // glued Query whose head is the bang Word (parseWords attaches
      // a leading-dot path like `.?` to the preceding `!` Word). In
      // the latter case the bang triggers execute and the query
      // segments wrap the pipeline as a post-call query on the result.
      let execute = false;
      let wrapQuery = null;
      const tail = xs[j];
      const lastStage = stages[stages.length - 1];
      if (tail && tail.kind === 'Word' && tail.text === '!' && tail.glued) {
        execute = true;
        j++;
      } else if (tail && tail.kind === 'Query' && tail.glued
                 && tail.head && tail.head.kind === 'Word'
                 && tail.head.subkind === 'bang') {
        execute = true;
        wrapQuery = tail;
        j++;
      } else if (lastStage.kind === 'Exec') {
        // `...->log!` — the Exec at the tail acts as the executor.
        execute = true;
      }
      const pipe = mkPipeline(stages.map(stripGlued), execute, start.line, start.col);
      if (start.glued) pipe.glued = true;
      if (wrapQuery) {
        const wrapped = mkQuery(pipe, wrapQuery.segments, pipe.line, pipe.col);
        if (wrapQuery.spread) wrapped.spread = true;
        if (start.glued) wrapped.glued = true;
        out.push(wrapped);
      } else {
        out.push(pipe);
      }
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
      if (node.text === '->') {
        throw new PunkSyntaxError(
          "'->' must have no whitespace around it (e.g. `a->b`, not `a -> b`)",
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
      if (node.kind === 'Query' && node.head === '_') {
        // `_?` (and `_.x?` etc.) is only legal inside a `(_)` function
        // — the wildcard `_` of a single-slot pattern is the only place
        // `_` is bound as a name.
        let ok = false;
        for (let i = stack.length - 1; i >= 0; i--) {
          const anc = stack[i];
          if (anc && anc.kind === 'Fn') {
            const ps = anc.params;
            if (
              ps && ps.kind === 'Pattern'
              && ps.items.length === 1
              && ps.items[0].kind === 'Word'
              && ps.items[0].subkind === 'wildcard'
            ) {
              ok = true;
            }
            break;
          }
        }
        if (!ok) {
          throw new PunkSyntaxError(
            "`_?` is only valid inside a `(_)` single-slot function",
            node.line, node.col,
          );
        }
      }
      if (node.head && typeof node.head === 'object') {
        validateNode(node.head, [...stack, node]);
      }
      for (const seg of (node.segments || [])) {
        if (seg.kind === 'range') {
          // Path-segment range — bounds are seg.from / seg.to (ints or null).
          validateRangeBounds(seg, /*standalone*/ false, stack, node);
        } else if (seg.kind === 'dynamic') {
          validateNode(seg.expr, [...stack, node]);
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
      if (node.kind === 'Pattern') {
        let varCount = 0;
        for (let i = 0; i < node.items.length; i++) {
          const item = node.items[i];
          const v =
            (item.kind === 'Word' && item.subkind === 'variadic') ? item :
            (item.kind === 'Named' && item.value
              && item.value.kind === 'Word' && item.value.subkind === 'variadic') ? item :
            null;
          if (v) {
            varCount++;
            if (varCount > 1) {
              throw new PunkSyntaxError(
                'a pattern can have at most one variadic slot',
                v.line, v.col,
              );
            }
            if (i !== node.items.length - 1) {
              throw new PunkSyntaxError(
                'variadic `*` must be the last slot in a pattern',
                v.line, v.col,
              );
            }
          }
        }
      }
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

    case 'Match': {
      const childStack = [...stack, node];
      validateNode(node.subject, childStack);
      for (const br of (node.branches || [])) {
        if (br.pattern) validateNode(br.pattern, childStack);
        if (br.body) validateNode(br.body, childStack);
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
