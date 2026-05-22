#!/usr/bin/env node
// Punk REPL.
//
// Editing rules:
//   - Return            -> submit the buffer for evaluation
//   - Option/Alt+Return -> insert a newline (continue typing)
//   - Backspace         -> delete previous char (works across lines)
//   - Ctrl+C            -> clear buffer (or exit on empty buffer)
//   - Ctrl+D            -> exit
//
// This is an append-only line editor: typing always appends to the end
// of the buffer. No cursor-movement or full-screen redraws — characters
// echo as they're entered, and Option+Return prints a continuation
// prompt on a fresh line. The global Punk environment persists across
// submissions.

import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { tokenize } from './tokenize.js';
import {
  parseTree, parseWords, parseOperators, parseValidate,
} from './parse.js';
import { evalProgramAsTmpl } from './eval.js';
import { Env } from './env.js';
import { formatRepl } from './format.js';

const PROMPT = 'punk> ';
const CONT   = '....  ';
const env    = new Env();

const stdin  = process.stdin;
const stdout = process.stdout;

let buffer  = '';   // current input
// Tracks the visible length of the LAST display line (chars after the
// most recent newline). Used to support backspace across line wraps.
let curLineChars = 0;

if (process.argv.length > 2) {
  // File mode: `node src/cli.js path/to/file.punk` — evaluate file and exit.
  const file = process.argv[2];
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch (e) {
    stdout.write(`cannot read ${file}: ${e.message}\n`);
    process.exit(1);
  }
  try { evalFile(src); }
  catch (e) { stdout.write(formatError(e) + '\n'); process.exit(1); }
} else if (!stdin.isTTY) {
  let src = '';
  stdin.setEncoding('utf8');
  stdin.on('data', (d) => { src += d; });
  stdin.on('end', () => {
    try { evalFile(src); }
    catch (e) { stdout.write(formatError(e) + '\n'); process.exit(1); }
  });
} else {
  startRepl();
}

function startRepl() {
  stdout.write('Punk REPL. Return to submit, Option+Return for newline, Ctrl+D to exit.\n');
  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  writePrompt();
  stdin.on('keypress', onKey);
}

function writePrompt() {
  stdout.write(PROMPT);
  curLineChars = 0;
}

function writeCont() {
  stdout.write(CONT);
  curLineChars = 0;
}

function onKey(_str, key) {
  if (!key) return;

  if (key.ctrl && key.name === 'c') {
    if (buffer.length === 0) { stdout.write('\n'); process.exit(0); }
    buffer = '';
    stdout.write('\n');
    writePrompt();
    return;
  }
  if (key.ctrl && key.name === 'd') {
    if (buffer.length === 0) { stdout.write('\n'); process.exit(0); }
    return;
  }

  if (key.name === 'return' || key.name === 'enter') {
    if (key.meta || key.option || key.shift) {
      buffer += '\n';
      stdout.write('\n');
      writeCont();
      return;
    }
    submit();
    return;
  }

  // Ctrl+J as a portable "insert newline" fallback.
  if (key.ctrl && key.name === 'j') {
    buffer += '\n';
    stdout.write('\n');
    writeCont();
    return;
  }

  if (key.name === 'backspace') {
    if (buffer.length === 0) return;
    const removed = buffer[buffer.length - 1];
    buffer = buffer.slice(0, -1);
    if (removed === '\n') {
      // Move up one line and to the end of the previous content line.
      // Recompute the previous line's char count from the buffer.
      curLineChars = currentDisplayLineLength();
      const promptLen = buffer.includes('\n') ? CONT.length : PROMPT.length;
      stdout.write(`\x1b[A\r\x1b[${promptLen + curLineChars}C`);
    } else {
      stdout.write('\b \b');
      if (curLineChars > 0) curLineChars--;
    }
    return;
  }

  // Ordinary printable character (or pasted text block).
  const seq = key.sequence;
  if (seq && !key.ctrl && !key.meta) {
    if (seq.length === 1 && seq >= ' ') {
      buffer += seq;
      stdout.write(seq);
      curLineChars++;
      return;
    }
    if (seq.length > 1 && !seq.startsWith('\x1b')) {
      // Pasted block — accept as-is, handling embedded newlines.
      for (const ch of seq) {
        if (ch === '\n' || ch === '\r') {
          buffer += '\n';
          stdout.write('\n');
          writeCont();
        } else if (ch >= ' ') {
          buffer += ch;
          stdout.write(ch);
          curLineChars++;
        }
      }
      return;
    }
  }
}

function currentDisplayLineLength() {
  const lastNl = buffer.lastIndexOf('\n');
  return lastNl === -1 ? buffer.length : buffer.length - lastNl - 1;
}

function submit() {
  stdout.write('\n');
  const source = buffer;
  buffer = '';
  if (source.trim() === '') { writePrompt(); return; }
  try {
    const out = evalToString(source);
    if (out !== '') stdout.write(out + '\n');
  } catch (e) {
    stdout.write(formatError(e) + '\n');
  }
  writePrompt();
}

function evalToString(source) {
  const tokens = tokenize(source);
  const tree = parseValidate(
    parseOperators(parseWords(parseTree(tokens))),
  );
  const value = evalProgramAsTmpl(tree, env);
  return formatRepl(value);
}

function evalFile(source) {
  const tokens = tokenize(source);
  const tree = parseValidate(
    parseOperators(parseWords(parseTree(tokens))),
  );
  evalProgramAsTmpl(tree, env);
}

function formatError(e) {
  if (e && e.name && e.message) return `${e.name}: ${e.message}`;
  return String(e && e.message ? e.message : e);
}
