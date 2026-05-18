// Pure-functional tokenizer for Punk.
//
//   tokenize(source: string) -> Token[]
//
// Token shapes (all carry {line, col, attached}):
//   {type: 'OPEN_T'|'CLOSE_T'}                              for `{` `}`
//   {type: 'OPEN_P'|'CLOSE_P'}                              for `(` `)`
//   {type: 'OPEN_B'|'CLOSE_B'}                              for `[` `]`
//   {type: 'WORD',  text: string, esc: boolean[]}           bareword/path/number
//   {type: 'REGEX', pattern: string}                        `"..."`
//
// `text` has all `\X` escapes collapsed to their literal char; `esc[i]` is
// true when `text[i]` came from an escape (so the parser can tell `foo?`
// the query from `foo\?` the literal text).
//
// `attached` is true iff the previous token ended at this token's exact
// start position (no whitespace and no comment between them). Punk leans
// heavily on attachment: `name:value`, `pattern){template}`, `name??{...}`
// etc. are all defined as "no space allowed between these tokens".
//
// Comments are `# ... #` where the opening `#` has whitespace (or start of
// input) immediately before it, and the closing `#` is followed by
// whitespace (or end of input). Anywhere else a `#` is ordinary text.

const DELIMS = {
  '{': 'OPEN_T', '}': 'CLOSE_T',
  '(': 'OPEN_P', ')': 'CLOSE_P',
  '[': 'OPEN_B', ']': 'CLOSE_B',
};

const isWS = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isDelim = (c) => Object.prototype.hasOwnProperty.call(DELIMS, c);

export function tokenize(source) {
  const tokens = [];
  const len = source.length;
  let i = 0;
  let line = 1;
  let col = 1;
  let endOfLast = -1;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (source[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
  };

  const skipTrivia = () => {
    while (i < len) {
      const c = source[i];
      if (isWS(c)) { advance(); continue; }
      if (c === '#') {
        const prev = i > 0 ? source[i - 1] : null;
        const prevIsBoundary = (i === 0) || isWS(prev) || isDelim(prev);
        if (prevIsBoundary) {
          advance(); // opening #
          while (i < len) {
            if (source[i] === '#') {
              const nx = (i + 1 < len) ? source[i + 1] : null;
              const nextIsBoundary = (i + 1 >= len) || isWS(nx) || isDelim(nx);
              if (nextIsBoundary) { advance(); break; }
            }
            advance();
          }
          continue;
        }
      }
      break;
    }
  };

  while (i < len) {
    skipTrivia();
    if (i >= len) break;

    const startLine = line;
    const startCol = col;
    const startIdx = i;
    const attached = (startIdx === endOfLast);
    const c = source[i];

    if (isDelim(c)) {
      tokens.push({ type: DELIMS[c], line: startLine, col: startCol, attached });
      advance();
      endOfLast = i;
      continue;
    }

    if (c === '"') {
      advance(); // opening "
      let pattern = '';
      while (i < len && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < len) {
          pattern += source[i] + source[i + 1];
          advance(2);
        } else {
          pattern += source[i];
          advance();
        }
      }
      if (i >= len) {
        throw new Error(`Unterminated regex literal at ${startLine}:${startCol}`);
      }
      advance(); // closing "
      tokens.push({ type: 'REGEX', pattern, line: startLine, col: startCol, attached });
      endOfLast = i;
      continue;
    }

    // WORD: greedy run of non-whitespace, non-delim, non-quote characters.
    // `\X` inside a word collapses to literal X with esc[idx]=true.
    const chars = [];
    const esc = [];
    while (i < len) {
      const ch = source[i];
      if (isWS(ch) || isDelim(ch) || ch === '"') break;
      if (ch === '\\' && i + 1 < len) {
        const nx = source[i + 1];
        const mapped = nx === 'n' ? '\n' : nx === 't' ? '\t' : nx;
        chars.push(mapped);
        esc.push(true);
        advance(2);
        continue;
      }
      chars.push(ch);
      esc.push(false);
      advance();
    }
    if (chars.length === 0) {
      throw new Error(`Unexpected character '${c}' at ${startLine}:${startCol}`);
    }
    tokens.push({
      type: 'WORD',
      text: chars.join(''),
      esc,
      line: startLine,
      col: startCol,
      attached,
    });
    endOfLast = i;
  }

  return tokens;
}
