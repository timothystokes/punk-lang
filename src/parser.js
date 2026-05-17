class Parser {
    constructor() {
        this.tokens = [];
        this.current = 0;
    }

    parse(tokens) {
        this.tokens = tokens;
        this.current = 0;
        return this.program();
    }

    program() {
        const statements = [];
        while (!this.isAtEnd()) {
            try {
                const stmt = this.statement();
                if (stmt) statements.push(stmt);
            } catch (error) {
                console.error('Parse error:', error.message);
                this.synchronize();
            }
        }
        return { type: 'Program', statements };
    }

    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            switch (this.peek().type) {
                case 'THING':
                case 'DOT':
                case 'LEFT_BRACKET':
                    return;
            }
            this.advance();
        }
    }

    statement() {
        return this.expression();
    }

    expression() {
        const startTok = this.peek();
        let expr = this.primary();
        expr = this.postfix(expr);
        
        if (this.match('QUESTION')) {
            expr = this.dispatch(expr);
        }
        
        // Pipeline: `a | stage` desugars to `(stage)!a` where `stage` is
        // an expression that must evaluate to a function value. Typical
        // forms are `a | f.` (deref a name) and `a | f!x.` (call something
        // that returns a function). Left-associative. Whitespace around
        // `|` is ignored. For multi-arg stages, wrap in a lambda:
        // `a | (v:_)[f![v. 0 2]].`.
        while (this.match('PIPE')) {
            let stage = this.primary();
            stage = this.postfix(stage);
            // A bare Thing (e.g. `a | f`) is almost certainly a forgotten
            // `.` — reject at parse time with a clear message rather than
            // let the runtime say "Target is not a function Thing".
            if (stage.type === 'Thing') {
                throw this.error("Pipeline stage must yield a function value; did you mean `" + stage.value + ".`?");
            }
            // `a | f.` desugars to `f!a` — the LHS value goes in as the arg
            // (no wrapping), so the pipeline mirrors a direct `!` call exactly.
            expr = { type: 'FunctionCall', callee: stage, arg: expr };
        }
        
        // Tag the outermost node with the start position so runtime
        // errors can pinpoint where in the source the value came from.
        if (expr && typeof expr === 'object' && expr.line == null && startTok && startTok.line != null) {
            expr.line = startTok.line;
            expr.column = startTok.column;
        }
        return expr;
    }

    postfixDerefOnly(expr) {
        while (!this.isAtEnd() && !this.peek().leadingWhitespace) {
            if (this.peek().type !== 'DOT') break;
            this.advance();
            if (this.isAtEnd() || this.peek().leadingWhitespace) break;
            const nt = this.peek().type;
            if (nt !== 'THING' && nt !== 'NUMBER' && nt !== 'TILDE') break;
            const tok = this.advance();
            const name = tok.type === 'NUMBER' ? String(tok.literal)
                : (tok.type === 'TILDE' ? '~' : tok.literal);
            expr = { type: 'Dereference', object: expr, name };
            this.expectStepCloser(name);
        }
        return expr;
    }

    primary() {
        if (this.match('LEFT_BRACKET')) {
            return this.list();
        }
        if (this.match('LEFT_BRACE')) {
            const value = this.expression();
            this.consume('RIGHT_BRACE', "Expected ']' to end Cell");
            return { type: 'CellLiteral', value };
        }
        if (this.match('LEFT_PAREN')) {
            const pattern = this.pattern();
            if (this.check('LEFT_BRACKET')) {
                if (this.peek().leadingWhitespace) {
                    throw this.error("Function literal must be tight: no whitespace between pattern '}' and body '(' in '{pattern}(body)'");
                }
                this.advance();
                const body = this.list();
                return { type: 'FunctionLiteral', pattern, body };
            }
            return pattern;
        }
        if (this.match('NUMBER')) {
            const num = parseFloat(this.previous().literal);
            // Range literal: tight `N~`, `N~M` (no whitespace between tokens).
            if (!this.isAtEnd() && !this.peek().leadingWhitespace && this.check('TILDE')) {
                this.advance();
                let end = null;
                if (!this.isAtEnd() && !this.peek().leadingWhitespace && this.check('NUMBER')) {
                    end = parseFloat(this.advance().literal);
                }
                return { type: 'Range', start: num, end };
            }
            return { type: 'Number', value: num };
        }
        // Open-start range literal `~N` (tight). Bare `~` outside a dereference
        // step is reserved for the last-element name and is not a valid primary.
        if (this.check('TILDE') && !this.isAtEnd()) {
            const tildeTok = this.peek();
            const next = this.tokens[this.current + 1];
            if (next && next.type === 'NUMBER' && !next.leadingWhitespace) {
                this.advance();
                this.advance();
                return { type: 'Range', start: null, end: parseFloat(next.literal) };
            }
        }
        if (this.match('UNDERSCORE')) {
            // Postfix-adjacent `_` (e.g. `_.`, `_!`, `_'`) is an implicit
            // dereference of the whole-argument binding — every function
            // body has `_` bound to the raw arg as passed. Otherwise `_`
            // is the single-Thing wildcard for patterns.
            if (!this.isAtEnd() && !this.peek().leadingWhitespace) {
                const t = this.peek().type;
                if (t === 'DOT' || t === 'BANG' || t === 'APOSTROPHE' || t === 'LEFT_ARROW' || t === 'RIGHT_ARROW') {
                    return { type: 'Dereference', name: '_' };
                }
            }
            return { type: 'Wildcard' };
        }
        if (this.match('REGEX')) {
            return { type: 'RegexLiteral', source: this.previous().literal };
        }
        if (this.match('TEXT')) {
            return { type: 'TextLiteral', value: this.previous().literal };
        }
        if (this.match('TRIPLE_UNDERSCORE')) {
            // `___` is the variadic wildcard for patterns. Pattern-only —
            // bodies always use `_.` (not `___.`) for the whole-arg deref.
            return { type: 'StarWildcard' };
        }
        if (this.check('DOT')) {
            throw this.error("Bare '.' as a parameter reference is no longer supported; name your parameters with '{name:_}' and dereference with 'name.'");
        }
        if (this.match('THING')) {
            const name = this.previous().literal;
            if (this.check('COLON')) {
                if (this.peek().leadingWhitespace) {
                    throw this.error("Binding ':' must be tight: no whitespace before ':' in 'name:value'");
                }
                this.advance();
                if (this.peek().leadingWhitespace) {
                    throw this.error("Binding ':' must be tight: no whitespace after ':' in 'name:value'");
                }
                // `name:|stage. | stage.` — headless-pipe function binding.
                // The `:` and first `|` must be adjacent (the leadingWhitespace
                // check above guarantees that). Desugars to `{_}(_. | s1 | s2 | …)`
                // so the evaluator needs no changes.
                if (this.check('PIPE')) {
                    const stages = [];
                    while (this.match('PIPE')) {
                        if (this.isAtEnd() || this.check('PIPE')) {
                            throw this.error("`name:|` needs a pipe stage after each `|`");
                        }
                        let stage = this.primary();
                        stage = this.postfix(stage);
                        if (stage.type === 'Thing') {
                            throw this.error("Pipeline stage must yield a function value; did you mean `" + stage.value + ".`?");
                        }
                        stages.push(stage);
                    }
                    if (stages.length === 0) {
                        throw this.error("`name:|` needs at least one pipe stage");
                    }
                    let acc = { type: 'Dereference', name: '_' };
                    for (const stage of stages) {
                        acc = { type: 'FunctionCall', callee: stage, arg: acc };
                    }
                    const pattern = { type: 'Pattern', elements: [{ type: 'Wildcard' }] };
                    const body = { type: 'List', elements: [acc] };
                    return { type: 'FunctionDef', name, pattern, body };
                }
                const value = this.expression();
                if (value && value.type === 'Pattern' && this.check('LEFT_BRACKET')) {
                    if (this.peek().leadingWhitespace) {
                        throw this.error("Function literal must be tight: no whitespace between pattern '}' and body '(' in '{pattern}(body)'");
                    }
                    this.advance();
                    const body = this.list();
                    return { type: 'FunctionDef', name, pattern: value, body };
                }
                return { type: 'NamedThing', name, value };
            }
            // Postfix-dot deref: a bare Thing immediately followed (no whitespace)
            // by `.`, `!`, `<-`, or `->` is an implicit dereference of that name.
            // `?` is NOT in this list: `?` is value-first dispatch, so a bare
            // Thing on the LHS of `?` is itself the value (e.g. `hello?{_}(yes)`).
            // To dispatch on a bound name's value use the explicit `name.?...`.
            if (!this.isAtEnd() && !this.peek().leadingWhitespace) {
                const t = this.peek().type;
                if (t === 'DOT' || t === 'BANG' || t === 'APOSTROPHE' || t === 'LEFT_ARROW' || t === 'RIGHT_ARROW') {
                    return { type: 'Dereference', name };
                }
            }
            return { type: 'Thing', value: name };
        }
        throw this.error(`Unexpected Thing: ${this.peek().type}`);
    }

    // After reading a dereference step name (`name`, `0`, `~`), the next token
    // must be one of `.`, `!`, `<-`, `->` (no whitespace). Throws otherwise so
    // that `lst.0` (missing terminator) is rejected with a clear message.
    expectStepCloser(name) {
        if (this.isAtEnd() || this.peek().leadingWhitespace) {
            throw this.error(`Dereference step '${name}' must be terminated with '.', '!', '<-' or '->'`);
        }
        const t = this.peek().type;
        if (t !== 'DOT' && t !== 'BANG' && t !== 'APOSTROPHE' && t !== 'LEFT_ARROW' && t !== 'RIGHT_ARROW') {
            throw this.error(`Dereference step '${name}' must be terminated with '.', '!', '<-' or '->'`);
        }
    }

    // Parse the (optional) argument that follows a `!`.
    // Returns null for a zero-arg call: signalled when the next token has leading
    // whitespace, we're at end of input, or the next token is a closer (`]`/`)`)
    // that belongs to an enclosing form.
    parseCallArg() {
        if (this.isAtEnd() || this.peek().leadingWhitespace) return null;
        const t = this.peek().type;
        if (t === 'RIGHT_BRACKET' || t === 'RIGHT_PAREN' || t === 'RIGHT_BRACE') return null;
        // Bare `!` argument is a single primary + postfix chain, not a full
        // expression — otherwise `f!a ?? b` would parse as `f!(a ?? b)`.
        // Use brackets `f![a ?? b]` to splice a full expression as a list arg.
        let arg = this.primary();
        arg = this.postfix(arg);
        return arg;
    }

    postfix(expr) {
        // Dereference chain. Each step ends with one of `.`, `!`, `<`, `>`;
        // these terminators also act as the boundary to the next step. Bare
        // index sugar (e.g. `[1 2 3]0`) is gone — write `[1 2 3].0.` instead.
        while (!this.isAtEnd() && !this.peek().leadingWhitespace) {
            const t = this.peek().type;
            if (t === 'DOT') {
                this.advance();
                // Terminal `.`: end of chain (nothing follows or whitespace next).
                if (this.isAtEnd() || this.peek().leadingWhitespace) break;
                const nt = this.peek().type;
                // DOT followed by a non-name token (e.g. `!`, `<`, `>`) just
                // acts as a chain terminator — let the outer postfix loop
                // handle that next operator (e.g. `operator.!(x y)`).
                if (nt !== 'THING' && nt !== 'NUMBER' && nt !== 'TILDE') continue;
                const tok = this.advance();
                // Slice sugar: `N~`, `N~M`, `~N` between the `.` and the next
                // step-closer produces a sublist (inclusive end). Bare `~`
                // remains the last-element accessor.
                let isSlice = false;
                let sliceStart = null;
                let sliceEnd = null;
                if (tok.type === 'NUMBER' && this.check('TILDE')) {
                    this.advance();
                    isSlice = true;
                    sliceStart = parseInt(tok.literal, 10);
                    if (this.check('NUMBER')) {
                        sliceEnd = parseInt(this.advance().literal, 10);
                    }
                } else if (tok.type === 'TILDE' && this.check('NUMBER')) {
                    isSlice = true;
                    sliceEnd = parseInt(this.advance().literal, 10);
                }
                if (isSlice) {
                    const label = `${sliceStart ?? ''}~${sliceEnd ?? ''}`;
                    expr = { type: 'Slice', object: expr, start: sliceStart, end: sliceEnd };
                    this.expectStepCloser(label);
                    continue;
                }
                const name = tok.type === 'NUMBER' ? String(tok.literal)
                    : (tok.type === 'TILDE' ? '~' : tok.literal);
                expr = { type: 'Dereference', object: expr, name };
                this.expectStepCloser(name);
                continue;
            }
            if (t === 'BANG') {
                this.advance();
                const arg = this.parseCallArg();
                expr = { type: 'FunctionCall', callee: expr, arg };
                continue;
            }
            if (t === 'APOSTROPHE') {
                this.advance();
                const arg = this.parseCallArg();
                expr = { type: 'PartialApplication', callee: expr, arg };
                continue;
            }
            if (t === 'RIGHT_ARROW') {
                this.advance();
                expr = { type: 'CellRead', target: expr };
                continue;
            }
            if (t === 'LEFT_ARROW') {
                this.advance();
                const value = this.expression();
                expr = { type: 'CellWrite', target: expr, value };
                continue;
            }
            break;
        }
        return expr;
    }

    list() {
        const elements = [];
        while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
            elements.push(this.expression());
            if (this.check('RIGHT_BRACKET')) break;
        }
        this.consume('RIGHT_BRACKET', "Expected ')' to end List");
        return { type: 'List', elements };
    }

    pattern() {
        const elements = [];
        while (!this.check('RIGHT_PAREN') && !this.isAtEnd()) {
            elements.push(this.expression());
            if (this.check('RIGHT_PAREN')) break;
        }
        this.consume('RIGHT_PAREN', "Expected '}' to end Pattern");
        return { type: 'Pattern', elements };
    }

    // Value-first dispatch. LHS is the value to match against. RHS is one
    // or more function-shaped branches; the first whose pattern matches
    // the value runs (its body is evaluated in the function's closure
    // with the matched bindings). No match → NULL.
    //
    //   value ? fn.                    {single branch — fn ref or literal}
    //   value ? {p}(body)              {single branch — function literal}
    //   value ? (fn1 fn2 fn3)          {ordered list of branches}
    //
    // Branches inside `(...)` are parsed as expressions, not as a data
    // list, so function literals and dereferences evaluate to actual
    // function values rather than quoted forms.
    dispatch(value) {
        if (this.match('LEFT_BRACKET')) {
            const branches = [];
            while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
                branches.push(this.expression());
            }
            this.consume('RIGHT_BRACKET', "Expected ')' to close '?' branches");
            return { type: 'Dispatch', value, branches };
        }
        let branch = this.primary();
        branch = this.postfix(branch);
        return { type: 'Dispatch', value, branches: [branch] };
    }

    match(type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    consume(type, message) {
        if (this.check(type)) return this.advance();
        throw this.error(message + ` (got ${this.peek().type})`);
    }

    error(message, token = null) {
        const t = token || this.peek();
        const pos = (t && t.line != null) ? `[${t.line}:${t.column}] ` : '';
        return new Error(pos + message);
    }

    isAtEnd() {
        return this.current >= this.tokens.length;
    }

    peek() {
        if (this.isAtEnd()) {
            // Synthesize an EOF marker carrying the position right after
            // the last real token, so end-of-input errors still pinpoint
            // a useful location.
            const last = this.tokens[this.tokens.length - 1];
            if (last) {
                return {
                    type: 'EOF',
                    text: '',
                    line: last.line,
                    column: last.column + (last.text ? last.text.length : 0)
                };
            }
            return { type: 'EOF', text: '', line: 1, column: 1 };
        }
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }
}

module.exports = { Parser }; 