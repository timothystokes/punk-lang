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
            return this.multiplePatternMatch(expr);
        }
        if (this.match('QUESTION')) {
            return this.conditional(expr);
        }
        
        return expr;
    }

    primary() {
        if (this.match('LEFT_BRACKET')) {
            return this.list();
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
        if (this.match('DOT')) {
            return this.dereference();
        }
        if (this.match('THING')) {
            const name = this.previous().text;
            if (this.match('COLON')) {
                const value = this.expression();
                if (value && value.type === 'Pattern' && this.match('LEFT_BRACKET')) {
                    const body = this.list();
                    return { type: 'FunctionDef', name, pattern: value, body };
                }
                return { type: 'NamedThing', name, value };
            }
            return { type: 'Thing', value: name };
        }
        throw new Error(`Unexpected Thing: ${this.peek().type}`);
    }

    postfix(expr) {
        while (this.check('DOT') && !this.peek().leadingWhitespace) {
            this.advance();
            if (!(this.check('THING') || this.check('NUMBER') || this.check('TILDE'))) {
                throw new Error("Expected Thing name after '.'");
            }
            const token = this.advance();
            const name = token.type === 'NUMBER' ? String(token.literal) : (token.type === 'TILDE' ? '~' : token.text);
            expr = { type: 'Dereference', object: expr, name };

            if (this.match('BANG')) {
                let arg = null;
                if (this.match('LEFT_BRACKET')) {
                    arg = this.list();
                } else if (!this.isAtEnd()) {
                    arg = this.expression();
                }
                if (arg === null) {
                    throw new Error('Expected a single Thing after !');
                }
                expr = { type: 'FunctionCall', callee: expr, arg };
            }
        }
        return expr;
    }

    dereference() {
        if (this.check('THING') || this.check('NUMBER') || this.check('TILDE')) {
            const token = this.advance();
            const name = token.type === 'NUMBER' ? String(token.literal) : (token.type === 'TILDE' ? '~' : token.text);
            let expr = { type: 'Dereference', name };
            
            while (this.match('DOT')) {
                if (!(this.check('THING') || this.check('NUMBER') || this.check('TILDE'))) {
                    throw new Error("Expected Thing name after '.'");
                }
                const next = this.advance();
                const nextName = next.type === 'NUMBER' ? String(next.literal) : (next.type === 'TILDE' ? '~' : next.text);
                expr = { type: 'Dereference', object: expr, name: nextName };
            }
            
            if (this.match('BANG')) {
                let arg = null;
                if (this.match('LEFT_BRACKET')) {
                    arg = this.list();
                } else if (!this.isAtEnd()) {
                    arg = this.expression();
                }
                if (arg === null) {
                    throw new Error('Expected a single Thing after !');
                }
                return { type: 'FunctionCall', callee: expr, arg };
            }
            
            return expr;
        }

        return { type: 'Param' };
    }

    list() {
        const elements = [];
        while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
            elements.push(this.expression());
            if (this.check('RIGHT_BRACKET')) break;
        }
        this.consume('RIGHT_BRACKET', "Expected ']' to end List");
        return { type: 'List', elements };
    }

    pattern() {
        const elements = [];
        while (!this.check('RIGHT_PAREN') && !this.isAtEnd()) {
            if (this.match('UNDERSCORE')) {
                elements.push({ type: 'Wildcard' });
            } else if (this.match('STAR')) {
                elements.push({ type: 'StarWildcard' });
            } else {
                elements.push(this.expression());
            }
            if (this.check('RIGHT_PAREN')) break;
        }
        this.consume('RIGHT_PAREN', "Expected ')' to end Pattern");
        return { type: 'Pattern', elements };
    }

    conditional(value) {
        const pattern = this.expression();
        this.consume('LEFT_BRACKET', "Expected '[' after Pattern");
        const thenExpr = this.list();
        this.consume('LEFT_BRACKET', "Expected '[' for else Thing");
        const elseExpr = this.list();
        return { type: 'Conditional', value, pattern, thenExpr, elseExpr };
    }

    multiplePatternMatch(value) {
        const patterns = [];
        
        this.consume('LEFT_BRACKET', "Expected '[' after '??'");
        while (!this.check('RIGHT_BRACKET') && !this.isAtEnd()) {
            this.consume('LEFT_BRACKET', "Expected '[' for Pattern case");
            const pattern = this.expression();
            this.consume('LEFT_BRACKET', "Expected '[' after Pattern");
            const expression = this.list();
            this.consume('RIGHT_BRACKET', "Expected ']' after Thing");
            this.consume('RIGHT_BRACKET', "Expected ']' after Pattern case");
            patterns.push({ pattern, expression });
        }
        this.consume('RIGHT_BRACKET', "Expected ']' after Pattern cases");
        
        return { type: 'MultiplePatternMatch', value, patterns };
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