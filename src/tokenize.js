// Punk tokenizer: source text -> flat token list.
//
// Tokens: WS(nl) LB RB LP RP BANG QMARK GT ARROW(depth) NAME CHUNK EOF.
// Each token has `adj` = true when it directly follows the previous token
// with no whitespace; the parser uses adjacency to build `f!x`, `x?`,
// `thing(pattern)!` and `(pattern)[template]` (LEX-1).
//
// A CHUNK is a run of word characters with `{query?}` embeds kept as
// parts (EMB). `name:` is split into a NAME token (NAME-1).

import { syntaxError } from './errors.js';
import { escChar } from './values.js';

const DELIMS = new Set(['[', ']', '(', ')', '!', '?', '>']);
const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

export function tokenize(src) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  let prevEnd = -1;

  const advance = (n = 1) => {
    for (let k = 0; k < n && i < src.length; k++) {
      if (src[i] === '\n') { line++; col = 1; } else col++;
      i++;
    }
  };

  const push = (tok, start, sl, sc) => {
    tok.adj = start === prevEnd;
    tok.line = sl;
    tok.col = sc;
    tokens.push(tok);
    prevEnd = i;
  };

  while (i < src.length) {
    const start = i, sl = line, sc = col;
    const c = src[i];

    if (isWs(c)) {
      let nl = false;
      while (i < src.length && isWs(src[i])) { if (src[i] === '\n') nl = true; advance(); }
      push({ type: 'WS', nl }, start, sl, sc);
      prevEnd = -1;
      continue;
    }

    if (c === '[') { advance(); push({ type: 'LB' }, start, sl, sc); continue; }
    if (c === ']') { advance(); push({ type: 'RB' }, start, sl, sc); continue; }
    if (c === '(') { advance(); push({ type: 'LP' }, start, sl, sc); continue; }
    if (c === ')') { advance(); push({ type: 'RP' }, start, sl, sc); continue; }
    if (c === '!') { advance(); push({ type: 'BANG' }, start, sl, sc); continue; }
    if (c === '?') { advance(); push({ type: 'QMARK' }, start, sl, sc); continue; }

    const arrow = /^-+>/.exec(src.slice(i, i + 16));
    if (arrow) {
      advance(arrow[0].length);
      push({ type: 'ARROW', depth: arrow[0].length - 1 }, start, sl, sc);
      continue;
    }
    if (c === '>') { advance(); push({ type: 'GT' }, start, sl, sc); continue; }

    // Comment: `##` to the end of the line (LEX-9).
    if (c === '#' && src[i + 1] === '#') {
      while (i < src.length && src[i] !== '\n') advance();
      continue;
    }

    if (c === '}') throw syntaxError("A '}' must close a matching '{'", sl, sc);

    // CHUNK: literal text and {embed} parts.
    const parts = [];
    let lit = '';
    while (i < src.length) {
      const ch = src[i];
      if (isWs(ch) || DELIMS.has(ch)) break;
      if (ch === '\\' && i + 1 < src.length && !isWs(src[i + 1])) {
        // Escape: the next character is plain text (LEX-8).
        const e = src[i + 1];
        advance(2);
        lit += e === 'n' ? escChar('\n') : e === 't' ? escChar('\t') : escChar(e);
        continue;
      }
      if (ch === '}') throw syntaxError("A '}' must close a matching '{'", line, col);
      if (ch === '{') {
        const el = line, ec = col;
        advance();
        let inner = '';
        while (i < src.length && src[i] !== '}') {
          if (src[i] === '{') throw syntaxError('An embed cannot contain another embed', line, col);
          inner += src[i];
          advance();
        }
        if (i >= src.length) throw syntaxError("A '{' must be closed with '}'", el, ec);
        advance();
        if (lit) { parts.push({ lit }); lit = ''; }
        parts.push({ embedText: inner.trim(), line: el, col: ec });
        continue;
      }
      lit += ch;
      advance();
    }
    if (lit) parts.push({ lit });

    // Split `name:rest` into NAME + CHUNK (repeatedly).
    let cur = parts;
    let adj = start === prevEnd;
    // A name may contain embeds: `{k?}:{v?}` names its value with the text of `k` (NAME-8).
    while (cur.length) {
      const idx = cur.findIndex((p) => p.lit !== undefined && p.lit.indexOf(':') >= 0);
      if (idx < 0) break;
      const k = cur[idx].lit.indexOf(':');
      if (idx === 0 && k === 0) break;
      const pre = cur[idx].lit.slice(0, k);
      const nameParts = cur.slice(0, idx).concat(pre ? [{ lit: pre }] : []);
      if (idx === 0) tokens.push({ type: 'NAME', text: pre, adj, line: sl, col: sc });
      else tokens.push({ type: 'NAME', text: '', nameParts, adj, line: sl, col: sc });
      const rest = cur[idx].lit.slice(k + 1);
      cur = (rest ? [{ lit: rest }] : []).concat(cur.slice(idx + 1));
      adj = true;
    }
    if (cur.length) tokens.push({ type: 'CHUNK', parts: cur, adj, line: sl, col: sc });
    prevEnd = i;
  }

  tokens.push({ type: 'EOF', adj: false, line, col });
  return tokens;
}
