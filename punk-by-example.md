# Punk by Example

Punk is a functional programming language. It only has one type which is a Thing. Lists of Things can be defined which is also a Thing. Punk has no keywords only special symbols.

## 1. The simplest expressions

A literal Thing — a word, a number, a boolean — just *is* itself. Writing
one as an expression evaluates to that Thing. In the examples below the
line with `⏎` is what you'd type at a REPL; the next line is the result.

```punk
> hello ⏎
hello
```

```punk
> 42 ⏎
42
```

```punk
> TRUE ⏎
TRUE
```

```punk
> FALSE ⏎
FALSE
```

```punk
> NULL ⏎
NULL
```

Numbers use European-style decimals — the comma is the separator, because
the `.` character is reserved for dereferencing (introduced in §2):

```punk
> 3,14 ⏎
3.14
```

## 2. Binding and dereferencing

`name:value` binds `name` to `value`. After that, a bare `name` is still
just the literal Thing `name` — to retrieve the value bound to it, you have
to *dereference* it with a postfix `.`:

```punk
> name:Alice
> name ⏎
name
```
(still the literal Thing `name`)

```punk
> name:Alice
> name. ⏎
Alice
```
(the value bound to `name`)

This is the single most important rule in Punk. The `.` doesn't "say"
anything about types or scope; it just means **"dereference one step."**
Every step in a chain — and there are no exceptions — works the same way.
We'll see this repeatedly.

## 3. Calling functions

A function call is written with `!`. Read `name!arg` as: "call `name` with
`arg`." The `!` does two jobs in one character — it dereferences the name
on its left, and it applies the resulting function to the argument on its
right. `log` is the built-in that prints a Thing:

```punk
> log!hello ⏎
hello
```

When a function needs more than one Thing, pass them as a list — the `[…]`
on the right of `!` is just a list literal serving as the single argument:

```punk
> log![hello world] ⏎
hello world
```

From here on we'll usually omit `log!` and just write the expression — the
line marked with `⏎` is what you'd type into a REPL, and the next line is
the result. `log!` only appears when we specifically want to talk about
printing or about chaining calls.

## 4. Arithmetic

Math functions live in the `math` namespace. Reaching into a namespace is
itself just dereferencing: `math.add` is the value of `add` *inside* `math`.
The trailing `!` then calls it.

```punk
> math.add![5 3] ⏎
8
```

```punk
> math.sub![10 4] ⏎
6
```

```punk
> math.mul![6 7] ⏎
42
```

```punk
> math.div![20 4] ⏎
5
```

```punk
> math.pow![2 8] ⏎
256
```

```punk
> math.mod![10 3] ⏎
1
```

Notice the chain `math.add!…`: the `.` dereferences `math` (giving the
namespace), and the `!` then dereferences `add` *by calling it*. The whole
thing is one chain of two steps, each terminated by its own operator. This
is the same uniform rule from §2 — `.` reads, `!` calls.

A few `math` functions accept a variable number of arguments rather than a
single list:

```punk
> math.min![3 1 4 1 5] ⏎
1
```

```punk
> math.max![3 1 4 1 5] ⏎
5
```

## 5. Text

Text functions live in the `text` namespace. Like `math`, they're free
functions; there are no string methods.

```punk
> text.upper!hello ⏎
HELLO
```

```punk
> text.lower!BOB ⏎
bob
```

When a function needs more than one Thing, pass them as a list:

```punk
> text.split![[a,b,c] ,] ⏎
[a b c]
```

```punk
> text.join![[John Doe] \ ] ⏎
John Doe
```

```punk
> text.join![[a b c] [, ]] ⏎
a,b,c
```

The `\ ` in the `join` call is a literal space (more on escaping in §12).

## 6. Comparisons and logic

The `logic` namespace gives you ordering, equality, and boolean
combinators. Equality is deep — two lists compare equal when their
contents do. Truthiness is simple: `NULL` and `FALSE` are falsy, and
every other Thing (including `0`, the empty list, and arbitrary atoms)
is truthy.

```punk
> logic.gt![10 5] ⏎
TRUE
```

```punk
> logic.lt![3 8] ⏎
TRUE
```

```punk
> logic.eq![5 5] ⏎
TRUE
```

```punk
> logic.gt![xyz abc] ⏎
TRUE
```
(alphanumeric order)

```punk
> logic.eq![[1 2 3] [1 2 3]] ⏎
TRUE
```
(deep equality)

```punk
> logic.not!FALSE ⏎
TRUE
```

```punk
> logic.not!hello ⏎
FALSE
```
(any non-`NULL`/non-`FALSE` Thing is truthy)

`logic.and!` and `logic.or!` are variadic — pass any number of Things
in a list. Empty `and` is `TRUE` and empty `or` is `FALSE` (their
identity values).

```punk
> logic.and![TRUE TRUE TRUE] ⏎
TRUE
```

```punk
> logic.and![TRUE FALSE TRUE] ⏎
FALSE
```

```punk
> logic.or![FALSE NULL hello] ⏎
TRUE
```

## 7. Lists

A list is a single Thing that contains other Things, written with `[ ]`.
Lists can hold unnamed Things, named Things (using `name:value` inside the
list), or other lists.

```punk
> [1 2 3] ⏎
[1 2 3]
```

```punk
> [Alice Bob Charlie] ⏎
[Alice Bob Charlie]
```

A named Thing inside a list lets you treat the list like an associative
record:

```punk
> person:[name:Alice age:30]
> person.name. ⏎
Alice
```

```punk
> person:[name:Alice age:30]
> person.age. ⏎
30
```

Read `person.name.` as: **dereference `person`**, then **dereference
`name`** on the result. Two steps, each terminated by a `.`.

## 8. Indexing lists

Numeric indexing follows the same rule as everything else: each step ends
with `.` (or `!`/`<`/`>` if you're calling or accessing a cell). There is
no special "index sugar" — `0`, `1`, `~` (last) are just names for steps,
and they need a terminator like any other name:

```punk
> numbers:[10 20 30]
> numbers.0. ⏎
10
```

```punk
> numbers:[10 20 30]
> numbers.1. ⏎
20
```

```punk
> numbers:[10 20 30]
> numbers.~. ⏎
30
```
(`~` means "last")

The same form applies to literal lists — there's nothing special about
having a name vs a literal on the left:

```punk
> [10 20 30].0. ⏎
10
```

```punk
> [10 20 30].~. ⏎
30
```

Named access works alongside indexed access. When two items share a name,
the last one wins:

```punk
> [person:John person:Tim].person. ⏎
Tim
```

Chains compose by adding steps. Read each step left-to-right:

```punk
> [[1 2] [3 4] [5 6]].0.0. ⏎
1
```

```punk
> [[1 2] [3 4] [5 6]].~.~. ⏎
6
```

```punk
> [[name:Tim age:44] [name:John age:30]].0.name. ⏎
Tim
```

## 9. List operations

The `list` namespace contains the usual collection operations. They're free
functions that take the list and any other arguments — no methods.

Length, concatenation, ranges, and slices:

```punk
> list.len![[1 2 3 4]] ⏎
4
```

```punk
> list.concat![[1 2] [3 4]] ⏎
[1 2 3 4]
```

```punk
> list.range![1 6 1] ⏎
[1 2 3 4 5]
```

```punk
> list.range![0 10 2] ⏎
[0 2 4 6 8]
```

```punk
> list.slice![[0 1 2 3 4 5] 0 3] ⏎
[0 1 2]
```

```punk
> list.slice![[0 1 2 3 4 5] 2 4] ⏎
[2 3]
```

Search:

```punk
> list.find![[1 2 3] 2] ⏎
1
```
(index of first match)

```punk
> list.contains![[1 2 3] 2] ⏎
TRUE
```

`map`, `filter`, and `reduce` all take a function as one of their
arguments. We'll define proper functions in the next section; for now, here
they are as inline anonymous functions. `(name:_)` is a pattern that
matches a single Thing and binds it to `name`; inside the body `name.`
dereferences that bound value:

```punk
> list.map![
    [1 2 3]
    (n:_)[math.mul![n. 2]]
  ] ⏎
[2 4 6]
```

```punk
> list.filter![
    [1 2 3 4]
    (n:_)[logic.eq![math.mod![n. 2] 0]]
  ] ⏎
[2 4]
```

`reduce`'s function is called with two Things — the accumulator and the
next element — so it uses the pattern `(acc:_ item:_)` and dereferences
the bindings by name:

```punk
> list.reduce![
    [1 2 3 4]
    (acc:_ item:_)[math.add![acc. item.]]
    0
  ] ⏎
10
```

## 10. Functions

A function is written `(pattern)[body]`. The pattern declares what input
the function accepts **and names each piece** so the body can refer to it;
every parameter slot uses `(name:_)` for one Thing or `(name:*)` for a run
of Things. The body is a sequence of expressions evaluated in order, and
the call's value is the **value of the last expression** (Clojure-style).
Earlier expressions run for their side effects and any name bindings they
introduce.

A function over a single argument names it once and dereferences with
`name.`:

```punk
> double:(n:_)[math.mul![n. 2]]
> double!5 ⏎
10
```

Earlier expressions can prepare values that the last expression uses:

```punk
> compute:(x:_)[
    y:math.add![x. 1]
    math.mul![y. 10]
  ]
> compute!4 ⏎
50
```

A function over two arguments gives each one a name:

```punk
> add:(a:_ b:_)[math.add![a. b.]]
> add![5 3] ⏎
8
```

A `*` slot in the pattern matches any number of Things (zero or more).
You can name it (`(xs:*)`) and dereference with `xs.` — but `*.` is also
**always** available inside any function body and yields the full argument
as a List, even when the pattern uses positional named params:

```punk
> all:(*)[*.]
> all![a b c] ⏎
[a b c]
```

```punk
> pairAll:(a:_ b:_)[*.]
> pairAll![1 2] ⏎
[1 2]
```

For a function whose pattern is just `(*)` (no named slots), `*.` is the
only way to reach the input.

Functions are first-class values. Dereferencing a function name with `.`
gives you the function itself (suitable for passing as an argument); using
`!` instead *calls* it:

```punk
> double:(n:_)[math.mul![n. 2]]
> list.map![[1 2 3] double.] ⏎
[2 4 6]
```

You don't have to bind a function to a name. Anonymous functions are
written the same way, and dropped in where you need them:

```punk
> list.map![[1 2 3] (n:_)[math.pow![n. 2]]] ⏎
[1 4 9]
```

## 11. Pattern matching

Patterns describe shapes that a value either matches or doesn't. They're
written with `( )`. Inside a pattern, `_` matches any single Thing, `*`
matches any run of Things, and any literal matches itself.

```punk
isTim:(Tim)             # matches exactly the Thing `Tim`
isFive:(5)              # matches the number 5
isPair:(_ _)            # matches any 2-element list
startsWithThree:(3 *)   # matches any list starting with 3
```

### 11a. Conditionals — `?`

Punk's `?` is **pattern-first**, mirroring `fn!arg`: the pattern goes
on the left, the value to test on the right. Its shape decides what it
does:

| Form | Returns |
| --- | --- |
| `pattern?value` | `TRUE` or `FALSE` (predicate) |
| `pattern?[value]` | `TRUE` or `FALSE` (equivalent) |
| `pattern?[value then]` | `then` if matched, `NULL` otherwise |

There's no third "else" slot — use `??` when you need branches for both
outcomes.

Predicate form:

```punk
> isFive:(5)
> isFive?5 ⏎
TRUE
```

```punk
> isFive:(5)
> isFive?3 ⏎
FALSE
```

Match-or-null:

```punk
> isFive:(5)
> isFive?[5 yes] ⏎
yes
```

```punk
> isFive:(5)
> isFive?[3 yes] ⏎
NULL
```

The `then` slot is evaluated **lazily** — it only runs on a match, so
side effects in a non-matching branch don't fire. For a multi-step
branch, wrap statements in `[…]!` and the last expression becomes the
branch's value:

```punk
> isFive:(5)
> isFive?[5 [log!matched math.mul![5 2]]!] ⏎
matched
10
```

To test a pattern against a list value (which would otherwise look like
match-form), bind the value to a name first:

```punk
> isPair:(_ _)
> pair:[1 2]
> isPair?pair. ⏎
TRUE
```

Patterns are referenced by name (e.g. `isFive`) so the parser can tell
them apart from inline functions. An inline `(pattern)[…]` is parsed as a
function literal, not as a conditional, so bind patterns to a name first.

### 11b. Multiple patterns — `??`

For matching against several patterns at once, use
`value??[[pattern1 result1] [pattern2 result2] …]`. Cases are tried in
order, the first match wins, and a non-match falls through to `NULL`.
Each `result` is held lazily and only evaluated if its pattern matches.
A case may also be written as a single-element `[pattern]` — a match
stops the search but yields `NULL` (no body to run); a trailing `[_]`
acts as a "swallow anything else" catch-all that also returns `NULL`.

```punk
> wild:(_)
> classify:(x:_)[
    x.??[
      [1 one]
      [2 two]
      [wild. other]
    ]
  ]
> classify!1 ⏎
one
```

```punk
> wild:(_)
> classify:(x:_)[
    x.??[
      [1 one]
      [2 two]
      [wild. other]
    ]
  ]
> classify!9 ⏎
other
```

A case with no body matches and stops, returning `NULL`:

```punk
> isOne:(1)
> 1??[[isOne.][_ other]] ⏎
NULL
```

```punk
> isOne:(1)
> 9??[[isOne.][_ other]] ⏎
other
```

## 12. Escaping special characters

Punk uses a handful of characters for syntax: `.`, `:`, `!`, `?`, `[`, `]`,
`(`, `)`, `{`, `}`, `<`, `>`, `_`, `*`, `~`, `#`, `/`, and `\`. To put any
of these inside a Thing's value, prefix each occurrence with `\`:

```punk
> \. ⏎
.
```

```punk
> \/ ⏎
/
```

```punk
> \\ ⏎
\\
```

```punk
> [Hello \. world\.] ⏎
[Hello . world.]
```

Each occurrence is escaped individually — `\.\.\.` is three full stops.

## 13. Mutable cells

Punk's bindings are immutable: `name:value` doesn't change a previous
binding, it creates a new one. When you genuinely need mutation, use a
*cell*. A cell holds a single value that can be replaced.

Create a cell with `{ }`, read it with `>`, write to it with `<`:

```punk
> counter:{0}
> counter> ⏎
0
```

```punk
> counter:{0}
> counter<5
> counter> ⏎
5
```

```punk
> counter:{0}
> counter<5
> counter<math.add![counter> 1]
> counter> ⏎
6
```

The cell terminators (`>` and `<`) are dereference-step terminators just
like `.` and `!` — they fit the same uniform rule.

## 14. Data, code, and `[…]!`

A `[ ]` written in source is **always** just data. Its contents are not
executed simply because they're written down — they're held as values.
Active forms inside a list (calls, dereferences, conditionals) only run
when something applies `!` to the containing list.

```punk
> held:[log![hi]] ⏎
```
(nothing runs — the list is held as data)

```punk
> held:[log![hi]]
> held! ⏎
hi
```
(the list is evaluated as a body)

```punk
> [log![hi]]! ⏎
hi
```
(literal list applied directly)

This is also why top-level statements run at all: a Punk source file is
evaluated as if the whole file were wrapped as `[file contents]!` — a
zero-argument anonymous list applied to itself.

The upshot: code and data look the same in source. The choice between
"data" and "code" is made at the point of use.

---

## Quick Reference

```punk
name:value                         # bind
name.                              # dereference
[item1 item2 item3]                # list
[name:value]                       # named thing in list
list.0.                            # index 0 (every step ends with `.`/`!`/`<`/`>`)
list.~.                            # last
list.name.                         # by name
[1 2 3].0.                         # same rule for literal lists
function!argument                  # call (implicitly dereferences)
function.                          # reference to the function itself
pattern?value                      # predicate → TRUE | FALSE
pattern?[value then]               # match or NULL
value??[[p1 r1] [p2] [_ r3] [_]]   # multi-pattern match (bare [p] = match,no-op,NULL)
(name:_)[body]                     # anonymous function (named parameter)
*.                                 # inside a body: the full argument as a list
{value}  name>  name<v             # cell create / read / write
#text#                             # comment
```

## Core Principles

1. **Everything is a Thing** — values, lists, functions are all Things.
2. **Lists are single Things** — from the outside, a list is one Thing.
3. **A bare name is data; `.` dereferences.**
4. **Every dereference step ends with `.`, `!`, `<`, or `>`** — one uniform rule.
5. **`.` only ever dereferences** — every parameter must be named
   (`(name:_)`) and referenced as `name.`; there is no bare `.` for an
   implicit parameter.
6. **A body returns its last expression's value** (Clojure-style) — earlier
   expressions run for their side effects and any bindings they introduce.
7. **Functions take one Thing** — pass a list when you need multiple values.
8. **Immutable by default** — names rebind; cells (`{ }`) opt into mutability.
9. **Pattern matching is the primary control-flow mechanism.**
10. **Namespaced libraries** — `math`, `list`, `text`, `logic`, `file`.
11. **Whitespace matters** — no space between a name and its postfix `.`.
