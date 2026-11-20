// Namespace contexts (NAME-2a..2e). Each function body and each file is
// its own context; lookups cascade outward to the global context.
// Names are immutable within a context: `define` returns false (and keeps
// the original) when the name is already bound there.

// fnInfo is { arg } for a function-call context, else null.
export function newEnv(parent = null, fnInfo = null) {
  const vars = new Map();
  const env = {
    parent,
    vars,
    fn: fnInfo,

    define(name, value) {
      if (vars.has(name)) return false;
      vars.set(name, value);
      return true;
    },

    lookup(name) {
      for (let e = env; e; e = e.parent) {
        if (e.vars.has(name)) return e.vars.get(name);
      }
      return undefined;
    },

    root() {
      let e = env;
      while (e.parent) e = e.parent;
      return e;
    },

    // Atoms are the only mutable state; they live in the global context.
    atoms() {
      const r = env.root();
      if (!r.atomStore) r.atomStore = new Map();
      return r.atomStore;
    },

    // The nearest enclosing function-call context, for `.` references.
    localFn() {
      for (let e = env; e; e = e.parent) {
        if (e.fn) return e;
      }
      return null;
    },
  };
  return env;
}
