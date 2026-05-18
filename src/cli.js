#!/usr/bin/env node
// Punk CLI: run a `.punk` file or start a REPL.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { tokenize } from './tokenize.js';
import { parse } from './parse.js';
import { evalProgram } from './eval.js';
import { rootEnv } from './env.js';
import { defaultBindings } from './builtins.js';
import { formatValue, NULL } from './values.js';

function makeEnv() { return rootEnv(defaultBindings()); }

function run(source, env) {
  return evalProgram(parse(tokenize(source)), env);
}

// Walk the source counting brackets so the REPL knows when an entry is
// complete. Honours `#...#` block comments, `"..."` regex literals (which
// can span lines), and `\X` escapes.
function isComplete(source) {
  let depth = 0;
  let inComment = false;
  let inRegex = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') { i++; continue; }
    if (inComment) { if (c === '#') inComment = false; continue; }
    if (inRegex)   { if (c === '"') inRegex = false; continue; }
    if (c === '#') { inComment = true; continue; }
    if (c === '"') { inRegex = true; continue; }
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') depth--;
    if (depth < 0) return true;
  }
  return !inComment && !inRegex && depth <= 0;
}

function runFile(file) {
  const abs = path.resolve(file);
  const source = fs.readFileSync(abs, 'utf8');
  const env = makeEnv();
  env.currentFile = abs;
  try {
    const { value } = run(source, env);
    if (value && value !== NULL) console.log(formatValue(value));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

function repl() {
  let env = makeEnv();
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, prompt: '> ',
  });
  console.log('Punk REPL — Ctrl-D to exit');
  rl.prompt();
  let buffer = '';
  rl.on('line', (line) => {
    buffer += (buffer ? '\n' : '') + line;
    if (!isComplete(buffer)) { rl.setPrompt('… '); rl.prompt(); return; }
    const source = buffer; buffer = ''; rl.setPrompt('> ');
    try {
      const { value, env: nextEnv } = run(source, env);
      env = nextEnv;
      if (value && value !== NULL) console.log(formatValue(value));
    } catch (err) {
      console.error('Error:', err.message);
    }
    rl.prompt();
  });
  rl.on('close', () => { process.stdout.write('\n'); process.exit(0); });
}

const args = process.argv.slice(2);
if (args.length === 0) repl();
else runFile(args[0]);
