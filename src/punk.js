// The Punk entry point used by the test harness.
//
// `run(source)` takes a string of Punk source, parses it, evaluates
// it, and returns the REPL-style formatted value of the final
// top-level expression (or throws on a syntax/runtime error).

import { tokenize } from './tokenize.js';
import {
  parseTree, parseWords, parseOperators, parseValidate,
} from './parse.js';
import { evalProgram } from './eval.js';
import { Env } from './env.js';
import { formatRepl } from './format.js';

export function run(source) {
  const tokens = tokenize(source);
  const tree = parseValidate(
    parseOperators(parseWords(parseTree(tokens))),
  );
  const env = new Env();
  const value = evalProgram(tree, env);
  return formatRepl(value);
}
