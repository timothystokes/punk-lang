// Structural parser: tokens -> AST.
//
// A Punk program is a sequence of items (same shape as a template body).
// `parse(tokens)` returns an array of nodes.
//
// AST node shapes (all carry {line, col}):
//   {type: 'Word',     text, esc}            atomic identifier/number/sigil-bearing thing
//   {type: 'Regex',    pattern}              `"..."` literal
//   {type: 'Template', items: Node[]}        `{ ... }`
//   {type: 'Pattern',  items: Node[]}        `( ... )` not attached to a template
//   {type: 'Function', pattern, body}        `( ... ){ ... }` with NO whitespace between `)` and `{`
//   {type: 'Box',      items: Node[]}        `[ ... ]`  (semantic check — usually a single Word — happens later)
//   {type: 'Conditional', subject, branches: [{pattern, body}], multi: bool}
//                                              `value?(p)`, `value?(p){t}`, `value??{(p){t}...}`
//                                              `body` is null for predicate-only `?(p)` form.
//
// The parser is intentionally dumb about word internals. Sigils (`?`, `!`, `'`,
// path dots, name-binds, `->` pipelines, `~`, `#`, etc.) all live inside the
// Word's `text` (with `esc` mask). The evaluator / pattern matcher will
// interpret them.

const OPEN  = { OPEN_T: 'CLOSE_T', OPEN_P: 'CLOSE_P', OPEN_B: 'CLOSE_B' };
const CLOSE = new Set(['CLOSE_T', 'CLOSE_P', 'CLOSE_B']);

export function parse(tokens) {
  const state = { tokens, i: 0 };
  const items = parseItems(state, null);
  if (state.i < tokens.length) {
    const t = tokens[state.i];
    throw new Error(`Unexpected ${t.type} at ${t.line}:${t.col}`);
  }
  return items;
}

function parseItems(state, stopType) {
  const items = [];
  while (state.i < state.tokens.length) {
    const t = state.tokens[state.i];
    if (t.type === stopType) break;
    if (CLOSE.has(t.type)) {
      throw new Error(`Unexpected ${t.type} at ${t.line}:${t.col}`);
    }
    items.push(parseItem(state));
  }
  return items;
}

function parseItem(state) {
  const t = state.tokens[state.i];
  switch (t.type) {
    case 'WORD': {
      state.i++;
      const word = { type: 'Word', text: t.text, esc: t.esc, line: t.line, col: t.col };
      const cond = maybeConditional(state, word);
      return cond || word;
    }
    case 'REGEX':
      state.i++;
      return { type: 'Regex', pattern: t.pattern, line: t.line, col: t.col };
    case 'OPEN_T':
      return parseTemplate(state);
    case 'OPEN_P':
      return parsePatternOrFunction(state);
    case 'OPEN_B':
      return parseBox(state);
    default:
      throw new Error(`Unexpected ${t.type} at ${t.line}:${t.col}`);
  }
}

function parseGroup(state, openType) {
  const open = state.tokens[state.i++];
  const closeType = OPEN[openType];
  const items = parseItems(state, closeType);
  if (state.i >= state.tokens.length) {
    throw new Error(`Unclosed ${openType} at ${open.line}:${open.col}`);
  }
  state.i++; // consume close
  return { open, items };
}

function parseTemplate(state) {
  const { open, items } = parseGroup(state, 'OPEN_T');
  return { type: 'Template', items, line: open.line, col: open.col };
}

function parsePatternOrFunction(state) {
  const { open, items } = parseGroup(state, 'OPEN_P');
  const pattern = { type: 'Pattern', items, line: open.line, col: open.col };

  // Attached `(...){...}` → Function. The attachment flag is set by the
  // tokenizer iff no whitespace/comment sits between `)` and `{`.
  const next = state.tokens[state.i];
  if (next && next.type === 'OPEN_T' && next.attached) {
    const body = parseTemplate(state);
    return {
      type: 'Function',
      pattern,
      body,
      line: open.line,
      col: open.col,
    };
  }
  return pattern;
}

// Conditional query attachment.
//   Word ending in one un-escaped `?`  attached to `(...)` → single conditional
//     `(...)` alone        → predicate (returns TRUE/FALSE)
//     `(...){...}`         → if-then (returns body or NULL)
//   Word ending in two un-escaped `?` attached to `{...}` → multi-branch
//     body items must all be `(p){t}` Functions
// Subject query is the Word text minus the trailing `?`/`??` and an optional
// trailing bare `.` — rebuilt as a synthetic query Word ending in `?` so the
// evaluator uses its normal path-query machinery.
function maybeConditional(state, word) {
  const next = state.tokens[state.i];
  if (!next || !next.attached) return null;
  const trailQ = countTrailingBareQ(word);

  if (trailQ === 1 && next.type === 'OPEN_P') {
    const patOrFn = parsePatternOrFunction(state);
    const subject = makeConditionalSubject(word, 1);
    if (!subject) throw new Error(`empty subject before ? at ${word.line}:${word.col}`);
    const branch = patOrFn.type === 'Function'
      ? { pattern: patOrFn.pattern, body: patOrFn.body }
      : { pattern: patOrFn, body: null };
    return {
      type: 'Conditional', multi: false, subject, branches: [branch],
      line: word.line, col: word.col,
    };
  }

  if (trailQ === 2 && next.type === 'OPEN_T') {
    const tmplNode = parseTemplate(state);
    const branches = [];
    for (const it of tmplNode.items) {
      if (it.type !== 'Function') {
        throw new Error(`?? branch must be (pattern){template}, got ${it.type} at ${it.line}:${it.col}`);
      }
      branches.push({ pattern: it.pattern, body: it.body });
    }
    if (branches.length === 0) {
      throw new Error(`?? needs at least one branch at ${word.line}:${word.col}`);
    }
    const subject = makeConditionalSubject(word, 2);
    if (!subject) throw new Error(`empty subject before ?? at ${word.line}:${word.col}`);
    return {
      type: 'Conditional', multi: true, subject, branches,
      line: word.line, col: word.col,
    };
  }

  return null;
}

function countTrailingBareQ(word) {
  let n = 0;
  const { text, esc } = word;
  for (let k = text.length - 1; k >= 0 && text[k] === '?' && !esc[k]; k--) n++;
  return n;
}

function makeConditionalSubject(word, qs) {
  let n = word.text.length - qs;
  if (n > 0 && word.text[n - 1] === '.' && !word.esc[n - 1]) n--;
  if (n <= 0) return null;
  return {
    type: 'Word',
    text: word.text.slice(0, n) + '?',
    esc: [...word.esc.slice(0, n), false],
    line: word.line,
    col: word.col,
  };
}

function parseBox(state) {
  const { open, items } = parseGroup(state, 'OPEN_B');
  return { type: 'Box', items, line: open.line, col: open.col };
}
