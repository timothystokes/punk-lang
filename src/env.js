// Immutable environment: name -> value with parent-chain lookup.
//
// Functional API only. `extend` returns a fresh env; never mutates the parent.
// The root env is built once at evaluator startup with all built-ins.

export function makeEnv(parent = null, bindings = null) {
  const map = new Map();
  if (bindings) {
    for (const [k, v] of Object.entries(bindings)) map.set(k, v);
  }
  // Boxes live in a single mutable Map shared by every env in a root chain.
  // They sit outside the normal name namespace (per docs) and are reached
  // only by the pipeline form `[name]->...` / `...->[name]!`.
  const boxes = parent ? parent.boxes : new Map();
  // currentFile is the absolute path of the .punk file being evaluated, used
  // to resolve relative `import!` paths. Null at the REPL / top level.
  const currentFile = parent ? parent.currentFile : null;
  return { parent, bindings: map, boxes, currentFile };
}

export function lookup(env, name) {
  let e = env;
  while (e !== null) {
    if (e.bindings.has(name)) return e.bindings.get(name);
    e = e.parent;
  }
  return undefined;
}

export function has(env, name) {
  let e = env;
  while (e !== null) {
    if (e.bindings.has(name)) return true;
    e = e.parent;
  }
  return false;
}

export function extend(env, bindings) {
  return makeEnv(env, bindings);
}

// One-shot constructor for a top-level env.
export function rootEnv(bindings = {}) {
  return makeEnv(null, bindings);
}
