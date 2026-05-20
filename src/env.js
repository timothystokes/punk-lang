// Lexical environment for Punk.
//
// Names are immutable once bound. Rebinding within the same scope
// is a runtime error. Lookups walk outward through enclosing scopes.

import { PunkRuntimeError } from './errors.js';

export class Env {
  constructor(parent = null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  bind(name, value, node) {
    if (this.bindings.has(name)) {
      throw new PunkRuntimeError(
        `name '${name}' is already bound in this scope`,
        node?.line, node?.col,
      );
    }
    this.bindings.set(name, value);
  }

  lookup(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.lookup(name);
    return undefined;
  }

  has(name) {
    if (this.bindings.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  child() {
    return new Env(this);
  }
}
