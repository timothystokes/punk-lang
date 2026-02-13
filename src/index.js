#!/usr/bin/env node

const fs = require('fs');
const { Tokenizer } = require('./tokenizer');
const { Parser } = require('./parser');
const { Evaluator } = require('./evaluator');

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Please provide a Punk source file to execute');
        process.exit(1);
    }

    const sourceFile = args[0];
    
    try {
        const source = fs.readFileSync(sourceFile, 'utf-8');
        
        const tokenizer = new Tokenizer();
        const tokens = tokenizer.tokenize(source);
        
        const parser = new Parser();
        const ast = parser.parse(tokens);
        
        const evaluator = new Evaluator();
        const result = evaluator.evaluate(ast);
        
        if (result !== undefined) {
            console.log(result);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main(); 