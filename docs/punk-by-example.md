# Punk by example

A worked tour of Punk. `README.md` is the overview and
`docs/punk-specification.md` holds the numbered rules (referenced below
as IDs such as GRP-1). Each example is a `punk` block followed by its
result on a bold line. Lines in one block form one program.

## Things

Everything in Punk is a **thing**. Space separates things, `[ ]` groups
them.

```punk
Paul
```
**`Paul`**

```punk
[Paul is 42]
```
**`[Paul is 42]`**

Numbers, text and logical values are all just words (THING-3). There are
no reserved words, so `TRUE` and `FALSE` are ordinary words (LEX-7).

```punk
[42 hello TRUE]
```
**`[42 hello TRUE]`**

## Grouping

A single-element thing is the same thing as its element (GRP-1). `[ ]`
is only needed around two or more things.

```punk
[[x]]
```
**`x`**

```punk
=![[x] x]
```
**`TRUE`**

The empty group is the **non-thing**. It is what you get when something
does not match or cannot be found (THING-7..9).

```punk
[]
```
**`[]`**

## Named things

`name:thing` attaches a name to a thing. Defining a name evaluates to
the named thing itself (NAME-3).

```punk
x:1
```
**`x:1`**

Names are immutable inside a context. A second definition of the same
name in that context is a syntax error (NAME-2).

```punk
x:1
x:2
```
**`'x' is already named in this context`**

## Queries

`name?` looks a thing up. Segments after `.` select a named thing or the
nth item, counting from 1 (QRY-3..5).

```punk
person:[name:[Paul Jones] age:42]
person.age?
```
**`42`**

```punk
person:[name:[Paul Jones] age:42]
person.name.2?
```
**`Jones`**

A query that does not align with the structure gives the non-thing
(QRY-7).

```punk
person:[name:[Paul Jones] age:42]
person.height?
```
**`[]`**

## Templates

A thing evaluated with `!` resolves every query and every call inside it
(TMPL-1).

```punk
person:[Paul]
message:[Hello person?]
message!
```
**`[Hello Paul]`**

Without `!` the queries are left as written (TMPL-6).

```punk
person:[Paul]
[Hello person?]
```
**`[Hello person?]`**

Calls evaluate inside a template too. The result of each call lands as
one element (TMPL-5).

```punk
[Total +![1 2]]!
```
**`[Total 3]`**

## Embeds

Inside an evaluated template, `{query?}` joins its result to the text
around it with no space (EMB-3, EMB-4).

```punk
env:prod
[{env?}-database]!
```
**`prod-database`**

A multi-element result keeps its internal spaces and the template is
re-read, so the number of things can change (EMB-9, EMB-10).

```punk
name:[Paul Jones]
[Dr-{name?}]!
```
**`[Dr-Paul Jones]`**

```punk
name:[Paul Jones]
[Dr-{name?}]! > count!
```
**`2`**

Embeds also work in names, so a name can be computed (NAME-8).

```punk
k:colour
v:red
x:{k?}:{v?}
x.colour?
```
**`red`**

A failed query embeds as nothing (EMB-7).

```punk
[a{missing?}b]!
```
**`ab`**

## Patterns

A pattern describes a shape. `_` is one thing, `#` is any number of
things (including none, and last), and a literal word matches that word.
Executing a pattern with `!` gives `TRUE` or `FALSE` (PAT-7).

```punk
[a b](_ _)!
```
**`TRUE`**

```punk
[a b c](_ #)!
```
**`TRUE`**

```punk
[a b](a _)!
```
**`TRUE`**

```punk
[a b c](_ _)!
```
**`FALSE`**

A thing can also be piped to a pattern, and a pattern with a template
returns the template on a match (PAT-8, PAT-9).

```punk
[Paul Jones] > (_ _)[Full name found]!
```
**`[Full name found]`**

A label such as `n:_` names the matched thing for use in a function. It
matches by shape only, whatever the thing is called (PAT-10..12).

```punk
f:(n:_)[Hi n?]
tim > f!
```
**`[Hi tim]`**

## Such that

Names only take part in matching on the right of a `|` (PAT-13). The
left is matched by shape, the right asserts that named things exist,
in any order (PAT-17, PAT-18).

```punk
[name:Bob age:42](# | name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](# | age:42 name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](# | name:Sally)!
```
**`FALSE`**

## Functions

A function is a pattern with a template: `(pattern)[template]`. It
receives exactly one thing, `.` refers to it, and labels from the
pattern resolve with `?` (FN-1..4).

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome!
```
**`[Hello Sally]`**

A function can also be called with its argument attached (FN-6).

```punk
welcome:(name:_)[Hello .name?]
welcome![Jim]
```
**`[Hello Jim]`**

The result is the whole resulting template; there is no return keyword
(TMPL-4). Named things defined inside come back too.

```punk
g:(n:_)[x:+![n? 1] x? *![x? 2]]
g!3
```
**`[x:4 4 8]`**

If the argument does not match the pattern the call gives the non-thing
(FN-7).

```punk
f:(_ _)[hi]
f![a b c]
```
**`[]`**

## Scope

Every function body and every file is its own context. Lookups cascade
outwards, an inner context may shadow a name, and `.` never cascades
(NAME-2a..2e).

```punk
x:1
f:(_)[x?]
0 > f!
```
**`1`**

```punk
x:1
f:(_)[x:2 x?]
0 > f!
```
**`[x:2 2]`**

```punk
n:outer
f:(_)[.n?]
0 > f!
```
**`[]`**

## Pipes

`>` passes the result of one stage to the next (PIPE-1).

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome! > upper!
```
**`[HELLO SALLY]`**

A pipe is a function, so it can be named (PIPE-4), and the result of a
pipe can be named (PIPE-5).

```punk
welcome:(name:_)[Hello .name?]
shout:> welcome! > upper!
Jim > shout!
```
**`[HELLO JIM]`**

```punk
y:[a b c]
size:y? > count!
size?
```
**`3`**

## Cases

`->` starts a case: a function or pipe tried against the subject on the
line above. The first case that matches runs, and no later case is tried
(CASE-1..3).

```punk
number:43
number?
-> (42)[This is Forty Two]!
-> (n:_)[This is .n?]!
```
**`[This is 43]`**

More arrows make sub-cases, tried only if their parent matched (CASE-4,
CASE-5). If the parent matches but no sub-case does, the result is the
non-thing, with no fall through (CASE-6).

```punk
person:[name:[John Smith] role:vip]
person?
-> (_ _)[.?]!
--> (n:_ vip)[.n?]! > upper!
--> (n:_ _)[.n?]!
-> (_)[You need to provide two names]!
```
**`[JOHN SMITH]`**

```punk
x:5
x?
-> (5)[a]!
--> (6)[sub]!
-> (5)[b]!
```
**`[]`**

If nothing matches at the top level the result is also the non-thing
(CASE-7).

## Currying

Give a function fewer things than its pattern expects and you get a new
function waiting for the rest (CURRY-1, CURRY-2). In a pipe the attached
things fill first and the piped thing fills the rest (CURRY-4).

```punk
timesTwo:*![2]
4 > timesTwo!
```
**`8`**

```punk
4 > -!8 > *!7
```
**`28`**

This is the same as

```punk
*![-![8 4] 7]
```
**`28`**

## Higher order functions

The function comes first and the data last, so a partly applied
function is a pipeline stage (HOF-1). A predicate counts as true only
when it returns `TRUE` (HOF-5).

```punk
double:*![2]
[1 2 3] > map!double?
```
**`[2 4 6]`**

```punk
[1 2 3 4] > filter!(n:_)[gt![.n? 2]]
```
**`[3 4]`**

A function is passed by reference with `?`, as in `map!double?`. A bare word is just text (HOF-8).

The function can ask for more than the item (HOF-9). With two parameters it also gets the key (the name of a named item, or `[]`), and with three it also gets the position, starting at 1. A function with `#` gets all three.

```punk
[a:1 b:2] > map!(v:_ k:_ i:_)[{k?}-{v?}-{i?}]
```
**`[a-1-1 b-2-2]`**

`reduce` calls its function with `[accumulator item]` (HOF-4).

```punk
[1 2 3 4] > reduce![+? 0]
```
**`10`**

Each item is one value, so a record can be taken whole and queried.

```punk
todos:[[note:milk done:FALSE] [note:code done:TRUE] [note:sleep done:FALSE]]
isOpen:(t:_)[=![t.done? FALSE]]
noteOf:(t:_)[t.note?]
todos? > filter!isOpen? > map!noteOf?
```
**`[milk sleep]`**

## Library behaviour

Numeric functions treat a non-number as 0 and division by zero gives the
non-thing (LIB-5, LIB-6).

```punk
+![1 x]
```
**`1`**

```punk
\![5 0]
```
**`[]`**

Equality is deep and structural, and a thing equals its single-element
wrapping (LIB-4, GRP-6).

```punk
=![[a b:1] [a b:1]]
```
**`TRUE`**

Library functions never change their input (LIB-3).

```punk
x:[b a]
sort!x?
x?
```
**`[b a]`**

## Errors

Syntax errors are the only errors. They stop the program and report the
position (ERR-1).

```punk
(_ _
```
**`unclosed '(' (line 1, col 1)`**

Everything else evaluates to the non-thing (ERR-3).

```punk
nope!x
```
**`[]`**

## Comments

`##` starts a comment that runs to the end of the line.

```punk
x:[a ## this is ignored
b]
x?
```
**`[a b]`**

## Escapes

A `\` makes the next character plain text, so reserved symbols can be used inside words. `\n` is a newline and `\t` is a tab. A space cannot be escaped.

```punk
a\:b
```
**`a:b`**

A `\` at the start of a word followed by `!` is the division function (`\![6 3]`).

## Atoms

An atom is a global place to keep state that changes while a program runs. Write one with a pipe and read it by naming it.

```punk
[1 2] > @list!
@list
```
**`[1 2]`**

An atom that has never been written is `[]`.

```punk
@nothingYet
```
**`[]`**

Writing returns the stored thing, so a counter is a pipe from the atom back into itself.

```punk
1 > @count!
@count > +![5] > @count!
@count
```
**`6`**

## Modules

`import!name` evaluates the file `name.punk` (beside your program, then in the `lib` folder) and returns everything it names. Name the result and query it.

```punk
http:import!punk.http
http.parseForm!a=1&b=hello+x
```
**`[a:1 b:hello x]`**

A module is evaluated once. It cannot see the importer's names. A missing module is `[]`.

The `lib` folder holds `punk.http` (response and form helpers) and `punk.html`. In `punk.html` code is data: an element is a named function that is never called. Its name is the tag, its pattern holds the attributes and its body holds the children. The library reads them with `patternOf` and `bodyOf`.

```punk
html:import!punk.html
html.page![head:()[title:()[My page]] body:()[h1:(color:red)[Welcome]]]
```
**`<!DOCTYPE html><html lang="en"><head><title>My page</title></head><body><h1 color="red">Welcome</h1></body></html>`**

The core library provides `serve` to run a server. It parses a form post's body into named things, so a handler can query it as `body.note?`. `examples/server.punk` is a todo web app written in Punk.

## Running Punk

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
