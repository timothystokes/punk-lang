// Punk evaluator.
//
// `evalProgram(tree, env) -> value` walks the top-level Tmpl produced
// by the parser and returns the value of the **last** top-level item
// (this is what the REPL displays). Top-level Named items bind into
// `env` so later items can reference them.
//
// Punk's evaluation rule is shallow: templates are inert. The items
// inside a `{...}` or `"..."` are NOT auto-evaluated. They become
// part of the template value as-is. The only triggers that evaluate
// nested content are:
//   - `?`  (Query): resolves the single path it's attached to.
//   - `!`  (Exec): runs a function or template; cascades into nested
//                  content as it goes.
//
// At the top level, each item is "reached" — so a top-level Query
// resolves, a top-level Exec runs. But the items inside a Tmpl value
// are not reached until `!` is applied to the Tmpl.

import { PunkRuntimeError } from './errors.js';
import { mkTmpl, NULL } from './values.js';

// A Range value at the top level expands to a Tmpl of integers.
const expandRange = (node) => {
  const { from, to } = node;
  if (from === null || to === null) {
    throw new PunkRuntimeError(
      'open-ended range needs a path or collection to anchor to',
      node.line, node.col,
    );
  }
  const items = [];
  for (let n = from; n <= to; n++) {
    items.push({ kind: 'Word', subkind: 'number', text: String(n) });
  }
  return mkTmpl(items);
};

// Strip parser-only metadata from a node so it can be returned as a
// value. Returns a shallow-cleaned copy.
const stripMeta = (node) => {
  if (!node || typeof node !== 'object') return node;
  const { line, col, glued, ...rest } = node;
  return rest;
};

// Evaluate one top-level item. Most kinds return as-is (templates
// are inert). Named binds into `env` and yields the bound value.
const evalItem = (node, env) => {
  if (!node || typeof node !== 'object') return NULL;
  switch (node.kind) {
    case 'Tmpl':
    case 'Text':
    case 'Pattern':
    case 'Box':
    case 'Fn':
    case 'Pipeline':
    case 'Word':
      return stripMeta(node);

    case 'Range':
      return expandRange(node);

    case 'Named': {
      const value = evalItem(node.value, env);
      env.bind(node.name, value, node);
      return value;
    }

    case 'Query':
    case 'Exec':
    case 'Partial':
      throw new PunkRuntimeError(
        `evaluation of '${node.kind}' is not yet implemented`,
        node.line, node.col,
      );

    default:
      throw new PunkRuntimeError(
        `unknown node kind '${node.kind}'`,
        node.line, node.col,
      );
  }
};

export function evalProgram(tree, env) {
  if (!tree || tree.kind !== 'Tmpl') {
    throw new TypeError('evalProgram: expected a Tmpl root');
  }
  let last = NULL;
  for (const item of tree.items) {
    last = evalItem(item, env);
  }
  return last;
}
