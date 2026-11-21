# Welcome to Punk by example

Punk is an interpreted, functional, very loosely typed programming language where everything is immutable. There are no reserved words, no keywords and no types to declare. Everything is a **thing**: a word, a group of things written in `[ ]`, a name attached to a thing, or a function. Space is the delimiter between things, and the symbols `:` `?` `!` and `>` attach names, ask queries, call functions and pipe results.

A function is a pattern attached to a template, `(pattern)[template]`, and it returns its whole template. Failures don't raise errors: a failed match, a missing name or a bad argument all evaluate to the non-thing `[]`. Only syntax errors stop a program.

Punk is a templating language at heart, so building text and structure from other things is as natural as arithmetic.

## How to use this site

Each lesson is a short tour of one idea. Every example is live: the code is on the left and its output is on the right, so edit anything and the output updates as you type. Pick a lesson from the list, or open the Playground to try your own code. Each example runs on its own, with a fresh start.

The rules behind the examples are numbered in the [specification](https://github.com/timothystokes/punk-lang/blob/main/docs/punk-specification.md) and are referred to by ID, such as GRP-1. The [README](https://github.com/timothystokes/punk-lang#readme) has the full language overview.
