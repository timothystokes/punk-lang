class Tokenizer {
    constructor() {
        this.source = '';
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.seenWhitespace = true;
    }

    tokenize(source) {
        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.seenWhitespace = true;

        while (!this.isAtEnd()) {
            this.start = this.current;
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
            case '?': 
                if (this.match('?')) {
                    this.addToken('DOUBLE_QUESTION');
                } else {
                    this.addToken('QUESTION');
                }
                break;
            case '[': this.addToken('LEFT_BRACKET'); break;
            case ']': this.addToken('RIGHT_BRACKET'); break;
            case '(': this.addToken('LEFT_PAREN'); break;
            case ')': this.addToken('RIGHT_PAREN'); break;
            case '{': this.addToken('LEFT_BRACE'); break;
            case '}': this.addToken('RIGHT_BRACE'); break;
            case '<': this.addToken('LESS'); break;
            case '>': this.addToken('GREATER'); break;
            case '_': this.addToken('UNDERSCORE'); break;
            case '*': this.addToken('STAR'); break;
            case '~': this.addToken('TILDE'); break;
            case '|': this.addToken('PIPE'); break;
            case '+': {
                // `+` is the in-Thing space marker. Standalone `+` becomes a
                // single-character text Thing whose value is one space; that
                // way `text.join![[a b] +]` works without escaping.
                this.addToken('THING', ' ');
                break;
            }
            case '#': this.blockComment(); break;
            case '/': throw new Error('Forward slash is reserved for future ratio literals; use \\/ to include a literal /');
            case ' ':
            case '\r':
            case '\t':
            case '\n':
                // Ignore whitespace
                this.seenWhitespace = true;
                break;
            default:
                if (c === '\\' || !this.isSpecialChar(c)) {
                    // Read a THING, allowing `\X` to embed any special char as literal X.
                    // `+` inside a THING is the literal-space marker; use `\+` to embed
                    // a real `+` character.
                    let value = (c === '\\') ? this.advance() : c;
                    while (!this.isAtEnd()) {
                        const p = this.peek();
                        if (p === '\\') {
                            this.advance();
                            if (this.isAtEnd()) throw new Error('Unexpected backslash at end of input');
                            value += this.advance();
                        } else if (p === '+') {
                            this.advance();
                            value += ' ';
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
        return '.:!?[](){}<>_*~+| \n\r\t#/\\'.includes(c);
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
        this.current++;
        return true;
    }

    advance() {
        return this.source.charAt(this.current++);
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
            leadingWhitespace: this.seenWhitespace
        });
        this.seenWhitespace = false;
    }
}

module.exports = { Tokenizer }; 