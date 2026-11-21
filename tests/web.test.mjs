// The browser bundle must run with no Node globals, and the generated examples must all run.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserBuild, loadLessons } from '../web/build.mjs';

const { outputFiles } = await browserBuild({ write: false });
const sandbox = { console: { log() {} } };
vm.runInNewContext(outputFiles[0].text, sandbox);
const { runPunk } = sandbox.Punk;

test('web: the bundle runs Punk without Node', () => {
  assert.equal(runPunk('x:5\nx?').result, '5');
  assert.equal(runPunk('print![hi]').printed.join('|'), 'hi');
  assert.match(runPunk('x: 5').error, /A name can only be attached to a thing/);
});

test('web: file access evaluates to the non-thing', () => {
  assert.equal(runPunk('read![nope.txt]').result, '[]');
});

test('web: every lesson block runs', () => {
  const sections = loadLessons().groups.flatMap((g) => g.lessons);
  assert.ok(sections.length > 10);
  for (const s of sections) {
    for (const b of s.blocks.filter((x) => x.type === 'code')) {
      const r = runPunk(b.code);
      assert.ok(r.error === null || /^(A |The name )/.test(r.error), `${s.title}: ${b.code}`);
    }
  }
});
