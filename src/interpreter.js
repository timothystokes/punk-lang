const fs = require('fs');
const { Tokenizer } = require('./tokenizer');
const { Parser } = require('./parser');
const { Evaluator } = require('./evaluator');

class Interpreter {
    constructor() {
        this.tokenizer = new Tokenizer();
        this.parser = new Parser();
        this.evaluator = new Evaluator();
    }

    interpret(source) {
        const tokens = this.tokenizer.tokenize(source);
        const ast = this.parser.parse(tokens);
        return this.evaluator.evaluate(ast);
    }

    interpretFile(filename) {
        const source = fs.readFileSync(filename, 'utf8');
        return this.interpret(source);
    }
}

module.exports = { Interpreter }; 