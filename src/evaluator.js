class Evaluator {
    constructor() {
        this.scopes = [new Map()];
        this.setupBuiltins();
    }

    setupBuiltins() {
        const math = {
            add: arg => {
                const [a, b] = this.expectList(arg, 2, 'add');
                return a + b;
            },
            sub: arg => {
                const [a, b] = this.expectList(arg, 2, 'sub');
                return a - b;
            },
            mul: arg => {
                const [a, b] = this.expectList(arg, 2, 'mul');
                return a * b;
            },
            div: arg => {
                const [a, b] = this.expectList(arg, 2, 'div');
                return a / b;
            },
            pow: arg => {
                const [a, b] = this.expectList(arg, 2, 'pow');
                return Math.pow(a, b);
            },
            sqrt: arg => {
                const [a] = this.expectList(arg, 1, 'sqrt');
                return Math.sqrt(a);
            },
            isnum: arg => {
                const value = this.expectSingle(arg, 'isnum');
                return typeof value === 'number' && !isNaN(value);
            }
        };

        const logic = {
            gt: arg => {
                const [a, b] = this.expectList(arg, 2, 'gt');
                // Support both numeric and text comparison
                if (typeof a === 'string' && typeof b === 'string') {
                    return a > b; // Alphanumeric comparison
                }
                return a > b;
            },
            lt: arg => {
                const [a, b] = this.expectList(arg, 2, 'lt');
                // Support both numeric and text comparison
                if (typeof a === 'string' && typeof b === 'string') {
                    return a < b; // Alphanumeric comparison
                }
                return a < b;
            },
            eq: arg => {
                const [a, b] = this.expectList(arg, 2, 'eq');
                return this.deepEqual(a, b);
            }
        };

        const stringOps = {
            upper: arg => String(this.expectSingle(arg, 'upper')).toUpperCase(),
            lower: arg => String(this.expectSingle(arg, 'lower')).toLowerCase(),
            trim: arg => String(this.expectSingle(arg, 'trim')).trim(),
            split: arg => {
                const [text, delim] = this.expectList(arg, 1, 'split');
                return String(text).split(delim === undefined ? '' : String(delim));
            },
            join: arg => {
                const [list, delim] = this.expectList(arg, 1, 'join');
                if (!Array.isArray(list)) throw new Error('join expects a List as the first Thing');
                return list.join(delim === undefined ? '' : String(delim));
            },
            replace: arg => {
                const [text, searchValue, replacement] = this.expectList(arg, 3, 'replace');
                return String(text).split(String(searchValue)).join(String(replacement));
            }
        };

        const listOps = {
            map: arg => {
                const [list, fn] = this.expectList(arg, 2, 'map');
                if (!Array.isArray(list)) throw new Error('map expects a List as the first Thing');
                return list.map(item => this.callFunction(fn, item));
            },
            filter: arg => {
                const [list, fn] = this.expectList(arg, 2, 'filter');
                if (!Array.isArray(list)) throw new Error('filter expects a List as the first Thing');
                return list.filter(item => this.callFunction(fn, item));
            },
            reduce: arg => {
                const [list, fn, initial] = this.expectList(arg, 2, 'reduce');
                if (!Array.isArray(list)) throw new Error('reduce expects a List as the first Thing');
                return list.reduce((acc, item) => this.callFunction(fn, [acc, item]), initial);
            },
            flatMap: arg => {
                const [list, fn] = this.expectList(arg, 2, 'flatMap');
                if (!Array.isArray(list)) throw new Error('flatMap expects a List as the first Thing');
                return list.flatMap(item => this.callFunction(fn, item));
            }
        };

        const log = arg => {
            if (Array.isArray(arg)) {
                console.log(...arg);
                return undefined;
            }
            console.log(arg);
            return undefined;
        };

        this.setName('math', math);
        this.setName('logic', logic);
        this.setName('list', listOps);
        this.setName('text', stringOps);
        this.setName('log', log);
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
            case 'Number':
                return node.value;
            case 'Thing':
                if (node.value === 'TRUE') return true;
                if (node.value === 'FALSE') return false;
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
        return this.scopes.map(scope => new Map(scope));
    }

    evaluateList(node) {
        return node.elements.map(element => this.evaluateListElement(element));
    }

    evaluateListElement(element) {
        if (element.type === 'NamedThing') {
            const value = this.evaluate(element.value);
            return { name: element.name, value };
        }
        return this.evaluate(element);
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

    evaluateConditional(node) {
        const value = this.evaluate(node.value);
        const pattern = this.evaluate(node.pattern);
        const bindings = this.matchPattern(value, pattern);

        if (bindings) {
            return this.withScope(bindings, () => this.evaluate(node.thenExpr));
        }
        return this.withScope(new Map(), () => this.evaluate(node.elseExpr));
    }

    evaluateMultiplePatternMatch(node) {
        const value = this.evaluate(node.value);
        
        for (const { pattern, expression } of node.patterns) {
            const evaluatedPattern = this.evaluate(pattern);
            const bindings = this.matchPattern(value, evaluatedPattern);
            if (bindings) {
                return this.withScope(bindings, () => this.evaluate(expression));
            }
        }
        
        return undefined; // No pattern matched
    }

    evaluateFunctionCall(node) {
        const callee = this.evaluate(node.callee);
        const arg = this.evaluate(node.arg);
        return this.callFunction(callee, arg);
    }

    callFunction(fn, arg) {
        if (!fn) throw new Error('Undefined function Thing');
        if (typeof fn === 'function') {
            return fn(arg);
        }
        if (fn.type === 'UserFunction') {
            const bindings = this.matchPattern(arg, this.evaluatePattern(fn.pattern));
            if (!bindings) {
                throw new Error('Input Thing does not match pattern');
            }
            bindings.set('.', arg);
            const savedScopes = this.scopes;
            this.scopes = fn.closure.map(scope => new Map(scope));
            const result = this.withScope(bindings, () => {
                const bodyResult = this.evaluate(fn.body);
                // Function bodies are lists, return the full list
                return bodyResult;
            });
            this.scopes = savedScopes;
            return result;
        }
        throw new Error('Target is not a function Thing');
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
        const starIndex = patterns.findIndex(p => p && p.type === 'StarWildcard');
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

        this.bindListIndexes(values, bindings);
        return true;
    }

    bindListIndexes(values, bindings) {
        for (let i = 0; i < values.length; i++) {
            const key = String(i);
            if (!bindings.has(key)) bindings.set(key, values[i]);
        }
    }

    expectList(arg, minCount, fnName) {
        if (!Array.isArray(arg)) {
            if (minCount <= 1) return [arg];
            throw new Error(`${fnName} expects a List Thing`);
        }
        if (arg.length < minCount) {
            throw new Error(`${fnName} expects at least ${minCount} Things`);
        }
        return arg;
    }

    expectSingle(arg, fnName) {
        if (Array.isArray(arg)) {
            if (arg.length !== 1) {
                throw new Error(`${fnName} expects a single Thing`);
            }
            return arg[0];
        }
        return arg;
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