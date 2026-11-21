// Browser entry: runs Punk source and reports what it printed, its result or its syntax error.
import { run, setOutput } from '../src/punk.js';
import { isPunkError } from '../src/errors.js';

export function runPunk(source) {
  const printed = [];
  setOutput((line) => printed.push(line));
  try {
    return { printed, result: run(source), error: null };
  } catch (err) {
    return { printed, result: null, error: isPunkError(err) ? err.message : String(err) };
  }
}
