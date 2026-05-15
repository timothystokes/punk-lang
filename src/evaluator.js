class Evaluator {
    constructor() {
        this.scopes = [new Map()];
        this.setupBuiltins();
    }

    setupBuiltins() {
        // Pattern-builder helpers. These produce the same AST shape the parser
        // produces for `(_ _)`, `(*)`, `(a:_ b:_)` etc., so built-ins dispatch
        // through the very same matchPattern + binding machinery as user
        // functions, and report mismatches with the same Punk-shaped error.
        const P = {
            wild: () => ({ type: 'Wildcard' }),
            star: () => ({ type: 'StarWildcard' }),
            named: (name, value) => ({ type: 'NamedThing', name, value }),
            thing: (value) => ({ type: 'Thing', value }),
            num: (value) => ({ type: 'Number', value }),
            pat: (...elements) => ({ type: 'Pattern', elements }),
        };

        // Wrap a JS implementation with a Punk pattern. Returns an object the
        // runtime treats as a BuiltinFunction; callFunction does the matchPattern
        // step itself so dispatch and error reporting are uniform with user fns.
        const builtin = (qualifiedName, pattern, impl) => ({
            type: 'BuiltinFunction',
            name: qualifiedName,
            pattern,
            impl,
        });

        const math = {
            add: builtin('add', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') + b.get('b')),
            sub: builtin('sub', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') - b.get('b')),
            mul: builtin('mul', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') * b.get('b')),
            div: builtin('div', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') / b.get('b')),
            pow: builtin('pow', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => Math.pow(b.get('a'), b.get('b'))),
            mod: builtin('mod', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') % b.get('b')),
            sqrt: builtin('sqrt', P.pat(P.wild()),
                (b) => Math.sqrt(b.get('0'))),
            isnum: builtin('isnum', P.pat(P.wild()),
                (b) => typeof b.get('0') === 'number' && !isNaN(b.get('0'))),
            // Variadic: `(*)` matches any number of Things.
            min: builtin('min', P.pat(P.star()),
                (b, arg) => this.reduceNumeric('min', arg, Math.min)),
            max: builtin('max', P.pat(P.star()),
                (b, arg) => this.reduceNumeric('max', arg, Math.max)),
        };

        const truthy = v => v !== null && v !== false;
        const logic = {
            gt: builtin('gt', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') > b.get('b')),
            lt: builtin('lt', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => b.get('a') < b.get('b')),
            eq: builtin('eq', P.pat(P.named('a', P.wild()), P.named('b', P.wild())),
                (b) => this.deepEqual(b.get('a'), b.get('b'))),
            // Truthy semantics across `not`/`and`/`or`: NULL and FALSE are
            // falsy; every other Punk Thing (including 0, the empty list,
            // and arbitrary atoms) is truthy.
            // Takes any single Thing (including an empty list). Using `(*)`
            // and reading `arg` directly avoids `(_)`'s "exactly-one-element"
            // interpretation when the input is itself a list.
            not: builtin('not', P.pat(P.star()),
                (b, arg) => !truthy(arg)),
            // Variadic: any number of Things; empty list returns the identity
            // (TRUE for `and`, FALSE for `or`).
            and: builtin('and', P.pat(P.star()),
                (b, arg) => (Array.isArray(arg) ? arg : [arg]).every(truthy)),
            or: builtin('or', P.pat(P.star()),
                (b, arg) => (Array.isArray(arg) ? arg : [arg]).some(truthy)),
        };

        const stringOps = {
            upper: builtin('upper', P.pat(P.wild()),
                (b) => String(b.get('0')).toUpperCase()),
            lower: builtin('lower', P.pat(P.wild()),
                (b) => String(b.get('0')).toLowerCase()),
            trim: builtin('trim', P.pat(P.wild()),
                (b) => String(b.get('0')).trim()),
            // split: with a delimiter, splits a text Thing at each delimiter.
            // With a single Thing and no delimiter, decomposes it into a List
            // of single-character Things — the bridge that lets list.* handle
            // "string" tasks (length, first/last, slice, contains, ...).
            split: builtin('split', P.pat(P.star()),
                (b, arg) => {
                    if (Array.isArray(arg)) {
                        if (arg.length === 1) return Array.from(String(arg[0]));
                        if (arg.length === 2) return String(arg[0]).split(String(arg[1]));
                        throw this.punkError('split expects one Thing or [text delim]');
                    }
                    return Array.from(String(arg));
                }),
            // join: inverse of split. With a List and a delimiter, concatenates
            // the elements with the delimiter between them. With just a List,
            // concatenates with nothing between (so `join!split!hello.` round-trips).
            join: builtin('join', P.pat(P.star()),
                (b, arg) => {
                    if (Array.isArray(arg) && arg.length === 2 && Array.isArray(arg[0])) {
                        return arg[0].map(x => String(x)).join(String(arg[1]));
                    }
                    const list = Array.isArray(arg) && arg.length === 1 ? arg[0] : arg;
                    if (!Array.isArray(list)) throw this.punkError('join expects a List');
                    return list.map(x => String(x)).join('');
                }),
            replace: builtin('replace', P.pat(P.named('text', P.wild()), P.named('search', P.wild()), P.named('with', P.wild())),
                (b) => String(b.get('text')).split(String(b.get('search'))).join(String(b.get('with')))),
        };

        const listOps = {
            map: builtin('map', P.pat(P.named('list', P.wild()), P.named('fn', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('map expects a List as the first Thing');
                    return list.map(item => this.callFunction(b.get('fn'), item));
                }),
            filter: builtin('filter', P.pat(P.named('list', P.wild()), P.named('fn', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('filter expects a List as the first Thing');
                    return list.filter(item => this.callFunction(b.get('fn'), item));
                }),
            reduce: builtin('reduce', P.pat(P.named('list', P.wild()), P.named('fn', P.wild()), P.named('init', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('reduce expects a List as the first Thing');
                    return list.reduce((acc, item) => this.callFunction(b.get('fn'), [acc, item]), b.get('init'));
                }),
            flatMap: builtin('flatMap', P.pat(P.named('list', P.wild()), P.named('fn', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('flatMap expects a List as the first Thing');
                    return list.flatMap(item => {
                        const r = this.callFunction(b.get('fn'), item);
                        return Array.isArray(r) ? r : [r];
                    });
                }),
            len: builtin('len', P.pat(P.wild()),
                (b) => {
                    const list = b.get('0');
                    return Array.isArray(list) ? list.length : 1;
                }),
            // Lisp spine: head/tail/prepend. Empty-list head returns NULL,
            // empty-list tail returns []. Together with `list.concat!` these
            // are enough to express any recursive list algorithm.
            head: builtin('head', P.pat(P.wild()),
                (b) => {
                    const list = b.get('0');
                    if (!Array.isArray(list)) return list;
                    return list.length === 0 ? null : list[0];
                }),
            tail: builtin('tail', P.pat(P.wild()),
                (b) => {
                    const list = b.get('0');
                    if (!Array.isArray(list)) return [];
                    return list.slice(1);
                }),
            prepend: builtin('prepend', P.pat(P.named('item', P.wild()), P.named('list', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('prepend expects a List as the second Thing');
                    return [b.get('item'), ...list];
                }),
            concat: builtin('concat', P.pat(P.star()),
                (b, arg) => {
                    const lists = Array.isArray(arg) ? arg : [arg];
                    return lists.flat();
                }),
            range: builtin('range', P.pat(P.named('start', P.wild()), P.named('end', P.wild()), P.named('step', P.wild())),
                (b) => {
                    const start = b.get('start'), end = b.get('end'), step = b.get('step');
                    const result = [];
                    if (step > 0) for (let i = start; i < end; i += step) result.push(i);
                    else if (step < 0) for (let i = start; i > end; i += step) result.push(i);
                    return result;
                }),
            slice: builtin('slice', P.pat(P.named('list', P.wild()), P.named('start', P.wild()), P.named('end', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('slice expects a List as the first Thing');
                    return list.slice(b.get('start'), b.get('end'));
                }),
            find: builtin('find', P.pat(P.named('list', P.wild()), P.named('value', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('find expects a List as the first Thing');
                    const i = list.findIndex(item => this.deepEqual(item, b.get('value')));
                    return i >= 0 ? i : null;
                }),
            contains: builtin('contains', P.pat(P.named('list', P.wild()), P.named('value', P.wild())),
                (b) => {
                    const list = b.get('list');
                    if (!Array.isArray(list)) throw this.punkError('contains expects a List as the first Thing');
                    return list.some(item => this.deepEqual(item, b.get('value')));
                }),
            sort: builtin('sort', P.pat(P.wild()),
                (b) => {
                    const list = b.get('0');
                    if (!Array.isArray(list)) throw this.punkError('sort expects a List');
                    return [...list].sort((a, c) => {
                        if (typeof a === 'string' && typeof c === 'string') return a.localeCompare(c);
                        if (typeof a === 'number' && typeof c === 'number') return a - c;
                        return String(a).localeCompare(String(c));
                    });
                }),
        };

        const fs = require('fs');

        const fileOps = {
            read: builtin('read', P.pat(P.wild()),
                (b) => {
                    try {
                        return fs.readFileSync(String(b.get('0')), 'utf8').split('\n');
                    } catch (err) {
                        throw this.punkError(`Cannot read file: ${err.message}`);
                    }
                }),
            write: builtin('write', P.pat(P.named('path', P.wild()), P.named('content', P.wild())),
                (b) => {
                    try {
                        const content = b.get('content');
                        const text = Array.isArray(content) ? content.join('\n') : String(content);
                        fs.writeFileSync(String(b.get('path')), text, 'utf8');
                        return undefined;
                    } catch (err) {
                        throw this.punkError(`Cannot write file: ${err.message}`);
                    }
                }),
        };

        const log = builtin('log', P.pat(P.star()), (b, arg) => {
            if (Array.isArray(arg)) console.log(...arg.map(x => this.formatValue(x)));
            else console.log(this.formatValue(arg));
            return undefined;
        });

        // Self-checking assertion. Silent on pass so a passing test file
        // produces no output of its own; on failure throws a Punk-shaped error
        // with both values rendered the way Punk itself would print them.
        const assertFn = builtin(
            'assert',
            P.pat(P.named('actual', P.wild()), P.named('expected', P.wild())),
            (b) => {
                const actual = b.get('actual');
                const expected = b.get('expected');
                if (this.deepEqual(actual, expected)) return undefined;
                throw this.punkError(
                    `assert failed: expected ${this.formatValue(expected)} got ${this.formatValue(actual)}`
                );
            }
        );

        this.setName('add', math.add);
        this.setName('sub', math.sub);
        this.setName('mul', math.mul);
        this.setName('div', math.div);
        this.setName('pow', math.pow);
        this.setName('mod', math.mod);
        this.setName('sqrt', math.sqrt);
        this.setName('isnum', math.isnum);
        this.setName('min', math.min);
        this.setName('max', math.max);
        this.setName('gt', logic.gt);
        this.setName('lt', logic.lt);
        this.setName('eq', logic.eq);
        this.setName('not', logic.not);
        this.setName('and', logic.and);
        this.setName('or', logic.or);
        this.setName('upper', stringOps.upper);
        this.setName('lower', stringOps.lower);
        this.setName('trim', stringOps.trim);
        this.setName('split', stringOps.split);
        this.setName('join', stringOps.join);
        this.setName('replace', stringOps.replace);
        this.setName('map', listOps.map);
        this.setName('filter', listOps.filter);
        this.setName('reduce', listOps.reduce);
        this.setName('flatMap', listOps.flatMap);
        this.setName('len', listOps.len);
        this.setName('head', listOps.head);
        this.setName('tail', listOps.tail);
        this.setName('prepend', listOps.prepend);
        this.setName('concat', listOps.concat);
        this.setName('range', listOps.range);
        this.setName('slice', listOps.slice);
        this.setName('find', listOps.find);
        this.setName('contains', listOps.contains);
        this.setName('sort', listOps.sort);
        this.setName('read', fileOps.read);
        this.setName('write', fileOps.write);
        this.setName('log', log);
        this.setName('assert', assertFn);
    }

    // Render a Punk value back into Punk-ish source for error messages so
    // assertion failures read in the same vocabulary as the rest of the
    // language (lists in brackets, NULL/TRUE/FALSE keywords, etc.).
    formatValue(v) {
        if (v === null) return 'NULL';
        if (v === true) return 'TRUE';
        if (v === false) return 'FALSE';
        if (v === undefined) return '<nothing>';
        if (Array.isArray(v)) return '[' + v.map(x => this.formatValue(x)).join(' ') + ']';
        if (typeof v === 'string') {
            // Render text Things so the output is valid Punk source again:
            // a literal `+` in the value must be escaped as `\+`, and a
            // literal space inside the Thing is shown as `+`. Without this,
            // a single Thing containing a space would re-parse as two Things.
            return v.replace(/\\/g, '\\\\').replace(/\+/g, '\\+').replace(/ /g, '+');
        }
        if (v && typeof v === 'object') {
            if (v.type === 'Cell') return '{' + this.formatValue(v.contents) + '}';
            if (v.type === 'UserFunction' || v.type === 'FunctionLiteral') return '<function>';
            if (v.type === 'BuiltinFunction') return '<builtin>';
            if (v.type === 'Pattern') return '<pattern>';
        }
        return String(v);
    }

    reduceNumeric(name, arg, op) {
        const list = Array.isArray(arg) ? arg : [arg];
        if (list.length === 0) throw this.punkError(`${name} requires at least one Thing`);
        return op(...list);
    }

    // Throw an error in the same shape Punk uses for runtime issues. Kept in
    // one place so any future error-channel changes (line info, types, etc.)
    // happen uniformly across native and built-in code paths.
    punkError(message) {
        return new Error(message);
    }

    setName(name, value) {
        this.scopes[this.scopes.length - 1].set(name, value);
    }

    getName(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        return undefined;
    }

    withScope(bindings, fn) {
        const scope = new Map();
        for (const [k, v] of bindings.entries()) {
            scope.set(k, v);
        }
        this.scopes.push(scope);
        try {
            return fn();
        } finally {
            this.scopes.pop();
        }
    }

    evaluate(node) {
        switch (node.type) {
            case 'Program':
                return this.evaluateProgram(node);
            case 'NamedThing':
                return this.evaluateNamedThing(node);
            case 'List':
                return this.evaluateList(node);
            case 'Pattern':
                return this.evaluatePattern(node);
            case 'Conditional':
                return this.evaluateConditional(node);
            case 'Predicate':
                return this.evaluatePredicate(node);
            case 'MultiplePatternMatch':
                return this.evaluateMultiplePatternMatch(node);
            case 'FunctionCall':
                return this.evaluateFunctionCall(node);
            case 'FunctionDef':
                return this.evaluateFunctionDef(node);
            case 'FunctionLiteral':
                return this.evaluateFunctionLiteral(node);
            case 'Dereference':
                return this.evaluateDereference(node);
            case 'CellLiteral':
                return { type: 'Cell', contents: this.evaluate(node.value) };
            case 'CellRead': {
                const cell = this.evaluate(node.target);
                if (!cell || typeof cell !== 'object' || cell.type !== 'Cell') {
                    throw new Error("Cell read '>' used on a non-Cell Thing");
                }
                return cell.contents;
            }
            case 'CellWrite': {
                const cell = this.evaluate(node.target);
                if (!cell || typeof cell !== 'object' || cell.type !== 'Cell') {
                    throw new Error("Cell write '<' used on a non-Cell Thing");
                }
                cell.contents = this.evaluate(node.value);
                return cell.contents;
            }
            case 'Number':
                return node.value;
            case 'Thing':
                if (node.value === 'TRUE') return true;
                if (node.value === 'FALSE') return false;
                if (node.value === 'NULL') return null;
                return node.value;
            case 'Param':
                return this.getName('.');
            case 'Wildcard':
                return node;
            case 'StarWildcard':
                return node;
            default:
                throw new Error(`Unknown Punk expression: ${node.type}`);
        }
    }

    evaluateProgram(node) {
        let result;
        for (const statement of node.statements) {
            result = this.evaluate(statement);
        }
        return result;
    }

    evaluateNamedThing(node) {
        const value = this.evaluate(node.value);
        this.setName(node.name, value);
        return value;
    }

    evaluateFunctionDef(node) {
        const fn = {
            type: 'UserFunction',
            pattern: node.pattern,
            body: node.body,
            closure: this.captureClosure()
        };
        this.setName(node.name, fn);
        return fn;
    }

    evaluateFunctionLiteral(node) {
        return {
            type: 'UserFunction',
            pattern: node.pattern,
            body: node.body,
            closure: this.captureClosure()
        };
    }

    captureClosure() {
        // Share frame references with the surrounding scope chain so closures
        // see live bindings — including cells — created in their lexical parents.
        return this.scopes.slice();
    }

    // A bare [ ] in source is DATA. Atoms self-evaluate; active forms
    // (function calls, dereferences, conditionals, pattern matches) are
    // preserved as quoted AST so they don't fire until something applies `!`.
    evaluateList(node) {
        return node.elements.map(element => this.elementAsData(element));
    }

    elementAsData(element) {
        switch (element.type) {
            case 'Number':
                return element.value;
            case 'Thing':
                if (element.value === 'TRUE') return true;
                if (element.value === 'FALSE') return false;
                if (element.value === 'NULL') return null;
                return element.value;
            case 'List':
                return this.evaluateList(element);
            case 'NamedThing':
                return { name: element.name, value: this.elementAsData(element.value) };
            case 'Pattern':
                return this.evaluatePattern(element);
            case 'FunctionLiteral':
                return this.evaluateFunctionLiteral(element);
            case 'CellLiteral':
                return { type: 'Cell', contents: this.elementAsData(element.value) };
            default:
                // FunctionCall, Dereference, Conditional, MultiplePatternMatch, ...
                // remain unevaluated forms until a `!` evaluates the containing list.
                return { type: 'Quoted', form: element };
        }
    }

    // A list evaluated AS CODE: triggered by `!` (function body, function arg list,
    // conditional/multi-pattern branch). Each element is evaluated through the normal
    // dispatcher. NamedThing elements additionally bind their name into the current
    // scope, matching top-level program statement semantics.
    evaluateListAsCode(node) {
        const results = [];
        for (const element of node.elements) {
            if (element.type === 'NamedThing') {
                const value = this.evaluate(element.value);
                this.setName(element.name, value);
                results.push({ name: element.name, value });
            } else {
                results.push(this.evaluate(element));
            }
        }
        return results;
    }

    // Evaluate a list-as-block: each element runs in order. Punk follows the
    // Clojure-style rule that a body's value is the value of its **last**
    // expression. Earlier expressions are evaluated for their side effects
    // (and for binding NamedThings into scope). An empty body has no value
    // and yields `null`.
    evaluateBody(node) {
        const elements = node.elements;
        if (elements.length === 0) return null;
        for (let i = 0; i < elements.length - 1; i++) {
            const element = elements[i];
            if (element.type === 'NamedThing') {
                const value = this.evaluate(element.value);
                this.setName(element.name, value);
            } else {
                this.evaluate(element);
            }
        }
        // Last element runs in tail position so direct self-calls trampoline
        // instead of growing the JS stack.
        const last = elements[elements.length - 1];
        if (last.type === 'NamedThing') {
            const value = this.evaluate(last.value);
            this.setName(last.name, value);
            return value;
        }
        return this.evaluateTail(last);
    }

    // Tail-position evaluator: same as `evaluate`, but FunctionCall to a
    // UserFunction returns a `{__tc, fn, arg}` sentinel that the trampoline
    // in `callFunction` resolves iteratively. Conditional/MultiplePatternMatch
    // propagate tail position into their chosen branch.
    evaluateTail(node) {
        if (!node || typeof node !== 'object') return this.evaluate(node);
        switch (node.type) {
            case 'Conditional': {
                const value = this.evaluate(node.value);
                const pattern = this.evaluate(node.pattern);
                const bindings = this.matchPattern(value, pattern);
                if (bindings) {
                    return this.withScope(bindings, () => this.evaluateTail(node.thenExpr));
                }
                return null;
            }
            case 'MultiplePatternMatch': {
                const value = this.evaluate(node.value);
                for (const { pattern, expression } of node.cases) {
                    const evaluatedPattern = this.evaluate(pattern);
                    const bindings = this.matchPattern(value, evaluatedPattern);
                    if (bindings) {
                        if (expression === null) return null;
                        return this.withScope(bindings, () => this.evaluateTail(expression));
                    }
                }
                return null;
            }
            case 'FunctionCall': {
                const callee = this.evaluate(node.callee);
                let arg;
                if (node.arg === null || node.arg === undefined) {
                    arg = null;
                } else if (node.arg.type === 'List') {
                    arg = this.evaluateListAsCode(node.arg);
                } else {
                    arg = this.evaluate(node.arg);
                }
                if (callee && callee.type === 'UserFunction') {
                    return { __tc: true, fn: callee, arg };
                }
                return this.callFunction(callee, arg);
            }
            default:
                return this.evaluate(node);
        }
    }

    evaluatePattern(node) {
        return {
            type: 'Pattern',
            elements: node.elements.map(element => this.evaluatePatternElement(element))
        };
    }

    evaluatePatternElement(element) {
        if (element.type === 'NamedThing') {
            return { type: 'NamedThing', name: element.name, value: this.evaluatePatternElement(element.value) };
        }
        if (element.type === 'Pattern') return this.evaluatePattern(element);
        if (element.type === 'Wildcard' || element.type === 'StarWildcard') return element;
        return this.evaluate(element);
    }

    evaluatePredicate(node) {
        const value = this.evaluate(node.value);
        const pattern = this.evaluate(node.pattern);
        return this.matchPattern(value, pattern) !== null;
    }

    evaluateConditional(node) {
        const value = this.evaluate(node.value);
        const pattern = this.evaluate(node.pattern);
        const bindings = this.matchPattern(value, pattern);
        if (bindings) {
            return this.withScope(bindings, () => this.evaluate(node.thenExpr));
        }
        return null;
    }

    evaluateMultiplePatternMatch(node) {
        const value = this.evaluate(node.value);
        for (const { pattern, expression } of node.cases) {
            const evaluatedPattern = this.evaluate(pattern);
            const bindings = this.matchPattern(value, evaluatedPattern);
            if (bindings) {
                if (expression === null) return null;
                return this.withScope(bindings, () => this.evaluate(expression));
            }
        }
        return null;
    }

    evaluateFunctionCall(node) {
        const callee = this.evaluate(node.callee);
        // `!` evaluates its argument as code: a List arg has each element evaluated
        // (with name binding for NamedThings); a single non-list form is evaluated normally.
        // A null arg means a zero-arg call (e.g. `.code!` where code is a list value).
        let arg;
        if (node.arg === null || node.arg === undefined) {
            arg = null;
        } else if (node.arg.type === 'List') {
            arg = this.evaluateListAsCode(node.arg);
        } else {
            arg = this.evaluate(node.arg);
        }
        return this.callFunction(callee, arg);
    }

    callFunction(fn, arg) {
        if (fn === null || fn === undefined) throw new Error('Undefined function Thing');
        // A list value is a zero-parameter body: applying `!` evaluates its elements
        // as code in the current scope. This is the homoiconic "eval" path —
        // `[forms]!` and `.code!` (where code is bound to a list) go through here.
        if (Array.isArray(fn)) {
            return this.withScope(arg === null ? new Map() : new Map([['.', arg]]), () => {
                return this.evaluateListValueAsCode(fn);
            });
        }
        if (fn && fn.type === 'BuiltinFunction') {
            const bindings = this.matchPattern(arg, fn.pattern);
            if (!bindings) {
                throw new Error(`${fn.name} expects ${this.formatPattern(fn.pattern)}`);
            }
            return fn.impl(bindings, arg);
        }
        if (fn.type === 'UserFunction') {
            // Trampoline: tail-position self/mutual calls bubble up as
            // {__tc, fn, arg} sentinels (see evaluateTail) so we re-enter
            // here without growing the JS stack.
            const savedScopes = this.scopes;
            try {
                while (true) {
                    const bindings = this.matchPattern(arg, this.evaluatePattern(fn.pattern));
                    if (!bindings) {
                        throw new Error(`Input Thing does not match pattern ${this.formatPattern(this.evaluatePattern(fn.pattern))}`);
                    }
                    bindings.set('.', arg);
                    bindings.set('*', Array.isArray(arg) ? arg : [arg]);
                    this.scopes = fn.closure.slice();
                    const result = this.withScope(bindings, () => {
                        return this.evaluateBody(fn.body);
                    });
                    if (result && typeof result === 'object' && result.__tc) {
                        fn = result.fn;
                        arg = result.arg;
                        continue;
                    }
                    return result;
                }
            } finally {
                this.scopes = savedScopes;
            }
        }
        if (typeof fn === 'function') {
            return fn(arg);
        }
        throw new Error('Target is not a function Thing');
    }

    // Render a Pattern AST back to Punk source form for error messages so
    // failures speak the language the user wrote, not JavaScript-isms.
    formatPattern(pattern) {
        const fmtElement = (el) => {
            if (!el) return '';
            switch (el.type) {
                case 'Wildcard': return '_';
                case 'StarWildcard': return '*';
                case 'NamedThing': return `${el.name}:${fmtElement(el.value)}`;
                case 'Pattern': return `(${el.elements.map(fmtElement).join(' ')})`;
                case 'Thing': return String(el.value);
                case 'Number': return String(el.value);
                default: return String(el.value !== undefined ? el.value : el.type);
            }
        };
        return fmtElement(pattern);
    }

    // Evaluate a runtime list VALUE (not an AST node) as a block of code: each
    // element runs in order. The block's value is the value of its **last**
    // element (Clojure-style). Powers `!` applied to list values.
    evaluateListValueAsCode(arr) {
        let last = null;
        for (const el of arr) {
            last = this.evaluateValueAsCode(el);
        }
        return last;
    }

    evaluateValueAsCode(v) {
        if (v && typeof v === 'object' && !Array.isArray(v) && v.type === 'Quoted') {
            return this.evaluate(v.form);
        }
        if (v && typeof v === 'object' && !Array.isArray(v)
            && v.name !== undefined && 'value' in v && v.type !== 'UserFunction') {
            const value = this.evaluateValueAsCode(v.value);
            this.setName(v.name, value);
            return { name: v.name, value };
        }
        return v;
    }

    evaluateDereference(node) {
        if (node.object) {
            let obj = this.evaluate(node.object);
            
            // If obj is a simple Thing value (string), try to resolve it as a name first
            if (typeof obj === 'string') {
                const namedValue = this.getName(obj);
                if (namedValue !== undefined) {
                    obj = namedValue;
                }
            }
            
            if (obj && typeof obj === 'object' && obj.type === 'Pattern') {
                return obj;
            }
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                if (obj instanceof Map) {
                    if (obj.has(node.name)) return obj.get(node.name);
                }
                if (Object.prototype.hasOwnProperty.call(obj, node.name)) {
                    return obj[node.name];
                }
            }
            if (Array.isArray(obj)) {
                // Handle ~ for last item
                if (node.name === '~') {
                    return obj[obj.length - 1];
                }
                // Handle array indexing
                if (/^\d+$/.test(node.name)) {
                    return obj[parseInt(node.name)];
                }
                // Handle named access (return last matching item)
                for (let i = obj.length - 1; i >= 0; i--) {
                    const item = obj[i];
                    if (item && typeof item === 'object' && item.name === node.name) {
                        return item.value;
                    }
                }
                throw new Error(`No Named Thing found with name: ${node.name}`);
            }
            
            // Treat single Thing as a list of one Thing when accessed by index
            if (/^\d+$/.test(node.name)) {
                const index = parseInt(node.name);
                if (index === 0) {
                    return obj;
                }
                return undefined; // Out of bounds for single Thing
            }
            
            // Handle ~ for single Thing (it is the only item)
            if (node.name === '~') {
                return obj;
            }
            
            if (typeof obj === 'object' && obj.name !== undefined) {
                // Handle named thing objects
                if (obj.name === node.name) {
                    return obj.value;
                }
            }
            throw new Error('Cannot dereference non-list Thing');
        }

        const value = this.getName(node.name);
        if (value === undefined) {
            throw new Error(`Undefined Named Thing: ${node.name}`);
        }
        return value;
    }

    matchPattern(value, pattern) {
        const bindings = new Map();
        const matched = this.matchPatternInternal(value, pattern, bindings);
        if (matched) {
            if (!bindings.has('.')) bindings.set('.', value);
            // Bind numeric indices for list access
            if (Array.isArray(value)) {
                this.bindListIndexes(value, bindings);
            } else {
                // Treat single Thing as list of one - bind index 0
                bindings.set('0', value);
            }
            return bindings;
        }
        return null;
    }

    matchPatternInternal(value, pattern, bindings) {
        if (pattern && pattern.type === 'Pattern') {
            if (!Array.isArray(value)) {
                if (pattern.elements.length === 1) {
                    return this.matchPatternInternal(value, pattern.elements[0], bindings);
                }
                return false;
            }
            return this.matchListPattern(value, pattern.elements, bindings);
        }
        if (pattern && pattern.type === 'Wildcard') {
            return true;
        }
        if (pattern && pattern.type === 'StarWildcard') {
            return true;
        }
        if (pattern && pattern.type === 'NamedThing') {
            if (value && typeof value === 'object' && value.name !== undefined && value.value !== undefined) {
                if (value.name !== pattern.name) return false;
                if (!this.matchPatternInternal(value.value, pattern.value, bindings)) return false;
                bindings.set(pattern.name, value.value);
                return true;
            }
            if (this.matchPatternInternal(value, pattern.value, bindings)) {
                bindings.set(pattern.name, value);
                return true;
            }
            return false;
        }
        if (pattern && pattern.type === 'Dereference') {
            const patternValue = this.evaluateDereference(pattern);
            if (patternValue && typeof patternValue === 'object' && patternValue.type === 'Pattern') {
                return this.matchPatternInternal(value, patternValue, bindings);
            }
            return value === patternValue;
        }
        if (pattern && pattern.type === 'Thing') {
            return value === pattern.value;
        }
        return value === pattern;
    }

    matchListPattern(values, patterns, bindings) {
        const isStar = p => p && (p.type === 'StarWildcard' || (p.type === 'NamedThing' && p.value && p.value.type === 'StarWildcard'));
        const starIndex = patterns.findIndex(isStar);
        if (starIndex === -1) {
            if (values.length !== patterns.length) return false;
            for (let i = 0; i < patterns.length; i++) {
                if (!this.matchPatternInternal(values[i], patterns[i], bindings)) return false;
            }
            this.bindListIndexes(values, bindings);
            return true;
        }

        const before = patterns.slice(0, starIndex);
        const after = patterns.slice(starIndex + 1);

        if (values.length < before.length + after.length) return false;

        for (let i = 0; i < before.length; i++) {
            if (!this.matchPatternInternal(values[i], before[i], bindings)) return false;
        }

        const offset = values.length - after.length;
        for (let i = 0; i < after.length; i++) {
            if (!this.matchPatternInternal(values[offset + i], after[i], bindings)) return false;
        }

        const starPattern = patterns[starIndex];
        if (starPattern.type === 'NamedThing') {
            bindings.set(starPattern.name, values.slice(before.length, offset));
        }

        this.bindListIndexes(values, bindings);
        return true;
    }

    bindListIndexes(values, bindings) {
        for (let i = 0; i < values.length; i++) {
            const key = String(i);
            if (!bindings.has(key)) bindings.set(key, values[i]);
        }
    }

    deepEqual(a, b) {
        // Handle identical references or primitive equality
        if (a === b) return true;
        
        // Handle null/undefined
        if (a == null || b == null) return false;
        
        // Handle boolean literals
        if (a === true || a === false || b === true || b === false) {
            return a === b;
        }
        
        // Handle arrays
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        
        // Handle objects (including named things)
        if (typeof a === 'object' && typeof b === 'object') {
            // Handle named things
            if (a.name !== undefined && b.name !== undefined) {
                return a.name === b.name && this.deepEqual(a.value, b.value);
            }
            
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            return true;
        }
        
        // Default to strict equality
        return false;
    }
}

module.exports = { Evaluator }; 