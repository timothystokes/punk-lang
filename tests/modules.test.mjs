// Modules — `import!` and `importJS!`.
//
// TODO: behavioural tests deferred until the runtime supports a
// base-directory option for resolving relative imports. The test helper
// currently runs source from an inline JS string with no notion of
// "here", so `import!"./helpers"` can't resolve.
//
// When the runtime gains a base-dir parameter:
//   - update `tests/_punk.mjs` `run(source, baseDir)` and `punk(source, baseDir)`
//   - create `tests/modules/<fixture>.punk` files
//   - cover:
//       * `import!punk.html` — stdlib lookup
//       * `import!"./greet"` — relative resolution, namespace binding
//       * `import!` of a module twice in one program — shared definitions
//       * `importJS!fs` — JS interop bridge (numbers, text, fns)
//       * Re-binding the imported module under different names
//
// For now: only the parser-shape sanity checks live here.

import { test } from 'node:test';
import { punkThrows } from './_punk.mjs';

test('import! — missing arg is an error', () => {
  punkThrows('import!');
});

test('importJS! — missing arg is an error', () => {
  punkThrows('importJS!');
});
