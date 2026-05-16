class Tokenizer {
    constructor() {
        this.source = '';
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.tokenLine = 1;
        this.tokenColumn = 1;
        this.seenWhitespace = true;
    }

    tokenize(source) {
        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.seenWhitespace = true;

        while (!this.isAtEnd()) {
            this.start = this.current;
            this.tokenLine = this.line;
            this.tokenColumn = this.column;
            this.scanToken();
        }

        return this.tokens;
    }

    scanToken() {
        const c = this.advance();
        switch (c) {
            case '.': this.addToken('DOT'); break;
            case ':': this.addToken('COLON'); break;
            case '!': this.addToken('BANG'); break;
            case "'": this.addToken('APOSTROPHE'); break;
            case '?': this.addToken('QUESTION'); break;
            // Bracket rotation: `(` is list/body, `{` is pattern, `[` is cell.
            // (Token *names* still reflect their semantic role — only the
            // surface characters changed.)
            case '(': this.addToken('LEFT_BRACKET'); break;
            case ')': this.addToken('RIGHT_BRACKET'); break;
            case '{': this.addToken('LEFT_PAREN'); break;
            case '}': this.addToken('RIGHT_PAREN'); break;
            case '[': this.addToken('LEFT_BRACE'); break;
            case ']': this.addToken('RIGHT_BRACE'); break;
            case '<':
                // `<-` is the cell-write arrow; bare `<` is a Thing whose
                // text is `"<"` (so `<!a b` resolves the builtin `lt`).
                if (this.peek() === '-') {
                    this.advance();
                    this.addToken('LEFT_ARROW');
                } else {
                    this.addToken('THING', '<');
                }
                break;
            case '>':
                // Bare `>` is the Thing `">"`. The cell-read arrow `->` is
                // produced by the `-` handler in the default branch.
                this.addToken('THING', '>');
                break;
            case '_':
                // `___` (three adjacent underscores) is the variadic wildcard.
                // A bare `_` is the single-Thing wildcard (pattern) or the
                // implicit whole-argument binding (body deref `_.`).
                // `__` (two underscores) is a migration error.
                if (this.peek() === '_') {
                    this.advance();
                    if (this.peek() === '_') {
                        this.advance();
                        this.addToken('TRIPLE_UNDERSCORE');
                    } else {
                        throw new Error("'__' is no longer valid; use '___' for the variadic wildcard");
                    }
                } else {
                    this.addToken('UNDERSCORE');
                }
                break;
            case '~': this.addToken('TILDE'); break;
            case '|': this.addToken('PIPE'); break;
            case '#': this.blockComment(); break;
            case '"': this.regexLiteral(); break;
            case ' ':
            case '\r':
            case '\t':
            case '\n':
                // Ignore whitespace
                this.seenWhitespace = true;
                break;
            default:
                // `->` is the cell-read arrow. It's recognised before the
                // generic Thing/Number path so `cell->` and a standalone
                // `->` both tokenise cleanly.
                if (c === '-' && this.peek() === '>') {
                    this.advance();
                    this.addToken('RIGHT_ARROW');
                    break;
                }
                if (c === '\\' || !this.isSpecialChar(c)) {
                    // Read a THING, allowing `\X` to embed any non-whitespace special char as literal X.
                    // `+`, `-`, `*`, `/`, `^`, `%`, `=` are ordinary Thing characters and only
                    // act as callable names when they stand alone at a token boundary
                    // (e.g. `+!a b`); embedded between other chars they're just text.
                    let value;
                    if (c === '\\') {
                        if (this.isAtEnd()) throw new Error('Unexpected backslash at end of input');
                        const nxt = this.peek();
                        if (' \n\r\t'.includes(nxt)) {
                            throw new Error('Backslash cannot escape whitespace; use a list like (a b) for multi-word text');
                        }
                        value = this.advance();
                    } else {
                        value = c;
                    }
                    while (!this.isAtEnd()) {
                        const p = this.peek();
                        if (p === '\\') {
                            this.advance();
                            if (this.isAtEnd()) throw new Error('Unexpected backslash at end of input');
                            const nxt = this.peek();
                            if (' \n\r\t'.includes(nxt)) {
                                throw new Error('Backslash cannot escape whitespace; use a list like (a b) for multi-word text');
                            }
                            value += this.advance();
                        } else if (p === '-' && this.source.charAt(this.current + 1) === '>') {
                            // Stop the Thing here so the trailing `->`
                            // tokenises as a cell-read arrow on its own.
                            break;
                        } else if (this.isSpecialChar(p)) {
                            break;
                        } else {
                            value += this.advance();
                        }
                    }
                    if (/^-?\d+(?:,\d+)?$/.test(value)) {
                        this.addToken('NUMBER', value.replace(',', '.'));
                    } else {
                        this.addToken('THING', value);
                    }
                } else {
                    throw new Error(`Unexpected character in Punk source: ${c}`);
                }
        }
    }

    isSpecialChar(c) {
        return '.:!?[](){}<>_~| \n\r\t#\\"\''.includes(c);
    }

    // Regex literal: `"pattern"`. Inside the quotes, `\"` escapes a literal `"`
    // and `\\` is preserved as two characters (the regex engine interprets it
    // as a literal backslash). All other backslash sequences pass through
    // verbatim so the embedded text is exactly what the JS RegExp engine sees.
    regexLiteral() {
        let src = '';
        while (!this.isAtEnd() && this.peek() !== '"') {
            const c = this.advance();
            if (c === '\\' && !this.isAtEnd()) {
                const n = this.peek();
                if (n === '"') {
                    src += '"';
                    this.advance();
                } else {
                    src += '\\' + this.advance();
                }
            } else {
                src += c;
            }
        }
        if (this.isAtEnd()) throw new Error('Unterminated regex literal');
        this.advance();
        this.addToken('REGEX', src);
    }

    blockComment() {
        // Skip until we find closing #
        while (!this.isAtEnd()) {
            if (this.peek() === '#') {
                this.advance(); // consume closing #
                return;
            }
            this.advance();
        }
        throw new Error('Unterminated block comment');
    }

    match(expected) {
        if (this.isAtEnd()) return false;
        if (this.source.charAt(this.current) !== expected) return false;
        this.advance();
        return true;
    }

    advance() {
        const c = this.source.charAt(this.current++);
        if (c === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return c;
    }

    peek() {
        if (this.isAtEnd()) return '\0';
        return this.source.charAt(this.current);
    }

    isAtEnd() {
        return this.current >= this.source.length;
    }

    addToken(type, literal = null) {
        const text = this.source.substring(this.start, this.current);
        this.tokens.push({
            type,
            text,
            literal: literal !== null ? literal : text,
            leadingWhitespace: this.seenWhitespace,
            line: this.tokenLine,
            column: this.tokenColumn
        });
        this.seenWhitespace = false;
    }
}

module.exports = { Tokenizer }; 