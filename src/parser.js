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
        let expr = this.primary();
        expr = this.postfix(expr);
        
        if (this.match('DOUBLE_QUESTION')) {
            expr = this.multiplePatternMatch(expr);
        } else if (this.match('QUESTION')) {
            expr = this.conditional(expr);
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
                throw new Error("Pipeline stage must yield a function value; did you mean `" + stage.value + ".`?");
            }
            // Wrap LHS as a single-element list so a list value isn't
            // spread across multiple positional slots.
            const argList = { type: 'List', elements: [expr] };
            expr = { type: 'FunctionCall', callee: stage, arg: argList };
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
            if (this.match('LEFT_BRACKET')) {
                const body = this.list();
                return { type: 'FunctionLiteral', pattern, body };
            }
            return pattern;
        }
        if (this.match('NUMBER')) {
            return { type: 'Number', value: parseFloat(this.previous().literal) };
        }
        if (this.match('UNDERSCORE')) {
            return { type: 'Wildcard' };
        }
        if (this.match('STAR')) {
            if (!this.isAtEnd() && !this.peek().leadingWhitespace) {
                const t = this.peek().type;
                if (t === 'DOT' || t === 'BANG' || t === 'LESS' || t === 'GREATER' || t === 'QUESTION' || t === 'DOUBLE_QUESTION') {
                    return { type: 'Dereference', name: '*' };
                }
            }
            return { type: 'StarWildcard' };
        }
        if (this.check('DOT')) {
            throw new Error("Bare '.' as a parameter reference is no longer supported; name your parameters with '{name:_}' and dereference with 'name.'");
        }
        if (this.match('THING')) {
            const name = this.previous().literal;
            if (this.match('COLON')) {
                const value = this.expression();
                if (value && value.type === 'Pattern' && this.match('LEFT_BRACKET')) {
                    const body = this.list();
                    return { type: 'FunctionDef', name, pattern: value, body };
                }
                return { type: 'NamedThing', name, value };
            }
            // Postfix-dot deref: a bare Thing immediately followed (no whitespace)
            // by `.`, `!`, `<`, `>`, `?`, or `??` is an implicit dereference of
            // that name. The trailing operator is handled by postfix() or by the
            // surrounding expression() loop (`?` / `??`).
            if (!this.isAtEnd() && !this.peek().leadingWhitespace) {
                const t = this.peek().type;
                if (t === 'DOT' || t === 'BANG' || t === 'LESS' || t === 'GREATER' || t === 'QUESTION' || t === 'DOUBLE_QUESTION') {
                    return { type: 'Dereference', name };
                }
            }
            return { type: 'Thing', value: name };
        }
        throw new Error(`Unexpected Thing: ${this.peek().type}`);
    }

    // After reading a dereference step name (`name`, `0`, `~`), the next token
    // must be one of `.`, `!`, `<`, `>` (no whitespace). Throws otherwise so
    // that `lst.0` (missing terminator) is rejected with a clear message.
    expectStepCloser(name) {
        if (this.isAtEnd() || this.peek().leadingWhitespace) {
            throw new Error(`Dereference step '${name}' must be terminated with '.', '!', '<' or '>'`);
        }
        const t = this.peek().type;
        if (t !== 'DOT' && t !== 'BANG' && t !== 'LESS' && t !== 'GREATER') {
            throw new Error(`Dereference step '${name}' must be terminated with '.', '!', '<' or '>'`);
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
                if (nt !== 'THING' && nt !== 'NUMBER' && nt !== 'TILDE') break;
                const tok = this.advance();
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
            if (t === 'GREATER') {
                this.advance();
                expr = { type: 'CellRead', target: expr };
                continue;
            }
            if (t === 'LESS') {
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

    // Pattern-first conditional. LHS is the pattern; what follows `?` is
    // either a single value (predicate form → TRUE/FALSE) or a [list] with
    // 1 or 2 elements:
    //
    //   pattern ? value          → TRUE | FALSE
    //   pattern ? [value]        → TRUE | FALSE  (equivalent)
    //   pattern ? [value then]   → then | NULL
    //
    // For an "else" branch use `??`. The `then` slot is parsed as an AST
    // node and held unevaluated here; the evaluator runs it lazily only on
    // a successful match.
    conditional(patternExpr) {
        if (this.check('LEFT_BRACKET')) {
            this.advance();
            const elements = [];
            while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
                elements.push(this.expression());
            }
            this.consume('RIGHT_BRACKET', "Expected ')' to close conditional");
            if (elements.length < 1 || elements.length > 2) {
                throw new Error(`Conditional '?' expects 1 or 2 elements inside [...], got ${elements.length}; use '??' for multi-branch matching`);
            }
            if (elements.length === 1) {
                return { type: 'Predicate', pattern: patternExpr, value: elements[0] };
            }
            return {
                type: 'Conditional',
                pattern: patternExpr,
                value: elements[0],
                thenExpr: elements[1]
            };
        }
        const value = this.expression();
        return { type: 'Predicate', pattern: patternExpr, value };
    }

    // Multi-pattern match. LHS is a value; RHS is a list of cases, each
    // of which is `[pattern]` (match → NULL, stop) or `[pattern result]`
    // (match → evaluate result lazily, stop). Falling off the end with
    // no match yields NULL.
    //
    //   value ?? [[p1 r1] [p2] [_ r3] [_]]
    multiplePatternMatch(value) {
        const cases = [];
        this.consume('LEFT_BRACKET', "Expected '(' after '??'");
        while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
            this.consume('LEFT_BRACKET', "Expected '(' for case");
            const pattern = this.expression();
            let expression = null;
            if (!this.check('RIGHT_BRACKET')) {
                expression = this.expression();
            }
            this.consume('RIGHT_BRACKET', "Expected ')' after case");
            cases.push({ pattern, expression });
        }
        this.consume('RIGHT_BRACKET', "Expected ')' after '??' cases");
        return { type: 'MultiplePatternMatch', value, cases };
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
        throw new Error(`${message} (got ${this.peek().type})`);
    }

    isAtEnd() {
        return this.current >= this.tokens.length;
    }

    peek() {
        if (this.isAtEnd()) return { type: 'EOF', text: '' };
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }
}

module.exports = { Parser }; 