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
                        throw this.punkError('split expects one Thing or (text delim)');
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
                    const { items, rewrap } = this.decompose(b.get('list'));
                    return rewrap(items.map(item => this.callFunction(b.get('fn'), item)));
                }),
            filter: builtin('filter', P.pat(P.named('list', P.wild()), P.named('fn', P.wild())),
                (b) => {
                    const { items, rewrap } = this.decompose(b.get('list'));
                    return rewrap(items.filter(item => this.callFunction(b.get('fn'), item)));
                }),
            reduce: builtin('reduce', P.pat(P.named('list', P.wild()), P.named('fn', P.wild()), P.named('init', P.wild())),
                (b) => {
                    const { items } = this.decompose(b.get('list'));
                    return items.reduce((acc, item) => this.callFunction(b.get('fn'), [acc, item]), b.get('init'));
                }),
            flatMap: builtin('flatMap', P.pat(P.named('list', P.wild()), P.named('fn', P.wild())),
                (b) => {
                    const { items } = this.decompose(b.get('list'));
                    return items.flatMap(item => {
                        const r = this.callFunction(b.get('fn'), item);
                        return Array.isArray(r) ? r : [r];
                    });
                }),
            len: builtin('len', P.pat(P.star()),
                (b, arg) => this.smartLen(arg)),
            // Lisp spine helpers. `head!`/`tail!` are gone — use the
            // postfix slice forms `xs.0.` and `xs.1~.` instead. `prepend!`
            // and `concat!` are the structural builders for that spine.
            prepend: builtin('prepend', P.pat(P.named('item', P.wild()), P.named('list', P.wild())),
                (b) => {
                    const { items, rewrap } = this.decompose(b.get('list'));
                    return rewrap([b.get('item'), ...items]);
                }),
            concat: builtin('concat', P.pat(P.star()),
                (b, arg) => {
                    const args = Array.isArray(arg) ? arg : [arg];
                    if (args.length === 0) return [];
                    const first = this.decompose(args[0]);
                    const all = args.flatMap(v => this.decompose(v).items);
                    return first.rewrap(all);
                }),
            // slice! supports two forms:
            //   slice!(list range)         — inclusive both ends, matches `xs.1~3.`
            //   slice!(list start endExcl) — exclusive end, useful when bounds
            //                                are computed at runtime
            slice: builtin('slice', P.pat(P.star()),
                (b, arg) => {
                    const args = Array.isArray(arg) ? arg : [arg];
                    if (args.length !== 2 && args.length !== 3) {
                        throw this.punkError('slice expects (list range) or (list start end)');
                    }
                    const { items, rewrap } = this.decompose(args[0]);
                    if (args.length === 2) {
                        const r = args[1];
                        if (!r || typeof r !== 'object' || r.type !== 'Range') {
                            throw this.punkError('slice 2-arg form expects a Range as the second Thing');
                        }
                        const start = r.start == null ? 0 : r.start;
                        const end = r.end == null ? items.length - 1 : r.end;
                        if (start >= items.length || start > end) return rewrap([]);
                        return rewrap(items.slice(start, Math.min(end + 1, items.length)));
                    }
                    return rewrap(items.slice(args[1], args[2]));
                }),
            find: builtin('find', P.pat(P.named('list', P.wild()), P.named('value', P.wild())),
                (b) => {
                    const { items } = this.decompose(b.get('list'));
                    const i = items.findIndex(item => this.deepEqual(item, b.get('value')));
                    return i >= 0 ? i : null;
                }),
            contains: builtin('contains', P.pat(P.named('list', P.wild()), P.named('value', P.wild())),
                (b) => {
                    const { items } = this.decompose(b.get('list'));
                    return items.some(item => this.deepEqual(item, b.get('value')));
                }),
            sort: builtin('sort', P.pat(P.star()),
                (b, arg) => {
                    const { items, rewrap } = this.decompose(arg);
                    const sorted = [...items].sort((a, c) => {
                        if (typeof a === 'string' && typeof c === 'string') return a.localeCompare(c);
                        if (typeof a === 'number' && typeof c === 'number') return a - c;
                        return String(a).localeCompare(String(c));
                    });
                    return rewrap(sorted);
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
            const v = this.asList(arg);
            if (Array.isArray(v)) console.log(...v.map(x => this.formatValue(x)));
            else console.log(this.formatValue(v));
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

        this.setName('+', math.add);
        this.setName('-', math.sub);
        this.setName('*', math.mul);
        this.setName('/', math.div);
        this.setName('^', math.pow);
        this.setName('%', math.mod);
        this.setName('sqrt', math.sqrt);
        this.setName('isnum', math.isnum);
        this.setName('min', math.min);
        this.setName('max', math.max);
        this.setName('>', logic.gt);
        this.setName('<', logic.lt);
        this.setName('=', logic.eq);
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
        this.setName('prepend', listOps.prepend);
        this.setName('concat', listOps.concat);
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
        if (Array.isArray(v)) return '(' + v.map(x => this.formatValue(x)).join(' ') + ')';
        if (typeof v === 'string') {
            return v.replace(/\\/g, '\\\\');
        }
        if (v && typeof v === 'object') {
            if (v.type === 'Cell') return '[' + this.formatValue(v.contents) + ']';
            if (v.type === 'UserFunction' || v.type === 'FunctionLiteral') return '<function>';
            if (v.type === 'BuiltinFunction') return '<builtin>';
            if (v.type === 'Partial') return '<partial>';
            if (v.type === 'Pattern') return '<pattern>';
            if (v.type === 'Range') {
                if (v.start != null && v.end != null) {
                    return this.formatValue(this.materialiseRange(v));
                }
                return `${v.start ?? ''}~${v.end ?? ''}`;
            }
        }
        return String(v);
    }

    materialiseRange(r) {
        if (r.start == null || r.end == null) {
            throw this.punkError('Cannot force an unbounded range without context');
        }
        if (r.end < r.start) return [];
        const out = new Array(r.end - r.start + 1);
        for (let i = 0; i < out.length; i++) out[i] = r.start + i;
        return out;
    }

    asList(v) {
        if (v && typeof v === 'object' && v.type === 'Range') {
            return this.materialiseRange(v);
        }
        return v;
    }

    asListOrRange(v) {
        return this.asList(v);
    }

    /**
     * Decompose any "thing-like" value into a list of items plus a rewrap
     * fn that puts the items back into the original shape. Lets list
     * builtins (slice/prepend/concat/find/contains/sort/map/filter) work
     * directly on text and numbers without explicit split!/join!.
     */
    decompose(v) {
        if (Array.isArray(v)) {
            return { items: v, rewrap: (xs) => xs };
        }
        if (v && typeof v === 'object' && v.type === 'Range') {
            return { items: this.materialiseRange(v), rewrap: (xs) => xs };
        }
        if (typeof v === 'string') {
            return {
                items: Array.from(v),
                rewrap: (xs) => xs.map(x => typeof x === 'string' ? x : this.formatValue(x)).join('')
            };
        }
        if (typeof v === 'number') {
            return {
                items: Array.from(String(v)),
                rewrap: (xs) => {
                    const s = xs.map(x => typeof x === 'string' ? x : this.formatValue(x)).join('');
                    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
                }
            };
        }
        return { items: [v], rewrap: (xs) => xs };
    }

    smartLen(v) {
        if (v === null || v === undefined) return 0;
        if (Array.isArray(v)) return v.length;
        if (typeof v === 'string') return v.length;
        if (typeof v === 'number') return String(Math.abs(v)).length;
        if (typeof v === 'boolean') return 1;
        if (v && typeof v === 'object') {
            if (v.type === 'Range') {
                if (v.start === null || v.end === null) return 'INFINITE';
                return Math.max(0, v.end - v.start + 1);
            }
            if (v.type === 'Cell') return 1;
            if (v.type === 'UserFunction') return this.countNodes(v.body);
            if (v.type === 'BuiltinFunction') return 1;
        }
        return 1;
    }

    countNodes(node) {
        if (node === null || node === undefined) return 0;
        if (Array.isArray(node)) return node.reduce((n, c) => n + this.countNodes(c), 0);
        if (typeof node !== 'object') return 1;
        let n = 1;
        for (const k of Object.keys(node)) {
            if (k === 'type' || k === 'closure') continue;
            n += this.countNodes(node[k]);
        }
        return n;
    }

    reduceNumeric(name, arg, op) {
        const list = this.asList(Array.isArray(arg) ? arg : [arg]);
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
            case 'RegexLiteral':
                return this.compileRegex(node);
            case 'Dispatch':
                return this.evaluateDispatch(node);
            case 'FunctionCall':
                return this.evaluateFunctionCall(node);
            case 'PartialApplication':
                return this.evaluatePartialApplication(node);
            case 'FunctionDef':
                return this.evaluateFunctionDef(node);
            case 'FunctionLiteral':
                return this.evaluateFunctionLiteral(node);
            case 'Dereference':
                return this.evaluateDereference(node);
            case 'Slice':
                return this.evaluateSlice(node);
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
            case 'Range':
                return { type: 'Range', start: node.start, end: node.end };
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
            case 'Range':
                return this.evaluate(element);
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
            case 'Dispatch': {
                const value = this.evaluate(node.value);
                for (const branchExpr of node.branches) {
                    const fn = this.evaluate(branchExpr);
                    if (!fn || fn.type !== 'UserFunction') {
                        throw new Error("'?' branch must be a function value");
                    }
                    const evaluatedPattern = this.evaluatePattern(fn.pattern);
                    const bindings = this.matchPattern(value, evaluatedPattern);
                    if (bindings) {
                        return { __tc: true, fn, arg: value };
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
            case 'PartialApplication': {
                return this.evaluatePartialApplication(node);
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
        if (element.type === 'RegexLiteral') return this.compileRegex(element);
        return this.evaluate(element);
    }

    // Compile a RegexLiteral AST node into a self-contained value: the original
    // source, a cached RegExp, and a `groupNames` array (index → name|null) so
    // captured groups can be re-emitted as NamedThings in the right slots.
    compileRegex(node) {
        if (node.__compiled) return node;
        let re;
        try {
            re = new RegExp(node.source);
        } catch (e) {
            throw new Error(`Invalid regex \"${node.source}\": ${e.message}`);
        }
        return {
            type: 'RegexLiteral',
            source: node.source,
            re,
            groupNames: this.parseRegexGroupNames(node.source),
            __compiled: true,
        };
    }

    // Walk the regex source counting capturing groups (skipping `(?:`, `(?=`,
    // `(?!`, `(?<=`, `(?<!`) so each capture index is paired with its name (or
    // null for unnamed). Handles char classes and backslash escapes.
    parseRegexGroupNames(source) {
        const names = [null];
        let i = 0;
        while (i < source.length) {
            const c = source[i];
            if (c === '\\') { i += 2; continue; }
            if (c === '[') {
                i++;
                while (i < source.length && source[i] !== ']') {
                    if (source[i] === '\\') i++;
                    i++;
                }
                i++;
                continue;
            }
            if (c === '(') {
                if (source[i + 1] === '?') {
                    if (source[i + 2] === '<' && source[i + 3] !== '=' && source[i + 3] !== '!') {
                        const end = source.indexOf('>', i + 3);
                        if (end === -1) { i += 2; continue; }
                        names.push(source.slice(i + 3, end));
                        i = end + 1;
                        continue;
                    }
                    i += 2;
                    continue;
                }
                names.push(null);
            }
            i++;
        }
        return names;
    }

    // Render a value to text and run the compiled regex once. On match, build a
    // list `(whole g1 g2 ...)` where each named group is wrapped as a NamedThing
    // at its positional index so it's reachable by `m.name` AND by `m.<index>`.
    // Returns `{ matchList, namedPairs }` or null.
    runRegex(value, regexValue) {
        const text = typeof value === 'string' ? value : this.formatValue(value);
        const m = text.match(regexValue.re);
        if (!m) return null;
        const matchList = [m[0]];
        const namedPairs = [];
        for (let i = 1; i < m.length; i++) {
            const captured = m[i] === undefined ? null : m[i];
            const name = regexValue.groupNames[i];
            if (name) {
                matchList.push({ type: 'NamedThing', name, value: captured });
                namedPairs.push([name, captured]);
            } else {
                matchList.push(captured);
            }
        }
        return { matchList, namedPairs };
    }

    // Value-first dispatch: try each branch (a function value) in order;
    // the first whose pattern matches the LHS value is called with the
    // value as its arg. No branch matches → NULL.
    evaluateDispatch(node) {
        const value = this.evaluate(node.value);
        for (const branchExpr of node.branches) {
            const fn = this.evaluate(branchExpr);
            if (!fn || fn.type !== 'UserFunction') {
                throw new Error("'?' branch must be a function value");
            }
            const evaluatedPattern = this.evaluatePattern(fn.pattern);
            const bindings = this.matchPattern(value, evaluatedPattern);
            if (bindings) {
                return this.callFunction(fn, value);
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

    // `'` is the partial-application operator. It mirrors `!` (same arg form
    // and evaluation), but instead of invoking it returns a Partial value that
    // carries the pre-bound args. A later `!` call extends those args and then
    // invokes. `f'(a b)` ≡ pre-bind [a, b]; then `(f'(a b))!c` ≡ `f!(a b c)`.
    evaluatePartialApplication(node) {
        const callee = this.evaluate(node.callee);
        let arg;
        if (node.arg === null || node.arg === undefined) {
            arg = null;
        } else if (node.arg.type === 'List') {
            arg = this.evaluateListAsCode(node.arg);
        } else {
            arg = this.evaluate(node.arg);
        }
        const newArgs = arg === null ? [] : (Array.isArray(arg) ? arg : [arg]);
        if (callee && typeof callee === 'object' && callee.type === 'Partial') {
            return { type: 'Partial', fn: callee.fn, args: [...callee.args, ...newArgs] };
        }
        return { type: 'Partial', fn: callee, args: newArgs };
    }

    callFunction(fn, arg) {
        if (fn === null || fn === undefined) throw new Error('Undefined function Thing');
        // A text Thing names a function: look it up in scope and call that.
        // Enables macros like `infix:{a:_ op:_ b:_}(op.!(a. b.))` where the
        // operator is passed by name as a Thing.
        if (typeof fn === 'string') {
            const resolved = this.getName(fn);
            if (resolved === undefined) throw new Error(`Undefined Named Thing: ${fn}`);
            if (typeof resolved === 'string' && resolved === fn) {
                throw new Error('Target is not a function Thing');
            }
            return this.callFunction(resolved, arg);
        }
        // A list value is a zero-parameter body: applying `!` evaluates its elements
        // as code in the current scope. This is the homoiconic "eval" path —
        // `[forms]!` and `.code!` (where code is bound to a list) go through here.
        if (Array.isArray(fn)) {
            return this.withScope(arg === null ? new Map() : new Map([['.', arg]]), () => {
                return this.evaluateListValueAsCode(fn);
            });
        }
        if (fn && fn.type === 'Partial') {
            const more = arg === null ? [] : (Array.isArray(arg) ? arg : [arg]);
            const combined = [...fn.args, ...more];
            const finalArg = combined.length === 0 ? null
                : (combined.length === 1 ? combined[0] : combined);
            return this.callFunction(fn.fn, finalArg);
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
                    const bindings = this.matchPattern(arg, this.evaluatePattern(fn.pattern), { lenientRegex: true });
                    if (!bindings) {
                        throw new Error(`Input Thing does not match pattern ${this.formatPattern(this.evaluatePattern(fn.pattern))}`);
                    }
                    bindings.set('.', arg);
                    bindings.set('_', arg);
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
                case 'RegexLiteral': return `"${el.source}"`;
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

    evaluateSlice(node) {
        let obj = this.evaluate(node.object);
        if (typeof obj === 'string') {
            const named = this.getName(obj);
            if (named !== undefined) obj = named;
        }
        obj = this.asList(obj);
        if (!Array.isArray(obj)) obj = [obj];
        const len = obj.length;
        const start = node.start == null ? 0 : node.start;
        const end = node.end == null ? len - 1 : node.end;
        if (start >= len || start > end) return [];
        return obj.slice(start, Math.min(end + 1, len));
    }

    evaluateDereference(node) {
        if (node.object) {
            let obj = this.evaluate(node.object);

            if (typeof obj === 'string') {
                const namedValue = this.getName(obj);
                if (namedValue !== undefined) {
                    obj = namedValue;
                }
            }
            // Range values act like lists for indexing/last/length access.
            if (obj && typeof obj === 'object' && obj.type === 'Range') {
                obj = this.asList(obj);
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

    matchPattern(value, pattern, opts) {
        const bindings = new Map();
        const matched = this.matchPatternInternal(value, pattern, bindings, opts || {});
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

    matchPatternInternal(value, pattern, bindings, opts) {
        if (!opts) opts = {};
        if (pattern && pattern.type === 'Pattern') {
            if (!Array.isArray(value)) {
                if (pattern.elements.length === 1) {
                    return this.matchPatternInternal(value, pattern.elements[0], bindings, opts);
                }
                return false;
            }
            return this.matchListPattern(value, pattern.elements, bindings, opts);
        }
        if (pattern && pattern.type === 'Wildcard') {
            return true;
        }
        if (pattern && pattern.type === 'StarWildcard') {
            return true;
        }
        // Bare regex constraint (no name): pure guard — match-or-fail in strict
        // mode, always succeed in lenient mode. No top-level bindings: to
        // capture groups, give the slot a name.
        if (pattern && pattern.type === 'RegexLiteral') {
            const result = this.runRegex(value, pattern);
            if (result) return true;
            return !!opts.lenientRegex;
        }
        if (pattern && pattern.type === 'NamedThing') {
            // Named regex slot: bind `name` to the match list. Named groups are
            // reachable via `name.<groupname>`; the whole match is `name.0.`.
            if (pattern.value && pattern.value.type === 'RegexLiteral') {
                const result = this.runRegex(value, pattern.value);
                if (result) {
                    bindings.set(pattern.name, result.matchList);
                    return true;
                }
                if (opts.lenientRegex) {
                    bindings.set(pattern.name, null);
                    return true;
                }
                return false;
            }
            if (value && typeof value === 'object' && value.name !== undefined && value.value !== undefined) {
                if (value.name !== pattern.name) return false;
                if (!this.matchPatternInternal(value.value, pattern.value, bindings, opts)) return false;
                bindings.set(pattern.name, value.value);
                return true;
            }
            if (this.matchPatternInternal(value, pattern.value, bindings, opts)) {
                bindings.set(pattern.name, value);
                return true;
            }
            return false;
        }
        if (pattern && pattern.type === 'Dereference') {
            const patternValue = this.evaluateDereference(pattern);
            if (patternValue && typeof patternValue === 'object' && patternValue.type === 'Pattern') {
                return this.matchPatternInternal(value, patternValue, bindings, opts);
            }
            return value === patternValue;
        }
        if (pattern && pattern.type === 'Thing') {
            return value === pattern.value;
        }
        return value === pattern;
    }

    matchListPattern(values, patterns, bindings, opts) {
        opts = opts || {};
        const isStar = p => p && (p.type === 'StarWildcard' || (p.type === 'NamedThing' && p.value && p.value.type === 'StarWildcard'));
        const starIndex = patterns.findIndex(isStar);
        if (starIndex === -1) {
            if (values.length !== patterns.length) return false;
            for (let i = 0; i < patterns.length; i++) {
                if (!this.matchPatternInternal(values[i], patterns[i], bindings, opts)) return false;
            }
            this.bindListIndexes(values, bindings);
            return true;
        }

        const before = patterns.slice(0, starIndex);
        const after = patterns.slice(starIndex + 1);

        if (values.length < before.length + after.length) return false;

        for (let i = 0; i < before.length; i++) {
            if (!this.matchPatternInternal(values[i], before[i], bindings, opts)) return false;
        }

        const offset = values.length - after.length;
        for (let i = 0; i < after.length; i++) {
            if (!this.matchPatternInternal(values[offset + i], after[i], bindings, opts)) return false;
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
        // Normalise Range values to materialised lists so `1~5` compares
        // equal to `(1 2 3 4 5)`.
        if (a && typeof a === 'object' && a.type === 'Range') a = this.asList(a);
        if (b && typeof b === 'object' && b.type === 'Range') b = this.asList(b);
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