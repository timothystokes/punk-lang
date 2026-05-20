// White-box tests for parseTree.
//
// parseTree only builds bracket structure: Tmpl / Text / Pattern /
// Box / raw Word. Internal word decoding (paths, name:value, etc.)
// is the next pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tokenize } from '../src/tokenize.js';
import { parseTree } from '../src/parse.js';
import { PunkSyntaxError } from '../src/errors.js';

// Strip positions for easier shape assertions. Keeps `kind`, content,
// and `glued` so the adjacency signal is still visible.
function strip(node) {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(strip);
  if (typeof node !== 'object') return node;
  const out = { kind: node.kind };
  if ('text'  in node) out.text  = node.text;
  if ('items' in node) out.items = node.items.map(strip);
  if ('parts' in node) {
    out.parts = node.parts.map(p =>
      'lit' in p ? { lit: p.lit } : { embed: strip(p.embed) }
    );
  }
  if (node.glued) out.glued = true;
  return out;
}

const top = src => strip(parseTree(tokenize(src)));

test('empty source -> empty top-level Tmpl', () => {
  assert.deepEqual(top(''), { kind: 'Tmpl', items: [] });
});

test('single word -> top-level Tmpl with one Word', () => {
  assert.deepEqual(top('hello'), {
    kind: 'Tmpl',
    items: [{ kind: 'Word', text: 'hello' }],
  });
});

test('two space-separated words', () => {
  assert.deepEqual(top('a b'), {
    kind: 'Tmpl',
    items: [
      { kind: 'Word', text: 'a' },
      { kind: 'Word', text: 'b' },
    ],
  });
});

test('two words glued together', () => {
  // No whitespace between them so the second carries `glued: true`.
  // (Currently the tokenizer would still merge `ab` into one WORD;
  // this test exercises the glued flag using `)a` shape — see below.)
  assert.deepEqual(top('(x)y'), {
    kind: 'Tmpl',
    items: [
      { kind: 'Pattern', items: [{ kind: 'Word', text: 'x' }] },
      { kind: 'Word', text: 'y', glued: true },
    ],
  });
});

test('a template with three items', () => {
  assert.deepEqual(top('{a b c}'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Tmpl',
      items: [
        { kind: 'Word', text: 'a' },
        { kind: 'Word', text: 'b' },
        { kind: 'Word', text: 'c' },
      ],
    }],
  });
});

test('nested templates', () => {
  assert.deepEqual(top('{{a b} {c}}'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Tmpl',
      items: [
        { kind: 'Tmpl', items: [
          { kind: 'Word', text: 'a' },
          { kind: 'Word', text: 'b' },
        ] },
        { kind: 'Tmpl', items: [
          { kind: 'Word', text: 'c' },
        ] },
      ],
    }],
  });
});

test('pattern around words', () => {
  assert.deepEqual(top('(a:_ b:_)'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Pattern',
      items: [
        { kind: 'Word', text: 'a:' },
        { kind: 'Word', text: '_', glued: true },
        { kind: 'Word', text: 'b:' },
        { kind: 'Word', text: '_', glued: true },
      ],
    }],
  });
});

test('nested patterns', () => {
  assert.deepEqual(top('(a (b))'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Pattern',
      items: [
        { kind: 'Word', text: 'a' },
        { kind: 'Pattern', items: [{ kind: 'Word', text: 'b' }] },
      ],
    }],
  });
});

test('box wraps its contents', () => {
  assert.deepEqual(top('[counter]'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Box',
      items: [{ kind: 'Word', text: 'counter' }],
    }],
  });
});

test('empty text template', () => {
  assert.deepEqual(top('""'), {
    kind: 'Tmpl',
    items: [{ kind: 'Text', parts: [] }],
  });
});

test('plain text template', () => {
  assert.deepEqual(top('"hello"'), {
    kind: 'Tmpl',
    items: [{ kind: 'Text', parts: [{ lit: 'hello' }] }],
  });
});

test('text with one placeholder', () => {
  assert.deepEqual(top('"Hi {name?}"'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Text',
      parts: [
        { lit: 'Hi ' },
        { embed: { kind: 'Tmpl', items: [{ kind: 'Word', text: 'name?' }] } },
      ],
    }],
  });
});

test('text starting with a placeholder', () => {
  assert.deepEqual(top('"{n?}!"'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Text',
      parts: [
        { embed: { kind: 'Tmpl', items: [{ kind: 'Word', text: 'n?' }] } },
        { lit: '!' },
      ],
    }],
  });
});

test('text with multiple placeholders', () => {
  assert.deepEqual(top('"{a?} and {b?}"'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Text',
      parts: [
        { embed: { kind: 'Tmpl', items: [{ kind: 'Word', text: 'a?' }] } },
        { lit: ' and ' },
        { embed: { kind: 'Tmpl', items: [{ kind: 'Word', text: 'b?' }] } },
      ],
    }],
  });
});

test('nested strings via placeholders', () => {
  assert.deepEqual(top('"{"inner"}"'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Text',
      parts: [{
        embed: {
          kind: 'Tmpl',
          items: [{ kind: 'Text', parts: [{ lit: 'inner' }] }],
        },
      }],
    }],
  });
});

test('placeholder with multiple struct items', () => {
  assert.deepEqual(top('"{a b}"'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Text',
      parts: [{
        embed: {
          kind: 'Tmpl',
          items: [
            { kind: 'Word', text: 'a' },
            { kind: 'Word', text: 'b' },
          ],
        },
      }],
    }],
  });
});

test('glued flag on adjacent items inside a Tmpl', () => {
  // `{(x)y z}` — the `y` is glued to the preceding `(x)`, `z` is not.
  assert.deepEqual(top('{(x)y z}'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Tmpl',
      items: [
        { kind: 'Pattern', items: [{ kind: 'Word', text: 'x' }] },
        { kind: 'Word', text: 'y', glued: true },
        { kind: 'Word', text: 'z' },
      ],
    }],
  });
});

test('first item in a frame is never glued', () => {
  // Even though `(x)` is the very first child of `{...}` there's
  // nothing before it, so `glued` should not be set.
  assert.deepEqual(top('{(x)}'), {
    kind: 'Tmpl',
    items: [{
      kind: 'Tmpl',
      items: [
        { kind: 'Pattern', items: [{ kind: 'Word', text: 'x' }] },
      ],
    }],
  });
});

test('arrow is preserved as a Word for the operator pass', () => {
  // The pipeline operator survives parseTree as a Word(`->`) so
  // parseOperators (later) can recognise the chain. Adjacency is
  // marked correctly: `a->b` has both `->` and `b` glued.
  assert.deepEqual(top('a->b'), {
    kind: 'Tmpl',
    items: [
      { kind: 'Word', text: 'a' },
      { kind: 'Word', text: '->', glued: true },
      { kind: 'Word', text: 'b', glued: true },
    ],
  });
});

test('unmatched open brace raises', () => {
  assert.throws(() => parseTree(tokenize('{a')), PunkSyntaxError);
});

test('unmatched close brace raises', () => {
  assert.throws(() => parseTree(tokenize('a}')), PunkSyntaxError);
});

test('unmatched open paren raises', () => {
  assert.throws(() => parseTree(tokenize('(a')), PunkSyntaxError);
});

test('unmatched close paren raises', () => {
  assert.throws(() => parseTree(tokenize('a)')), PunkSyntaxError);
});

test('unmatched open bracket raises', () => {
  assert.throws(() => parseTree(tokenize('[a')), PunkSyntaxError);
});

test('positions propagate to nodes', () => {
  const tree = parseTree(tokenize('  {a}\n  b'));
  // Top-level Tmpl has the inner Tmpl at line 1 col 3 and Word `b`
  // at line 2 col 3.
  assert.equal(tree.items[0].line, 1);
  assert.equal(tree.items[0].col,  3);
  assert.equal(tree.items[1].line, 2);
  assert.equal(tree.items[1].col,  3);
});
