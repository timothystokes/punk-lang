// Every example in the docs (a ```punk block followed by a **`output`** line) must produce that output.
// The README is a running narrative, so its examples share one session and may rebind names.
// The lessons (lessons/*.md) examples are each self-contained and run in a fresh context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/parse.js';
import { createGlobal, evalProgram, setBaseDir } from '../src/eval.js';
import { formatResult } from '../src/format.js';
import { newEnv } from '../src/env.js';

setBaseDir(fileURLToPath(new URL('../examples', import.meta.url)));

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const examples = (text) => [...text.matchAll(/```punk\n([\s\S]*?)```(?:\n\*\*`(.*)`\*\*)?/g)]
  .map((m) => ({ src: m[1].replace(/\n$/, ''), out: m[2] }));

function freshEnv(rebind) {
  const env = newEnv(createGlobal());
  if (rebind) env.define = (name, value) => { env.vars.set(name, value); return true; };
  return env;
}

function evaluate(src, env) {
  try { return formatResult(evalProgram(parse(src), env)); } catch (e) { return e.message; }
}

function check(file, shared) {
  let env = freshEnv(shared);
  examples(read(file)).forEach(({ src, out }, i) => {
    if (!shared) env = freshEnv(false);
    const got = evaluate(src, env);
    if (out !== undefined) test(`${file} #${i + 1}: ${src.split('\n')[0]}`, () => assert.equal(got, out));
  });
}

check('../README.md', true);
for (const f of readdirSync(fileURLToPath(new URL('../lessons', import.meta.url))).filter((f) => f.endsWith('.md')).sort()) check(`../lessons/${f}`, false);
