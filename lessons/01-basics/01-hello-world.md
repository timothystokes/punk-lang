# Hello World

Everything in Punk is a thing, and a program shows the result of its last expression. `print!` writes a line of its own to the output as well, and is usually the last stage of a pipe.

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome! > print!
```
**`[]`**
