// Punk entry point: source text in, formatted result out.
// Only syntax errors throw (ERR-1); everything else evaluates to [] (ERR-3).

import { parse } from './parse.js';
import { createGlobal, evalProgram, setOutput } from './eval.js';
import { formatResult } from './format.js';
import { newEnv } from './env.js';

export { setOutput };

// One-shot: a file is its own namespace context under the global one.
export function run(source) {
  const program = parse(source);
  return formatResult(evalProgram(program, newEnv(createGlobal())));
}

// REPL session: one shared context across lines.
export function createSession() {
  const env = newEnv(createGlobal());
  return { evalLine: (source) => formatResult(evalProgram(parse(source), env)) };
}
