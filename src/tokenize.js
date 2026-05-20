// Punk tokenizer.
//
// Pure function: `tokenize(src) -> Token[]`. Turns a Punk source
// string into a flat list of tokens. No semantic checks beyond the
// minimum needed to recognise structure (matched comments, matched
// "..."). Bracket pairing and name validation are the parser's job.
//
// A Token is `{ type, text, line, col }` where:
//   - `type` is one of the kinds in TOKEN_TYPES below.
//   - `text` is the source text with escapes preserved verbatim
//     (e.g. `\.` stays as the two chars `\.`). Higher layers decide
//     when an escape is "structural" (always: not) vs "literal".
//   - `line`/`col` point at the first character of the token (1-based).
//
// See docs/punk-by-example.md for the language spec.

import { PunkSyntaxError } from './errors.js';

export const TOKEN_TYPES = Object.freeze({
  LBRACE: 'LBRACE',         // {
  RBRACE: 'RBRACE',         // }
  LPAREN: 'LPAREN',         // (
  RPAREN: 'RPAREN',         // )
  LBRACK: 'LBRACK',         // [
  RBRACK: 'RBRACK',         // ]
  QUOTE_OPEN: 'QUOTE_OPEN', // opening "
  QUOTE_CLOSE: 'QUOTE_CLOSE', // closing "
  ARROW: 'ARROW',           // ->
  SPACE: 'SPACE',           // run of whitespace inside structural context
  WORD: 'WORD',             // a run of word characters (decoded)
  TEXT: 'TEXT',             // literal text inside "..."
  REGEX: 'REGEX',           // /.../flags  (regex literal)
  EOF: 'EOF',
});

const STRUCT_DELIMS = new Set(['{', '}', '(', ')', '[', ']', '"']);

function isNameChar(ch) {
  return (ch >= 'a' && ch <= 'z')
    || (ch >= 'A' && ch <= 'Z')
    || (ch >= '0' && ch <= '9')
    || ch === '_' || ch === '-' || ch === '$';
}

export function tokenize(src) {
  if (typeof src !== 'string') {
    throw new TypeError('tokenize: source must be a string');
  }

  const tokens = [];
  // mode stack: 'STRUCT' (default, inside {} () []) or 'TEXT' (inside "")
  const modes = ['STRUCT'];
  const mode = () => modes[modes.length - 1];

  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (n = 0) => src[i + n];
  const eof = () => i >= src.length;

  const advance = (n = 1) => {
    for (let k = 0; k < n && i < src.length; k++) {
      if (src[i] === '\n') { line++; col = 1; }
      else { col++; }
      i++;
    }
  };

  const push = (type, text, startLine, startCol) => {
    tokens.push({ type, text, line: startLine, col: startCol });
  };

  // Skip a `# ... #` comment. Caller has confirmed `src[i] === '#'`.
  // Comments are dumb spans — no escape processing inside; first raw
  // `#` after the opener closes. Unclosed -> syntax error.
  const skipComment = () => {
    const openLine = line, openCol = col;
    advance(); // opening #
    while (!eof() && peek() !== '#') {
      advance();
    }
    if (eof()) {
      throw new PunkSyntaxError('unclosed comment', openLine, openCol);
    }
    advance(); // closing #
  };

  // Read a single escape starting at `\`. Returns the literal two-char
  // sequence `\X`.
  //
  // Escapes are preserved verbatim in BOTH word storage and text
  // storage. Resolution to "actual" chars (dropping the leading `\`)
  // happens only at display time (format) and at the data boundaries
  // (split/join/valueToText). Storing verbatim is what makes the
  // round-trip `"..." → split → {...} → join → "..."` preserve the
  // user's original source exactly.
  const readEscape = (inText = false) => {
    const escLine = line, escCol = col;
    advance(); // backslash
    if (eof()) {
      throw new PunkSyntaxError('trailing backslash', escLine, escCol);
    }
    const c = peek();
    advance();
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      throw new PunkSyntaxError(
        'whitespace cannot be escaped — Punk has no whitespace escape',
        escLine, escCol,
      );
    }
    return '\\' + c;
  };

  while (!eof()) {
    const startLine = line, startCol = col;
    const c = peek();

    if (mode() === 'STRUCT') {
      // Comments first — they vanish entirely, no separator effect.
      // We only see `#` here at the start of a token; inside a word
      // it's handled in the WORD branch below.
      if (c === '#') {
        skipComment();
        continue;
      }

      // Whitespace -> SPACE token (collapsed run).
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        let text = '';
        while (!eof()) {
          const ch = peek();
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            text += ch; advance();
          } else if (ch === '#') {
            // A comment inside a whitespace run also vanishes; keep
            // collecting whitespace on either side as one SPACE token.
            skipComment();
          } else {
            break;
          }
        }
        push(TOKEN_TYPES.SPACE, text, startLine, startCol);
        continue;
      }

      // Single-char delimiters.
      if (c === '{') {
        advance();
        push(TOKEN_TYPES.LBRACE, '{', startLine, startCol);
        modes.push('STRUCT');
        continue;
      }
      if (c === '}') {
        advance();
        push(TOKEN_TYPES.RBRACE, '}', startLine, startCol);
        // Pop the STRUCT frame this `}` closes. We never pop the
        // implicit bottom-of-stack STRUCT (so a stray top-level `}`
        // still tokenizes — the parser will flag it).
        if (modes.length > 1) modes.pop();
        continue;
      }
      if (c === '(') { advance(); push(TOKEN_TYPES.LPAREN, '(', startLine, startCol); continue; }
      if (c === ')') { advance(); push(TOKEN_TYPES.RPAREN, ')', startLine, startCol); continue; }
      if (c === '[') { advance(); push(TOKEN_TYPES.LBRACK, '[', startLine, startCol); continue; }
      if (c === ']') { advance(); push(TOKEN_TYPES.RBRACK, ']', startLine, startCol); continue; }

      // Opening quote -> switch to TEXT mode.
      if (c === '"') {
        advance();
        push(TOKEN_TYPES.QUOTE_OPEN, '"', startLine, startCol);
        modes.push('TEXT');
        continue;
      }

      // `->` is a token in its own right (no whitespace allowed around it
      // per spec; that's enforced by the parser, not the tokenizer).
      if (c === '-' && peek(1) === '>') {
        advance(2);
        push(TOKEN_TYPES.ARROW, '->', startLine, startCol);
        continue;
      }

      // `!`, `?`, `'` are path-trigger / partial-trigger markers. They
      // always emit as their own single-char WORD tokens. Whether such
      // a marker attaches to a preceding/following sibling (as a path
      // suffix, mid-bang short-form, or standalone match-op) is the
      // parser's job — it uses the SPACE-gap info to decide.
      if (c === '!' || c === '?' || c === "'") {
        advance();
        push(TOKEN_TYPES.WORD, c, startLine, startCol);
        continue;
      }

      // `.` is the path-segment separator. Always emit it as its own
      // WORD token (re-glued back onto its neighbours by parseTree's
      // reglueWords pass). The two glued-tail forms `.()` (return the
      // pattern of a fn) and `.#?` (length-of) are emitted as a single
      // 3-char WORD here so the inner `(` / `#` don't confuse the
      // outer loop's bracket / comment handling.
      if (c === '.') {
        if (peek(1) === '(' && peek(2) === ')') {
          advance(3);
          push(TOKEN_TYPES.WORD, '.()', startLine, startCol);
          continue;
        }
        if (peek(1) === '#' && peek(2) === '?') {
          advance(3);
          push(TOKEN_TYPES.WORD, '.#?', startLine, startCol);
          continue;
        }
        advance();
        push(TOKEN_TYPES.WORD, '.', startLine, startCol);
        continue;
      }

      // `~` is the range / return-range marker. Always emit it as its
      // own single-char WORD token (parser-side coalesceDots re-glues
      // it back into fat range words like `1~5`, `~3`, or `5~`).
      if (c === '~') {
        advance();
        push(TOKEN_TYPES.WORD, '~', startLine, startCol);
        continue;
      }

      // `/.../[flags]` — first-class regex literal. Triggered when `/`
      // is followed by a non-whitespace, non-structural char other than
      // `!`. (`/!{a b}` is the division builtin call — the `/` stays a
      // plain WORD there.) Inside the body, `\X` pairs are passed
      // through verbatim so the JS regex engine sees them as-is; that's
      // also how we find the closing `/` (a backslash skips the next
      // char). After the closing `/`, optional ASCII-letter flags.
      if (c === '/') {
        const n = peek(1);
        const isRegexStart = n !== '' && n !== '!' && n !== ' ' && n !== '\t'
          && n !== '\n' && n !== '\r' && !STRUCT_DELIMS.has(n);
        if (isRegexStart) {
          advance(); // opening /
          let body = '';
          let closed = false;
          while (!eof()) {
            const ch = peek();
            if (ch === '\\') {
              body += ch;
              advance();
              if (eof()) {
                throw new PunkSyntaxError(
                  'unterminated regex literal', startLine, startCol,
                );
              }
              body += peek();
              advance();
              continue;
            }
            if (ch === '/') { advance(); closed = true; break; }
            if (ch === '\n') {
              throw new PunkSyntaxError(
                'unterminated regex literal (newline inside)',
                startLine, startCol,
              );
            }
            body += ch;
            advance();
          }
          if (!closed) {
            throw new PunkSyntaxError(
              'unterminated regex literal', startLine, startCol,
            );
          }
          let flags = '';
          while (!eof()) {
            const ch = peek();
            if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
              flags += ch; advance();
            } else break;
          }
          push(TOKEN_TYPES.REGEX, '/' + body + '/' + flags, startLine, startCol);
          tokens[tokens.length - 1].body = body;
          tokens[tokens.length - 1].flags = flags;
          continue;
        }
      }

      // Otherwise — build a WORD by accumulating non-special chars.
      let text = '';
      let esc = false;
      while (!eof()) {
        const ch = peek();
        if (ch === '\\') { text += readEscape(); esc = true; continue; }
        if (ch === '#') {
          skipComment();
          continue;
        }
        if (STRUCT_DELIMS.has(ch)) break;
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
        if (ch === '-' && peek(1) === '>') break;
        // Path-trigger / partial-trigger markers terminate the word;
        // they're emitted by the outer loop as their own WORD tokens.
        if (ch === '!' || ch === '?' || ch === "'") break;
        // `.` and `~` terminate the word; the outer loop emits them
        // (and any `.()` / `.#?` tail) as their own WORD tokens.
        if (ch === '.' || ch === '~') break;
        text += ch;
        advance();
        // `:` immediately following a name char ends the word AFTER
        // consuming the `:` itself. This keeps `name:` as a single
        // token (so binding precedence works correctly with `->`),
        // while leaving `.:?` (where `:` follows a `.`) intact.
        if (ch === ':' && text.length >= 2) {
          const prev = text[text.length - 2];
          if (isNameChar(prev)) break;
        }
      }
      // It's possible to reach here with an empty word (e.g. a comment
      // that consumed nothing visible after a non-word boundary). Only
      // emit a WORD when we actually have text.
      if (text.length > 0) {
        const tok = { type: TOKEN_TYPES.WORD, text, line: startLine, col: startCol };
        if (esc) tok.esc = true;
        tokens.push(tok);
      }
      continue;
    }

    // mode === 'TEXT'
    // We're inside "...". Collect literal chars until we hit `{`
    // (placeholder open) or `"` (close). Escapes are decoded; comments
    // still vanish.
    let text = '';
    while (!eof()) {
      const ch = peek();
      if (ch === '\\') { text += readEscape(true); continue; }
      if (ch === '"' || ch === '{') break;
      text += ch;
      advance();
    }
    if (text.length > 0) {
      push(TOKEN_TYPES.TEXT, text, startLine, startCol);
    }

    if (eof()) {
      throw new PunkSyntaxError('unclosed text template', startLine, startCol);
    }

    const closeLine = line, closeCol = col;
    if (peek() === '"') {
      advance();
      push(TOKEN_TYPES.QUOTE_CLOSE, '"', closeLine, closeCol);
      modes.pop();
    } else { // '{'
      advance();
      push(TOKEN_TYPES.LBRACE, '{', closeLine, closeCol);
      modes.push('STRUCT');
    }
  }

  push(TOKEN_TYPES.EOF, '', line, col);
  return tokens;
}
