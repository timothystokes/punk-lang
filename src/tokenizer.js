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
            case '_': this.addToken('UNDERSCORE'); break;
            case '*': this.addToken('STAR'); break;
            case '~': this.addToken('TILDE'); break;
            case '#': this.blockComment(); break;
            case ' ':
            case '\r':
            case '\t':
            case '\n':
                // Ignore whitespace
                this.seenWhitespace = true;
                break;
            default:
                // Handle things (any sequence of characters that isn't a special character)
                if (!this.isSpecialChar(c)) {
                    while (!this.isAtEnd() && !this.isSpecialChar(this.peek())) {
                        this.advance();
                    }
                    const text = this.source.substring(this.start, this.current);
                    // Check if it's a number
                    if (/^-?\d+(?:,\d+)?$/.test(text)) {
                        this.addToken('NUMBER', text.replace(',', '.'));
                    } else {
                        this.addToken('THING', text);
                    }
                } else {
                    throw new Error(`Unexpected character in Punk source: ${c}`);
                }
        }
    }

    isSpecialChar(c) {
        return '.:!?[]()_*~ \n\r\t#'.includes(c);
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