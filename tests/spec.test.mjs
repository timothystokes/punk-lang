// One conformance test per spec rule ID (docs/punk-specification.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/punk.js';
import { setBaseDir } from '../src/eval.js';
import { isSyntaxError } from '../src/errors.js';
import { servers } from '../src/builtins.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Modules are files, so the module tests write theirs to a temp directory.
const modDir = mkdtempSync(join(tmpdir(), 'punk-mods-'));
writeFileSync(join(modDir, 'mod.punk'), 'double:*![2]\nsecret:5\n');
writeFileSync(join(modDir, 'selfmod.punk'), 'x:import!selfmod\nx?\n');
setBaseDir(modDir);

const rule = (id, src, out) => test(`${id}`, () => assert.equal(run(src), out));
const syntax = (id, src) => test(`${id}`, () => assert.throws(() => run(src)));
const many = (id, pairs) => test(`${id}`, () => { for (const [s, o] of pairs) assert.equal(run(s), o, s); });

// LEX
rule('LEX-1', 'a b c', '[a b c]');
rule('LEX-2', 'if then TRUE', '[if then TRUE]');
many('LEX-3', [['a.b', 'a.b'], ['x:1', 'x:1'], ['[a b]', '[a b]']]);
rule('LEX-4', 'a_b #c', '[a_b #c]');
rule('LEX-5', 'x:5\nx?\n-> (5)[five]!\n--> (5)[deep]!', 'deep');
rule('LEX-6', '[1 2] > ^![TRUE FALSE]', 'TRUE');
many('LEX-7', [['TRUE', 'TRUE'], ['x:TRUE\nx?', 'TRUE']]);
many('LEX-8', [['a\\:b', 'a:b'], ['\\![6 3]', '2']]);
rule('LEX-9', 'x:[a ## note\nb]\nx?', '[a b]');
rule('LEX-10', 'f:(_)[\n.?\n-> (5)[five]\n]\nf!5', 'five');
// THING
rule('THING-1', '[a [b c] d:e]', '[a [b c] d:e]');
rule('THING-2', 'f:(_)[x]\nf?', '(_)[x]');
rule('THING-3', '[42 hello TRUE]', '[42 hello TRUE]');
rule('THING-4', '+![5 hello]', '5');
rule('THING-5', '[a b c]', '[a b c]');
rule('THING-6', '[a b](_ _)!', 'TRUE');
rule('THING-7', '[]', '[]');
rule('THING-8', 'x:[a b]\nx.5?', '[]');
rule('THING-9', 'f:(_ _)[x]\nf![a b c]', '[]');
// GRP
rule('GRP-1', '[word](word)!', 'TRUE');
rule('GRP-2', '[a b]', '[a b]');
rule('GRP-3', 'f:(n:_)[Hi .n?]\nf!Bob', '[Hi Bob]');
rule('GRP-4', 'f:(n:_)[.n?]\nf![Bob]', 'Bob');
rule('GRP-5', '[[x]]', 'x');
rule('GRP-6', '=![[x] x]', 'TRUE');
rule('GRP-7', 'x > (_)!', 'TRUE');
rule('GRP-8', '=![[] x]', 'FALSE');
rule('GRP-9', '[a b]', '[a b]');
// NAME
rule('NAME-1', 'x:1\nx?', '1');
test('ERR-1b', () => { assert.throws(() => run('x: 5'), /A name can only be attached to a thing/); });
test('NAME-1a', () => { assert.throws(() => run('x: 5'), isSyntaxError); });
test('LEX-11', () => {
  assert.throws(() => run('xs:[1 2]\nxs ?'), isSyntaxError);
  assert.throws(() => run('f:(_)[1]\nf !5'), isSyntaxError);
  assert.equal(run('f:()[1]\nf! 2'), '[f! 2]');
});
test('FN-10', () => { assert.equal(run('(_) [1]'), '[(_) 1]'); });
rule('NAME-8', 'k:colour\nv:red\nx:{k?}:{v?}\nx.colour?', 'red');
syntax('NAME-2', 'x:1\nx:2\nx?');
rule('NAME-2a', 'f:(_)[y:2 .?]\n1 > f!\ny?', '[]');
rule('NAME-2b', 'x:1\nf:(_)[x?]\n0 > f!', '1');
rule('NAME-2c', 'x:1\nf:(_)[x?]\n0 > f!', '1');
rule('NAME-2d', 'x:1\nf:(_)[x:2 x?]\n0 > f!', '[x:2 2]');
rule('NAME-2e', 'n:outer\nf:(_)[.n?]\n0 > f!', '[]');
rule('NAME-3', 'x:1', 'x:1');
rule('NAME-4', 'a:[b:[c:1]]\na.b.c?', '1');
// QRY
rule('QRY-1', 'x:5\nx?', '5');
rule('QRY-2', 'p:[a:[b:7]]\np.a.b?', '7');
rule('QRY-3', 'p:[a:1 b:2]\np.b?', '2');
rule('QRY-4', 'p:[x y z]\np.2?', 'y');
rule('QRY-5', 'p:[x y z]\np.1?', 'x');
rule('QRY-6', 'p:[a:[x y]]\np.a.2?', 'y');
rule('QRY-7', 'p:[a:1]\np.b.c?', '[]');
rule('QRY-8', 'p:[1 2]\n[a p? b]!', '[a [1 2] b]');
rule('QRY-9', 'p:[x y z]\np.-1?', 'z');
rule('QRY-10', 'p:[w x y z]\n[p.1-2? p.2--1?]!', '[[w x] [x y z]]');
rule('QRY-11', 'p:[w x y z]\np.3-?', '[y z]');
test('QRY-12', () => {
  assert.equal(run('p:[x y z]\np.2-9?'), '[y z]');
  assert.equal(run('p:[x y z]\np.0-2?'), '[]');
  assert.equal(run('p:[x y z]\np.4-?'), '[]');
  assert.equal(run('p:[x y z]\np.3-1?'), '[]');
  assert.equal(run('p:[x y z]\np.-9?'), '[]');
});
// TMPL / EMB
rule('TMPL-3', 'f:(n:_)[Total +![n? 1]]\nf!4', '[Total 5]');
rule('TMPL-4', 'g:(n:_)[x:+![n? 1] x? *![x? 2]]\ng!3', '[x:4 4 8]');
rule('TMPL-5', 'h:(n:_)[hi n?]\nk:(n:_)[h!n? done]\nk!Bob', '[[hi Bob] done]');
rule('TMPL-6', '[a +![1 2]]', '[a +![1 2]]');
rule('TMPL-1c', '[a +![1 2] b]!', '[a 3 b]');
rule('TMPL-1', 'p:Paul\n[Hi p?]!', '[Hi Paul]');
rule('TMPL-2', '[a b]!', '[a b]');
rule('EMB-1', 'e:x\n[{e?}-d]!', 'x-d');
rule('EMB-2', 'e:x\n[{e?}-d]', '{e?}-d');
rule('EMB-3', 'e:prod\n[{e?}]!', 'prod');
rule('EMB-4', 'e:prod\n[db-{e?}]!', 'db-prod');
rule('EMB-5', 'e:prod\n[db e?]!', '[db prod]');
rule('EMB-6', 'p:[a:[b:1]]\n[x{p.a.b?}]!', 'x1');
rule('EMB-7', '[a{nope?}b]!', 'ab');
syntax('EMB-8', '[{a{b?}}]!');
rule('EMB-9', 'n:[Paul Jones]\n[Dr-{n?}-x]!', '[Dr-Paul Jones-x]');
rule('EMB-10', 'n:[Paul Jones]\n[Dr-{n?}]! > count!', '2');
many('EMB-13', [
  ['greet:(#)[Hello {.?}]\n[Punk Lang] > greet!', '[Hello Punk Lang]'],
  ['p:[a [b c]]\n[Hello {p?}]!', '[Hello a [b c]]'],
  ['p:Paul\n[Hello {p?}]!', '[Hello Paul]'],
  ['p:[x:1]\n[Hello {p?}]!', '[Hello x:1]'],
]);
rule('EMB-11', 'n:Paul\n[Dr-{n?}]! > count!', '1');
// PAT
rule('PAT-1', '[a b](_ _)!', 'TRUE');
rule('PAT-2', '[a b](_)!', 'FALSE');
many('PAT-3', [['[a b c](_ #)!', 'TRUE'], ['[a](_ #)!', 'TRUE'], ['[a](#)!', 'TRUE']]);
syntax('PAT-3a', '[a](# _)!');
many('PAT-4', [['[a b](a _)!', 'TRUE'], ['[a b](c _)!', 'FALSE'], ['[n:Tim](Tim)!', 'TRUE']]);
rule('PAT-5', '[a b](b a)!', 'FALSE');
rule('PAT-6', '[a b c](_ _)!', 'FALSE');
rule('PAT-7', '[a](_)!', 'TRUE');
many('PAT-8', [['x:[a b]\nx? > (_ _)!', 'TRUE'], ['x:[a b]\nx?(_ _)!', 'TRUE']]);
rule('PAT-9', '[a b] > (_ _)[matched]!', 'matched');
rule('PAT-10', 'f:(n:_)[.n?]\nf!Sally', 'Sally');
rule('PAT-11', 'f:(n:_)[hi n?]\nf!Sally', '[hi Sally]');
rule('PAT-12', 'f:(n:_)[n?]\nf![tim]', 'tim');
rule('PAT-13', '[a:1](# | b:1)!', 'FALSE');
rule('PAT-13a', '[a:1](n:_)!', 'TRUE');
syntax('PAT-14', '[a](# | b:1 | c:1)!');
rule('PAT-15', '[a b:1](_ # | b:1)!', 'TRUE');
rule('PAT-16', '[a:1 b:2](# | a:1 b:2)!', 'TRUE');
rule('PAT-17', '[a:1 b:2](# | b:2)!', 'TRUE');
rule('PAT-18', '[a:1 b:2](# | b:2 a:1)!', 'TRUE');
rule('PAT-18a', 'p:[person:[name:[Bob Smith] age:3]]\np?(# | person:[name:[Bob Smith]])!', 'TRUE');
rule('PAT-18b', '[x y a:1](# | a:1)!', 'TRUE');
many('PAT-19', [['[a:1](# | a:2)!', 'FALSE'], ['[a:1](_ _ | a:1)!', 'FALSE']]);
// FN
rule('FN-1', '[x y] > (_ _)[ok]!', 'ok');
rule('FN-2', 'f:(a:_)[.a?]\nf![1 2]', '[]');
rule('FN-3', 'f:(_ _)[.2?]\nf![a b]', 'b');
rule('FN-4', 'f:(a:_ b:_)[b? a?]\nf![x y]', '[y x]');
rule('FN-5', 'welcome:(name:_)[Hello .name?]\nwelcome!Sally', '[Hello Sally]');
rule('FN-6', 'f:(_)[hi]\nSally > f!', 'hi');
rule('FN-7', 'f:(_ _)[hi]\nf![a b c]', '[]');
rule('FN-8', 'f:(n:_)[{n?}x]\nf!a', 'ax');
// PIPE / CASE / CURRY
rule('PIPE-1', '4 > -!8 > *!7', '28');
rule('PIPE-2', 'f:(_)[x]\n[a b] > f!', '[]');
rule('PIPE-3', 'p:> upper! > rev!\nabc > p!', 'ABC');
rule('PIPE-4', 'p:> upper!\nabc > p!', 'ABC');
rule('PIPE-5', 'y:[a b]\nx:y? > count!\nx?', '2');
rule('CASE-1', 'x:5\nx?\n-> (5)[five]!', 'five');
rule('CASE-2', 'x:5\nx?\n-> (_)[first]!\n-> (5)[second]!', 'first');
rule('CASE-3', 'x:5\nx?\n-> (5)[a]!\n-> (5)[b]!', 'a');
rule('CASE-4', 'x:5\nx?\n-> (5)[a]!\n--> (5)[sub]!', 'sub');
rule('CASE-5', 'x:5\nx?\n-> (6)[a]!\n--> (5)[sub]!\n-> (5)[b]!', 'b');
rule('CASE-6', 'x:5\nx?\n-> (5)[a]!\n--> (6)[sub]!\n-> (5)[b]!', '[]');
rule('CASE-7', 'x:5\nx?\n-> (6)[a]!', '[]');
rule('CURRY-1', 'f:(_ _)[.?]\ng:f!1\n2 > g!', '[1 2]');
rule('CURRY-2', 'f:(a:_ b:_)[a? b?]\ng:f!x\ny > g!', '[x y]');
rule('CURRY-3', 'timesTwo:*![2]\n4 > timesTwo!', '8');
rule('CURRY-4', '[8] > -!9', '1');
rule('CURRY-5', '[1 2 3 4] > filter!lt!2', '[3 4]');
// ERR
syntax('ERR-1', '[a b');
rule('ERR-2', 'nope!x', '[]');
syntax('ERR-1a', '(_ _');
many('ERR-3', [['\\![1 0]', '[]'], ['x? ', '[]'], ['+![a b]', '0']]);
// LIB
rule('LIB-1', 'upper![a b]', '[A B]');
rule('LIB-2', '-![1 2 3]', '[]');
rule('LIB-3', 'x:[b a]\nsort!x?\nx?', '[b a]');
many('LIB-4', [['=![[a b:1] [a b:1]]', 'TRUE'], ['=![[a b:1] [a b:2]]', 'FALSE'], ['~=![a b]', 'TRUE']]);
many('LIB-5', [['+![1 x]', '1'], ['length!42', '2']]);
rule('LIB-6', '\\![5 0]', '[]');
many('FN-9', [['f:()[hi]\nf!', 'hi'], ['f:()[hi]\nf![]', 'hi'], ['f:()[hi]\nf!x', '[]']]);
many('EMB-12', [['f:()[7]\n[n{f!}]!', 'n7']]);
test('EMB-12 time', () => assert.match(run('[a {time!}]!'), /^\[a \d+\]$/));
test('LIB-9 time', () => assert.ok(Math.abs(Number(run('time!')) - Date.now()) < 5000));
many('LIB-10', [
  ['h:import!punk.html\nh.page![head:()[title:()[A B]] body:()[h1:(color:red)[Hi]]]', '<!DOCTYPE html><html lang="en"><head><title>A B</title></head><body><h1 color="red">Hi</h1></body></html>'],
  ['f:(a:1 _)[x y p:()[z]]\n[f?] > patternOf!', '[a:1 _]'],
  ['cat![a b]', 'ab'],
  ['x:7\ng:()[{x?} t]\nh:()[g:()[{x?}]]\nh? > bodyOf!', 'g:()[{x?}]'],
]);
many('LIB-11', [['c > push![a b]', '[a b c]'], ['c > push![[]]', 'c']]);
many('LIB-13', [['[a b c] > pop!', '[a b]'], ['[a b c] > shift!', '[b c]'], ['unshift![x [a b]]', '[x a b]'],
  ['take![2 a b c]', '[a b]'], ['drop![1 a b c]', '[b c]'], ['remove![2 a b c]', '[a c]']]);
// HOF
rule('HOF-1', 'double:*![2]\n[1 2] > map!double?', '[2 4]');
rule('HOF-2', '[1 2 3] > map!(n:_)[n?]', '[1 2 3]');
rule('HOF-3', '[a b c] > map!(n:_)[n?]', '[a b c]');
rule('HOF-4', '[1 2 3] > reduce![-? 10]', '4');
many('HOF-5', [['[1 2] > filter!(n:_)[=![n? 1]]', '1'], ['[1 2] > filter!(n:_)[yes]', '[]']]);
rule('HOF-6', 'x:[3 1 2]\nsort!x?\nx?', '[3 1 2]');
rule('HOF-8', 'double:*![2]\n[1 2] > map!double', '[[] []]');
many('HOF-9', [
  ['[a:1 b:2] > map!(v:_ k:_)[{k?}-{v?}]', '[a-1 b-2]'],
  ['[x y] > map!(v:_ k:_ i:_)[{v?}{i?}]', '[x1 y2]'],
  ['[x y] > map!(v:_ k:_ i:_)[{k?}]', '[[] []]'],
  ['[x y] > map!(#)[got .?]', '[[got [x [] 1]] [got [y [] 2]]]'],
  ['[[a:1 z:0] [a:2 z:0]] > map!(r:_)[r.a?]', '[1 2]'],
]);
many('HOF-7', [['[] > map!upper?', '[]'], ['[] > any!upper?', 'FALSE']]);
// ATOM
rule('ATOM-1', '[1 2] > @t!\n@t', '[1 2]');
rule('ATOM-2', '@unsetAtom', '[]');
many('ATOM-3', [['5 > @c!', '5'], ['@c!7\n@c', '7']]);
rule('ATOM-4', '3 > @g!\nf:(#)[@g]\nf!', '3');
// MOD
rule('MOD-1', 'm:import!mod\nm.secret?', '5');
rule('MOD-2', 'm:import!mod\nm.double![4]', '8');
rule('MOD-3', 'a:import!mod\nb:import!mod\n=![a? b?]', 'TRUE');
many('MOD-4', [['secret:1\nm:import!mod\nm.secret?', '5'], ['import!nosuchmodule', '[]'], ['import!selfmod', 'x:[]']]);
// LIB: modules, named things, http
many('LIB-7', [['nameOf![a:1]', 'a'], ['valueOf![a:1]', '1'], ['isnamed![a:1]', 'TRUE'], ['isnamed![a]', 'FALSE'], ['pick![b [a:1 b:2]]', '2'], ['urldecode!a+b%21', 'a b!'], ['urlencode![a b]', 'a%20b']]);
test('LIB-8 serve', async () => {
  run('handler:(#)[\n.?\n-> (# | url:/hi)[status:201 headers:[X-A:b] body:[hello]]\n-> (#)[status:404 body:[no]]\n]\nserve![18765 handler?]');
  try {
    const ok = await fetch('http://localhost:18765/hi');
    assert.equal(ok.status, 201);
    assert.equal(ok.headers.get('x-a'), 'b');
    assert.equal(await ok.text(), 'hello');
    assert.equal((await fetch('http://localhost:18765/zz')).status, 404);
  } finally { servers.forEach((sv) => sv.close()); }
});
test('LIB-12 serve parses form bodies', async () => {
  run('handler:(method:_ url:_ headers:_ b:_)[status:200 body:{b.note?}]\nserve![18766 handler?]');
  try {
    const r = await fetch('http://localhost:18766/', { method: 'POST', body: 'note=hi+x', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
    assert.equal(await r.text(), 'hi x');
  } finally { servers.forEach((sv) => sv.close()); }
});
