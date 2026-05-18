import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { num, text, isFn, formatValue } from '../src/values.js';

const run = (src, env = rootEnv()) => evalProgram(parse(tokenize(src)), env);
const val = (src, env) => run(src, env).value;
const fmt = (src, env) => formatValue(run(src, env).value);

// -- producing partials -----------------------------------------------

test("add'5 returns a function", () => {
  const r = val("add:(a:_ b:_){a?} add5:add'5");
  assert.equal(r.name, 'add5');
  assert.equal(isFn(r.value), true);
});

test("inline partial: (add'5)!3 sees the locked-in slot", () => {
  // Body returns just `a?`; with a=5, b=3 → 5.
  assert.deepEqual(val("add:(a:_ b:_){a?} p:add'5 p!3"), num(5));
});

test("inline partial: (add'5)!3 sees the open slot", () => {
  // Body returns `b?`; with a=5, b=3 → 3.
  assert.deepEqual(val("add:(a:_ b:_){b?} p:add'5 p!3"), num(3));
});

test("partial with tmpl arg fills multiple slots: add'{3 7}!", () => {
  // Both slots filled → zero-arg fn; `!` (no next item) runs it.
  assert.equal(fmt("add:(a:_ b:_){a? b?} f:add'{3 7} f!"), '7');
});

test("zero-arg call on a fully partial-filled fn (no spaces)", () => {
  assert.equal(fmt("trio:(a:_ b:_ c:_){a? b? c?} f:trio'{1 2 3} f!"), '3');
});

test("trailing-apostrophe with space consumes next sequence item", () => {
  // `add'` is its own token (the next thing is `{3 7}`).
  assert.equal(fmt("add:(a:_ b:_){a? b?} f:add' {3 7} f!"), '7');
});

test("partial closes over outer bindings", () => {
  assert.deepEqual(val("tag:HI mk:(a:_ b:_){tag?} p:mk'1 p!2"), text('HI'));
  assert.deepEqual(val("tag:HI mk:(a:_ b:_){a?}   p:mk'1 p!2"), num(1));
  assert.deepEqual(val("tag:HI mk:(a:_ b:_){b?}   p:mk'1 p!2"), num(2));
});

// -- partial of a partial ---------------------------------------------

test("partial of a partial: trio'1 then 'p'2 leaves one slot open", () => {
  assert.deepEqual(val("trio:(a:_ b:_ c:_){a?} p:trio'1 q:p'2 q!3"), num(1));
  assert.deepEqual(val("trio:(a:_ b:_ c:_){b?} p:trio'1 q:p'2 q!3"), num(2));
  assert.deepEqual(val("trio:(a:_ b:_ c:_){c?} p:trio'1 q:p'2 q!3"), num(3));
});

test("chained partials in one word follow right-to-left semantics", () => {
  // `id'add'5`  →  id' (add' 5)  →  partial id with first slot = (add'5).
  // Then `p!` returns the captured (add'5); calling that with `!7` → b=7.
  // We pick body `b?` so result = 7.
  assert.deepEqual(
    val("add:(a:_ b:_){b?} id:(x:_){x?} p:id'add'5 inner:p! inner!7"),
    num(7),
  );
});

// -- errors ------------------------------------------------------------

test("too many partial args errors", () => {
  assert.throws(
    () => val("add:(a:_ b:_){a?} add'{1 2 3}"),
    /too many partial arguments/i,
  );
});

test("partial on a non-function errors", () => {
  assert.throws(() => val("x:42 x'5"), /not a function/i);
});

test("partial-arg shape mismatch errors", () => {
  // First slot is a literal pattern (5) — supplying 6 doesn't match.
  assert.throws(
    () => val("only5:(5 b:_){b?} only5'6"),
    /does not match/i,
  );
});

