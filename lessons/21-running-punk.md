# Running Punk

`npm start` opens the REPL, which prints the result of each top-level
expression. `npm start file.punk` runs a file silently; only `print!`
writes to the output. Examples to try are in the `examples` folder:

```bash
npm start examples/hello.punk
npm start examples/people.punk
npm start examples/numbers.punk
npm start examples/todo.punk
npm start examples/server.punk
```

`print!` is usually the last stage of a pipe.

```punk
Sally > welcome! > print!
```
