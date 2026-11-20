// Punk parser: tokens -> AST (see values.js for node kinds).
// Only syntax errors are errors (ERR-1, ERR-2).

import { syntaxError } from './errors.js';
import { tokenize } from './tokenize.js';
import { NONE, mkWord, mkWordParts, mkGroup, mkNamed } from './values.js';

export function parse(source) {
  return parseTokens(tokenize(source));
}

// Parses the inside of a `{...}` embed or a query chunk: `a.b.2` / `.name` / `.`
export function parsePath(text, line, col) {
  const local = text.startsWith('.');
  const body = local ? text.slice(1) : text;
  const segs = body === '' ? [] : body.split('.');
  if (segs.some((s) => s === '')) throw syntaxError(`invalid query path '${text}'`, line, col);
  if (!local && segs.length === 0) throw syntaxError('empty query', line, col);
  return { kind: 'Query', local, segs };
}

function parseTokens(t) {
  let p = 0;
  let opener;

  function peek(o = 0) { return t[p + o]; }
  function next() { return t[p++]; }
  function err(msg, tok = peek()) { throw syntaxError(msg, tok.line, tok.col); }

  function skipWs(allowNl = true) {
    while (peek().type === 'WS' && (allowNl || !peek().nl)) p++;
  }

  function program() {
    const stmts = [];
    while (true) {
      skipWs();
      if (peek().type === 'EOF') break;
      stmts.push(statement());
    }
    return { kind: 'Program', stmts };
  }

  function statement() {
    const subject = sequence('line');
    const entries = caseEntries();
    return entries.length ? { kind: 'Cases', subject, entries } : subject;
  }

  function caseEntries() {
    const entries = [];
    while (true) {
      const save = p;
      skipWs();
      const t = peek();
      if (t.type !== 'ARROW') { p = save; break; }
      next();
      skipWs(false);
      const node = sequence('line');
      const stages = node.kind === 'Pipe' && node.seed ? [node.seed, ...node.stages] : [node];
      entries.push({ depth: t.depth, stages });
    }
    return entries;
  }

  // mode: 'line' (ends at newline/EOF), 'RB' or 'RP'.
  function sequence(mode) {
    const elems = [];
    let lineStart = 0; // a pipe's seed is the elements on its own line
    while (true) {
      const t = peek();
      if (t.type === 'EOF') {
        if (mode !== 'line') err(`unclosed '${mode === 'RB' ? '[' : '('}'`, opener || t);
        break;
      }
      if (t.type === 'WS') {
        if (mode === 'line' && t.nl) break;
        if (t.nl) lineStart = elems.length;
        p++;
        continue;
      }
      if (t.type === mode) break;
      if (t.type === 'RB' || t.type === 'RP') err(`unexpected '${t.type === 'RB' ? ']' : ')'}'`);
      if (t.type === 'ARROW') {
        // cases inside a bracketed body: the elements so far are the subject (LEX-10)
        if (mode !== 'RB' || elems.length === 0) err("'->' must start a new line");
        const entries = caseEntries();
        skipWs();
        if (peek().type !== mode) err("unexpected token after cases");
        const subject = elems.length === 1 ? elems[0] : mkGroup(elems);
        return { kind: 'Cases', subject, entries };
      }
      if (t.type === 'GT') {
        next();
        const lineElems = elems.splice(lineStart);
        const seed = lineElems.length === 0 ? null : lineElems.length === 1 ? lineElems[0] : mkGroup(lineElems);
        const stages = [];
        while (true) {
          skipWs(false);
          if (peek().type === 'EOF' || peek().type === 'WS') err("expected a pipe stage after '>'");
          stages.push(element());
          skipWs(false);
          if (peek().type === 'GT') { next(); continue; }
          break;
        }
        // `name:value > f!` names the result of the whole pipe
        if (seed && seed.kind === 'Named' && lineElems.length === 1) {
          elems.push(mkNamed(seed.name, { kind: 'Pipe', seed: seed.value, stages, line: t.line }));
        } else {
          elems.push({ kind: 'Pipe', seed, stages, line: t.line });
        }
        continue;
      }
      elems.push(element());
    }
    return elems.length === 1 ? elems[0] : mkGroup(elems);
  }

  function group() {
    const open = next(); // LB
    const saved = opener; opener = open;
    const inner = sequence('RB');
    opener = saved;
    next(); // RB
    // keep a bracketed single element as a template so `[x]!` can evaluate it
    if (inner.kind === 'Group' || inner === NONE) return inner;
    return { kind: 'Group', items: [inner] };
  }

  // Elements of a group literal, kept as a list (used for pattern values).
  function element(noBang = false) {
    const tok = next();
    let node;
    switch (tok.type) {
      case 'NAME': {
        skipWs(false);
        if (peek().type === 'GT') {
          next();
          const stages = [];
          while (true) {
            skipWs(false);
            stages.push(element());
            skipWs(false);
            if (peek().type === 'GT') { next(); continue; }
            break;
          }
          return named(tok, { kind: 'Pipe', seed: null, stages });
        }
        const t = peek();
        if (t.type === 'EOF' || t.type === 'WS' || t.type === 'RB' || t.type === 'RP') {
          err(`'${tok.text}:' needs a value`, tok);
        }
        return named(tok, element());
      }
      case 'LB': p--; node = group(); break;
      case 'LP': node = pattern(tok); break;
      case 'CHUNK': node = word(tok); break;
      case 'BANG': err("unexpected '!'", tok); break;
      case 'QMARK': err("unexpected '?'", tok); break;
      default: err(`unexpected ${tok.type}`, tok);
    }
    return chain(node, noBang);
  }

  function named(tok, value) {
    const n = mkNamed(tok.text, value);
    if (tok.nameParts) n.nameParts = embedParts(tok.nameParts);
    return n;
  }

  function word(tok) {
    if (tok.parts.length === 1 && tok.parts[0].lit !== undefined) {
      return mkWord(tok.parts[0].lit);
    }
    return mkWordParts(embedParts(tok.parts));
  }

  function embedParts(tokParts) {
    return tokParts.map((p) => {
      if (p.lit !== undefined) return p;
      if (/^[^\s?!]+!$/.test(p.embedText)) {
        return { embed: { kind: 'Call', target: mkWord(p.embedText.slice(0, -1)), args: null } };
      }
      if (!p.embedText.endsWith('?')) {
        throw syntaxError("an embed must be a query ending in '?' or a call ending in '!'", p.line, p.col);
      }
      return { embed: parsePath(p.embedText.slice(0, -1), p.line, p.col) };
    });
  }

  function chain(node, noBang) {
    while (true) {
      const t = peek();
      if (!t.adj) break;
      if (t.type === 'QMARK') {
        if (node.kind !== 'Word' || node.parts || node.queried) break;
        next();
        const q = parsePath(node.text, t.line, t.col);
        node = q;
        continue;
      }
      if (t.type === 'LP' && node.kind !== 'Pattern' && node.kind !== 'FnLit' && !noBang) {
        const save = p;
        next();
        const pat = pattern(t);
        if (peek().type === 'BANG' && peek().adj) {
          next();
          node = { kind: 'Match', thing: node, pattern: pat };
          continue;
        }
        p = save;
        break;
      }
      if (t.type === 'LB') {
        if (node.kind === 'Pattern') {
          node = { kind: 'FnLit', pattern: node, body: group() };
          continue;
        }
        if ((node.kind === 'Word' || node.kind === 'Query') && !noBang) {
          const save = p;
          const g = group();
          if (peek().type === 'BANG' && peek().adj) {
            next();
            node = { kind: 'Call', target: node, args: g };
            continue;
          }
          p = save;
        }
        break;
      }
      if (t.type === 'BANG' && !noBang) {
        next();
        node = { kind: 'Call', target: node, args: null };
        const a = peek();
        if (a.adj && (a.type === 'CHUNK' || a.type === 'LB' || a.type === 'LP')) {
          node.args = element(true);
        }
        break;
      }
      break;
    }
    return node;
  }

  function pattern(open) {
    const left = [];
    const right = [];
    let side = 'left';
    while (true) {
      const t = peek();
      if (t.type === 'EOF') err("unclosed '('", open);
      if (t.type === 'RP') { next(); break; }
      if (t.type === 'WS') { p++; continue; }
      if (t.type === 'CHUNK' && t.parts.length === 1 && t.parts[0].lit === '|') {
        if (side === 'right') err("a pattern can contain only one '|'", t);
        side = 'right';
        next();
        continue;
      }
      let label = null;
      let nameTok = null;
      if (t.type === 'NAME') { next(); label = t.text; nameTok = t; }
      const v = next();
      let slot;
      if (v.type === 'CHUNK' && v.parts.length === 1 && v.parts[0].lit === '_') slot = { type: 'one' };
      else if (v.type === 'CHUNK' && v.parts.length === 1 && v.parts[0].lit === '#') slot = { type: 'rest' };
      else if (v.type === 'CHUNK') slot = { type: 'lit', thing: word(v) };
      else if (v.type === 'LB') { p--; slot = { type: 'lit', thing: group() }; }
      else err('unexpected token in pattern', v);
      if (side === 'left') {
        left.push({ ...slot, label });
      } else {
        if (!nameTok) err("clauses after '|' must be name:value", t);
        if (slot.type === 'rest') err("'#' is not allowed after '|'", v);
        right.push({ name: label, spec: slot });
      }
    }
    const rests = left.filter((s) => s.type === 'rest').length;
    if (rests > 1 || (rests === 1 && left[left.length - 1].type !== 'rest')) {
      throw syntaxError("'#' must be the last slot and appear at most once in a pattern", open.line, open.col);
    }
    return { kind: 'Pattern', left, right };
  }

  return program();
}
