// Black-box test helper for Punk.
//
// `punk(source)` runs a Punk program string and returns the formatted
// value of its final top-level expression, exactly as the REPL would
// print it. Tests written against this helper describe the LANGUAGE,
// not the implementation, and should survive any internal rewrite.
//
// The helper depends on a single target entry point:
//   `../src/punk.js` exporting `run(source) -> string`.
// That module is part of the rewrite target; it should expose a stable
// REPL-style runner that takes source text and returns the formatted
// final value (or throws on a runtime error).

import { run } from '../src/punk.js';

export function punk(source) {
  return run(source);
}

// Asserts that running `source` throws a runtime error. Returns the
// error so callers can make further claims about its message.
export function punkThrows(source) {
  let err;
  try { run(source); }
  catch (e) { err = e; }
  if (!err) throw new Error(`expected Punk error, got success for:\n${source}`);
  return err;
}
