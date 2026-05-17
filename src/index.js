#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const { Tokenizer } = require('./tokenizer');
const { Parser } = require('./parser');
const { Evaluator } = require('./evaluator');

function run(source, evaluator) {
    const tokens = new Tokenizer().tokenize(source);
    const ast = new Parser().parse(tokens);
    return evaluator.evaluate(ast);
}

// Walk the source counting brackets so the REPL knows when an entry is
// complete. Honours `#...#` block comments and `\X` escapes — the same
// rules the tokenizer follows.
function isComplete(source) {
    let depth = 0;
    let inComment = false;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (inComment) {
            if (c === '#') inComment = false;
            continue;
        }
        if (c === '\\') { i++; continue; }
        if (c === '#') { inComment = true; continue; }
        if (c === '[' || c === '(' || c === '{') depth++;
        else if (c === ']' || c === ')' || c === '}') depth--;
        if (depth < 0) return true;
    }
    return !inComment && depth <= 0;
}

function runFile(sourceFile) {
    try {
        const absPath = require('path').resolve(sourceFile);
        const source = fs.readFileSync(absPath, 'utf-8');
        const evaluator = new Evaluator({ entryFile: absPath });
        const result = run(source, evaluator);
        if (result !== undefined) console.log(evaluator.formatValue(result));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

function repl() {
    const evaluator = new Evaluator();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });

    console.log('Punk REPL — Ctrl-D to exit');
    rl.prompt();

    let buffer = '';
    rl.on('line', (line) => {
        buffer += (buffer ? '\n' : '') + line;
        if (!isComplete(buffer)) {
            rl.setPrompt('… ');
            rl.prompt();
            return;
        }
        const source = buffer;
        buffer = '';
        rl.setPrompt('> ');
        try {
            const result = run(source, evaluator);
            if (result !== undefined) {
                console.log(evaluator.formatValue(result));
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
        rl.prompt();
    });

    rl.on('close', () => {
        process.stdout.write('\n');
        process.exit(0);
    });
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        repl();
    } else {
        runFile(args[0]);
    }
}

main();