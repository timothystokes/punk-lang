#!/usr/bin/env node
// Punk CLI.
//
// `npm start` (no file) — an interactive REPL: each line you enter is
// evaluated immediately, in one scope shared across the whole
// session, and the formatted result is printed.
//
// `npm start myApp.punk` — evaluates the whole file as one program,
// silently: only `print!` writes to the output.

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { setBaseDir } from './eval.js';
import { run, createSession } from './punk.js';
import { isPunkError } from './errors.js';

const file = process.argv[2];

if (file) {
  const source = readFileSync(file, 'utf8');
  setBaseDir(dirname(resolve(file)));
  try {
    run(source);
  } catch (err) {
    console.error(isPunkError(err) ? err.message : err);
    process.exitCode = 1;
  }
} else {
  const session = createSession();
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  rl.prompt();
  rl.on('line', (line) => {
    if (line.trim().length > 0) {
      try {
        console.log(session.evalLine(line));
      } catch (err) {
        console.error(isPunkError(err) ? err.message : err);
      }
    }
    rl.prompt();
  });
  rl.on('close', () => process.exit(0));
}
