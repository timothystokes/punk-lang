// Bridge between Punk values and JavaScript.
//
// Design goals:
// - Pure data round-trips by value: Punk lists ↔ JS arrays, NamedThing
//   lists ↔ plain JS objects, primitives pass through.
// - Functions round-trip: a JS function called from Punk gets its args
//   marshalled in and its result marshalled out; a Punk function passed
//   to JS gets re-entered via callFunction.
// - Opaque JS objects (class instances, streams, db connections, etc.)
//   are wrapped as a `JSObject` — a Punk value that supports postfix
//   dereference (`obj.key.`) and call (`obj.method!args`) but the
//   *contents* the user sees after a call are plain Punk values. So
//   even though the underlying handle is reference-y, every value that
//   crosses the boundary is by-value.
//
// All conversions are lazy/shallow where it matters so we don't try to
// deep-freeze enormous Node objects.

const JS_OBJECT = Symbol('JSObject');

function isPlainObject(v) {
    if (v === null || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function isNamedThingList(v) {
    if (!Array.isArray(v)) return false;
    if (v.length === 0) return false;
    return v.every(item =>
        item && typeof item === 'object' && item.type === 'NamedThing'
    );
}

// Convert a Punk value into a shape Node/JS APIs expect. Pure data
// becomes pure data; Punk functions become JS callbacks.
function toJS(value, evaluator) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        // Mixed lists go to arrays; lists of only NamedThings go to a
        // plain JS object. This matches the dominant Punk convention
        // where a "record" is a list of `name:value` slots.
        if (isNamedThingList(value)) {
            const obj = {};
            for (const item of value) {
                obj[item.name] = toJS(item.value, evaluator);
            }
            return obj;
        }
        return value.map(v => toJS(v, evaluator));
    }
    if (value && typeof value === 'object') {
        if (value[JS_OBJECT]) return value[JS_OBJECT];
        if (value.type === 'NamedThing') {
            // A single NamedThing not embedded in a list converts to
            // a one-key object; rarely useful but consistent.
            return { [value.name]: toJS(value.value, evaluator) };
        }
        if (value.type === 'Cell') return toJS(value.contents, evaluator);
        if (value.type === 'UserFunction' || value.type === 'BuiltinFunction'
            || value.type === 'Partial' || value.type === 'FunctionLiteral') {
            // Punk fn → JS fn. JS callers may pass any number of args;
            // we collect them into a list (multiple) or pass a single
            // value (one), matching Punk's calling convention.
            return function (...jsArgs) {
                const punkArgs = jsArgs.map(a => fromJS(a, evaluator));
                const arg = punkArgs.length === 0 ? null
                    : (punkArgs.length === 1 ? punkArgs[0] : punkArgs);
                const result = evaluator.callFunction(value, arg);
                return toJS(result, evaluator);
            };
        }
        if (value.type === 'Range') {
            return toJS(evaluator.materialiseRange(value), evaluator);
        }
    }
    return value;
}

// Convert a JS value into Punk shape.
function fromJS(value, evaluator) {
    if (value === null || value === undefined) return value === undefined ? null : null;
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'function') {
        return wrapJSFunction(value, evaluator);
    }
    if (Array.isArray(value)) {
        return value.map(v => fromJS(v, evaluator));
    }
    if (typeof value === 'object') {
        // Buffers, Dates, etc. — keep them as opaque JS objects so the
        // caller can still use their methods if needed.
        if (Buffer.isBuffer && Buffer.isBuffer(value)) {
            return wrapJSObject(value, evaluator);
        }
        if (isPlainObject(value)) {
            // Plain JS object → list of NamedThings (Punk record).
            // Use getOwnPropertyNames so non-enumerable methods on
            // built-in namespaces (JSON.stringify, Math.sqrt, …) are
            // visible. If the result is empty, prefer the JSObject
            // wrapper so the caller can still reach methods that live
            // higher up the prototype chain.
            const keys = Object.getOwnPropertyNames(value);
            if (keys.length === 0) return wrapJSObject(value, evaluator);
            const items = [];
            for (const key of keys) {
                items.push({
                    type: 'NamedThing',
                    name: key,
                    value: fromJS(value[key], evaluator),
                });
            }
            return items;
        }
        // Class instance, stream, db handle — wrap.
        return wrapJSObject(value, evaluator);
    }
    return value;
}

// Wrap an opaque JS object as a Punk-visible namespace whose entries
// are looked up lazily on the underlying JS object. Calls to method
// entries marshal args in and results out, so values crossing the
// boundary remain by-value.
function wrapJSObject(obj, evaluator) {
    // Build a Punk-shaped list-of-NamedThings on demand; the parser
    // doesn't actually walk the list during dereference (it goes
    // through evaluateDereference which can spot the special key).
    // Cheapest approach: stamp a "synthetic record" that the dereference
    // path knows how to query.
    const proxy = {
        type: 'JSObject',
        target: obj,
        evaluator,
        [JS_OBJECT]: obj,
    };
    return proxy;
}

function wrapJSFunction(fn, evaluator) {
    return {
        type: 'BuiltinFunction',
        name: fn.name || '<js-fn>',
        pattern: { type: 'Pattern', elements: [{ type: 'StarWildcard' }] },
        impl: (bindings, arg) => {
            // Spread positional lists to JS args; a NamedThing list
            // (a Punk "record") is a single JS object arg.
            let argsArr;
            if (arg == null) argsArr = [];
            else if (Array.isArray(arg) && !isNamedThingList(arg)) argsArr = arg;
            else argsArr = [arg];
            const jsArgs = argsArr.map(a => toJS(a, evaluator));
            const result = fn.apply(undefined, jsArgs);
            return fromJS(result, evaluator);
        },
    };
}

// Look up a key on a JSObject wrapper. Returns a Punk-marshalled value.
// Method values are returned as bound BuiltinFunctions so calling them
// preserves `this`.
function jsObjectGet(wrapper, key, evaluator) {
    const obj = wrapper.target;
    if (obj == null) return null;
    const v = obj[key];
    if (typeof v === 'function') {
        // Bind to keep `this` (Node's req/res, db Statement, etc.).
        const bound = v.bind(obj);
        bound.displayName = key;
        return wrapJSFunction(bound, evaluator);
    }
    return fromJS(v, evaluator);
}

module.exports = {
    toJS,
    fromJS,
    wrapJSObject,
    wrapJSFunction,
    jsObjectGet,
    isNamedThingList,
    JS_OBJECT,
};
