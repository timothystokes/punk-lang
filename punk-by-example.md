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
the `.` character is reserved for dereferencing {introduced in §2}:

```punk
> 3,14 ⏎
3,14
```

## 2. Binding and dereferencing

`name:value` binds `name` to `value`. After that, a bare `name` is still
just the literal Thing `name` — to retrieve the value bound to it, you have
to *dereference* it with a postfix `.`:

```punk
> name:Alice ⏎
> name. ⏎
Alice
```
{the value bound to `name`. Without the trailing `.`, `name` would just
be the literal Thing `name` again — binding doesn't change what a bare
word means, only what `.` retrieves.}

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

When a function needs more than one Thing, pass them as a list — the `(…)`
on the right of `!` is just a list literal serving as the single argument:

```punk
> log!(hello world) ⏎
hello world
```

From here on we'll usually omit `log!` and just write the expression — the
line marked with `⏎` is what you'd type into a REPL, and the next line is
the result. `log!` only appears when we specifically want to talk about
printing or about chaining calls.

## 4. Arithmetic

Math functions are plain top-level Things — no namespace. They're bound
to one-character symbol names: `+!` adds, `-!` subtracts, `*!` multiplies,
`/!` divides, `^!` raises to a power, `%!` is modulo. {The same applies
to `<!`, `>!`, `=!` for comparisons.}

```punk
> +!(5 3) ⏎
8
```

```punk
> -!(10 4) ⏎
6
```

```punk
> *!(6 7) ⏎
42
```

```punk
> /!(20 4) ⏎
5
```

```punk
> ^!(2 8) ⏎
256
```

```punk
> %!(10 3) ⏎
1
```

A few math functions accept a variable number of arguments rather than a
single list:

```punk
> min!(3 1 4 1 5) ⏎
1
```

```punk
> max!(3 1 4 1 5) ⏎
5
```

## 5. Text

Text functions are just plain top-level Things — there are no namespaces
and no string methods.

```punk
> upper!hello ⏎
HELLO
```

```punk
> lower!BOB ⏎
bob
```

When a function needs more than one Thing, pass them as a list:

```punk
> split!(a,b,c ,) ⏎
(a b c)
```

```punk
> join!((John Doe) -) ⏎
John-Doe
```

```punk
> join!((a b c) ,) ⏎
a,b,c
```

The first `join` uses `-` as the separator, producing one Thing `John-Doe`.
There's no way to embed a literal space inside a Thing — multi-word text
is naturally a list, e.g. `(John Doe)`.

Punk doesn't have a separate "string" type — text is just a Thing, no
different from any other. The list builtins (`slice!`, `sort!`, `prep!`,
`concat!`, `find!`, `contains!`, `map!`, `filter!`, `len!`) are polymorphic:
hand them a text Thing or a number and they auto-decompose into chars/digits,
do the work, and rewrap to the same shape — no manual `split!`/`join!`:

```punk
> slice!(hello 0~1) ⏎
he
> slice!(12345 1~2) ⏎
23
> sort!hello ⏎
ehllo
> prep!(W hello) ⏎
Whello
> concat!(foo bar) ⏎
foobar
> find!(hello l) ⏎
2
> contains!(hello e) ⏎
TRUE
> map!(upper. abc) ⏎
ABC
> len!hello ⏎
5
```

`split!` and `join!` are still around for when you actually want the list
form (e.g. for `reduce!`):

```punk
> split!hello ⏎
(h e l l o)
> join!(h e l l o) ⏎
hello
```

`startsWith` falls out of the same building blocks — note `slice!` accepts
both `Range` (inclusive) and `(start endExcl)` for computed bounds:

```punk
> startsWith:{s:_ p:_}(=!(slice!(s. 0 len!p.) p.)) ⏎
```

```punk
> startsWith!(hello he) ⏎
TRUE
```

Only ops that genuinely don't decompose into list work — `upper`, `lower`,
`trim`, `split`, `join`, `replace` — stay as their own builtins.

## 6. Comparisons and logic

Ordering, equality, and boolean combinators are plain top-level functions.
Equality is deep — two lists compare equal when their contents do.
Truthiness is simple: `NULL` and `FALSE` are falsy, and every other Thing
{including `0`, the empty list, and arbitrary atoms} is truthy.

```punk
> >!(10 5) ⏎
TRUE
```

```punk
> <!(3 8) ⏎
TRUE
```

```punk
> =!(5 5) ⏎
TRUE
```

```punk
> >!(xyz abc) ⏎
TRUE
```
{alphanumeric order}

```punk
> =!((1 2 3) (1 2 3)) ⏎
TRUE
```
{deep equality}

```punk
> not!FALSE ⏎
TRUE
```

```punk
> not!hello ⏎
FALSE
```
{any non-`NULL`/non-`FALSE` Thing is truthy}

`and!` and `or!` are variadic — pass any number of Things
in a list. Empty `and` is `TRUE` and empty `or` is `FALSE` {their
identity values}.

```punk
> and!(TRUE TRUE TRUE) ⏎
TRUE
```

```punk
> and!(TRUE FALSE TRUE) ⏎
FALSE
```

```punk
> or!(FALSE NULL hello) ⏎
TRUE
```

## 7. Lists

A list is a single Thing that contains other Things, written with `( )`.
Lists can hold unnamed Things, named Things {using `name:value` inside the
list}, or other lists.

```punk
> (1 2 3) ⏎
(1 2 3)
```

```punk
> (Alice Bob Charlie) ⏎
(Alice Bob Charlie)
```

A named Thing inside a list lets you treat the list like an associative
record:

```punk
> person:(name:Alice age:30) ⏎
> person.name. ⏎
Alice
```

```punk
> person:(name:Alice age:30) ⏎
> person.age. ⏎
30
```

Read `person.name.` as: **dereference `person`**, then **dereference
`name`** on the result. Two steps, each terminated by a `.`.

## 8. Indexing lists

Numeric indexing follows the same rule as everything else: each step ends
with `.` {or `!`/`<`/`>` if you're calling or accessing a cell}. There is
no special "index sugar" — `0`, `1`, `~` {last} are just names for steps,
and they need a terminator like any other name:

```punk
> numbers:(10 20 30) ⏎
> numbers.0. ⏎
10
```

```punk
> numbers:(10 20 30) ⏎
> numbers.1. ⏎
20
```

```punk
> numbers:(10 20 30) ⏎
> numbers.~. ⏎
30
```
{`~` means "last"}

The same form applies to literal lists — there's nothing special about
having a name vs a literal on the left:

```punk
> (10 20 30).0. ⏎
10
```

```punk
> (10 20 30).~. ⏎
30
```

Named access works alongside indexed access. When two items share a name,
the last one wins:

```punk
> (person:John person:Tim).person. ⏎
Tim
```

Chains compose by adding steps. Read each step left-to-right:

```punk
> ((1 2) (3 4) (5 6)).0.0. ⏎
1
```

```punk
> ((1 2) (3 4) (5 6)).~.~. ⏎
6
```

```punk
> ((name:Tim age:44) (name:John age:30)).0.name. ⏎
Tim
```

Postfix indexing is polymorphic: text and numbers drill down to
characters/digits, so the same `.0.` / `.~.` / `.N~M.` chain works at
every level.

```punk
> word:Steve ⏎
Steve
> word.0. ⏎
S
> word.~. ⏎
e
> word.1~3. ⏎
tev
> (Tim Bob).0.0. ⏎
T
```

## 9. List operations

The usual collection operations are plain top-level functions that take
the list and any other arguments — no methods, no namespaces.

Length, concatenation, ranges, and slices:

```punk
> len!(1 2 3 4) ⏎
4
> len!hello ⏎
5
> len!42 ⏎
2
> len!1~5 ⏎
5
> len!1~ ⏎
INFINITE
```

```punk
> concat!((1 2) (3 4)) ⏎
(1 2 3 4)
```

```punk
> slice!((0 1 2 3 4 5) 0~2) ⏎
(0 1 2)
```

```punk
> slice!((0 1 2 3 4 5) 2~3) ⏎
(2 3)
```

`slice!` also accepts the JS-style `(list start endExclusive)` form for when
the bounds are computed at runtime: `slice!(xs 0 n.)` keeps the first `n.`
items without writing `0~-!(n. 1)`.

Search:

```punk
> find!((1 2 3) 2) ⏎
1
```
{index of first match}

```punk
> contains!((1 2 3) 2) ⏎
TRUE
```

`map`, `filter`, and `reduce` all take a function as one of their
arguments. We'll define proper functions in the next section; for now, here
they are as inline anonymous functions. `{_}` is a pattern that matches a
single Thing; inside the body `_.` dereferences it. {For named parameters,
use `{name:_}` and dereference with `name.`.}

```punk
> map!(
    {_}(*!(_. 2))
    (1 2 3)
  ) ⏎
(2 4 6)
```

```punk
> filter!(
    {_}(=!(%!(_. 2) 0))
    (1 2 3 4)
  ) ⏎
(2 4)
```

`reduce`'s function is called with two Things — the accumulator and the
next element — so it uses the pattern `{acc:_ item:_}` and dereferences
the bindings by name. Argument order is **fn, init, list** {Clojure-style}:

```punk
> reduce!(
    {acc:_ item:_}(+!(acc. item.))
    0
    (1 2 3 4)
  ) ⏎
10
```

### The Lisp spine: `.0.` / `.1~.` / `prep`

Three primitives are enough to walk and rebuild any list. `xs.0.` returns
the first element; `xs.1~.` returns the rest as a list; `prep!` puts an
item back on the front. Slice sugar generalises: `xs.N~.` is the tail from
index N, `xs.N~M.` is the inclusive range, `xs.~M.` is everything up to and
including M.

```punk
> (a b c).0. ⏎
a
> (a b c).1~. ⏎
(b c)
> prep!(z (a b c)) ⏎
(z a b c)
> ().1~. ⏎
()
> (10 20 30 40 50).1~3. ⏎
(20 30 40)
```

These compose nicely with recursion. Here's a hand-written `sum`:

```punk
sum:{_}(
  len!_.?(
    {0}(0)
    {_}(+!(_.0. sum!(_.1~.)))
  )
)
> sum!((1 2 3 4 5)) ⏎
15
> sum!(1~100) ⏎
5050
```

### Range literals: `N~M`

The same `~` is a value-level operator. `N~M` evaluates to the inclusive
integer list `(N N+1 … M)`; a reversed range is empty.

```punk
> 1~5 ⏎
(1 2 3 4 5)
> 0~0 ⏎
(0)
> 5~1 ⏎
()
> -2~2 ⏎
(-2 -1 0 1 2)
> map!({_}(*!(_. _.)) 1~4) ⏎
(1 4 9 16)
```

Open forms (`1~`, `~5`, `~`) are lazy and only legal where context provides
a bound — for example as the key in a postfix dereference. Forcing an
unbounded range as a standalone value errors with *"Cannot force an
unbounded range"*.

### Pipeline `|`

`a | f.` is exactly the same as `f!a`, but reads left-to-right. The
trailing `.` on each stage hands over the function **value** to the
pipe {same rule as `map!(f. xs)`}, and the pipe itself performs the
call with the LHS as a single argument:

```punk
> hello | split. | head. ⏎
h
> (1 2 3) | len. ⏎
3
```

`|` is a standalone token, so whitespace either side is optional —
write it however reads best:

```punk
> hello|split.|head. ⏎
h
> hello | split. | head. ⏎
h
> hello  |  split.  |  head. ⏎
h
```

`a | f. | g.` means `g!{f!a}`. For multi-argument stages, wrap in a
lambda: `5 | {_}(+!(_. 10)).`.

A stage can be any expression that evaluates to a function value, not
just a bare deref. So `a | getFn!key` is fine when `getFn!key` returns
a callable — the pipe takes that value and applies it to `a`.

### Pipe-fn binding `name:|`

A pipeline that's missing its left-hand value is a function value
waiting for one. Binding it with `name:|` — `:` and the first `|`
**tight together, no space** — names that deferred pipeline. Subsequent
`|`s follow normal pipeline spacing.

```punk
> twice:|inc.|inc. ⏎
> twice!5 ⏎
7
> twice!100 ⏎
102
```

It composes named functions and partials freely, and the result is a
first-class function value — usable wherever a function value goes
{`map!`, `?` branches, other pipelines, …}.

```punk
> flow:|inc.|*'2.|+'1. ⏎
> flow!3 ⏎
9
> map!(twice. (1 2 3)) ⏎
(3 4 5)
> 5?twice. ⏎
7
```

A single stage is allowed {it just aliases the function}:

```punk
> flip:|inc. ⏎
> flip!5 ⏎
6
```

Two rules to keep it unambiguous:

- `:` and the first `|` must be adjacent — `x: |f.` is rejected.
- At least one stage is required — `x:|` is rejected.

## 10. Functions

A function is written `{pattern}(body)`. The pattern declares what input
the function accepts and {optionally} names each piece so the body can
refer to it. A slot can be `{_}` {anonymous one-Thing}, `{name:_}` {named
one-Thing}, `{___}` {anonymous variadic — three underscores, zero or
more Things}, or `{name:___}` {named variadic}. The body is a sequence
of expressions evaluated in order, and the call's value is the **value
of the last expression** {Clojure-style}. Earlier expressions run for
their side effects and any name bindings they introduce.

A function over a single argument uses `{_}` and dereferences with `_.`:

```punk
> double:{_}(*!(_. 2)) ⏎
> double!5 ⏎
10
```

Earlier expressions can prepare values that the last expression uses:

```punk
> compute:{_}(
    y:+!(_. 1)
    *!(y. 10)
  ) ⏎
> compute!4 ⏎
50
```

A function over two arguments gives each one a name:

```punk
> add:{a:_ b:_}(+!(a. b.)) ⏎
> +!(5 3) ⏎
8
```

A `___` slot in the pattern matches any number of Things {zero or more}.
You can name it {`{xs:___}`} and dereference with `xs.`.

Every function body also has `_` implicitly bound to the **raw argument
as passed** — scalar stays scalar, list stays list. That means you can
skip naming altogether for the simplest cases:

```punk
> processOne:{_}(_.) ⏎
> processOne!hello ⏎
hello

> processTwo:{_ _}(+!(_.0. _.1.)) ⏎
> processTwo!(3 4) ⏎
7

> processN:{___}(len!_.) ⏎
> processN!(a b c) ⏎
3

> processAandN:{a:_ ___}(+!(a. len!_.)) ⏎
> processAandN!(10 b c) ⏎
13
```

`_.` is **always** available inside any function body, even when the
pattern uses positional named params:

```punk
> pairAll:{a:_ b:_}(_.) ⏎
> pairAll!(1 2) ⏎
(1 2)
```

Functions are first-class values. Dereferencing a function name with `.`
gives you the function itself {suitable for passing as an argument}; using
`!` instead *calls* it:

```punk
> double:{_}(*!(_. 2)) ⏎
> map!(double. (1 2 3)) ⏎
(2 4 6)
```

You don't have to bind a function to a name. Anonymous functions are
written the same way, and dropped in where you need them:

```punk
> map!({_}(^!(_. 2)) (1 2 3)) ⏎
(1 4 9)
```

Templsting is easy using . dereferences and passed in data.

```punk
> {name:_ age:_}(Name is name.)!(Bob 42) ⏎
(Name is Bob and their age is 42)
```

## 11. Partial application `'`

`'` mirrors `!` but pre-binds args instead of invoking. A later `!`
call extends those args and runs the function.

```punk
> addTen:+'10 ⏎
> addTen!5 ⏎
15
> addTen!90 ⏎
100
```

Multiple positions in one go with the args-list form:

```punk
> add3:{a:_ b:_ c:_}(+!(a. +!(b. c.))) ⏎
> add12:add3'(1 2) ⏎
> add12!10 ⏎
13
```

Partials can be further partialled by name:

```punk
> addOne:add3'1 ⏎
> twoPlus:addOne'2 ⏎
> twoPlus!7 ⏎
10
```

`!` always invokes — under-arity on a fixed-arity function is an error.
Reach for `'` explicitly when you want to defer the call.

The list builtins `map!`/`filter!`/`reduce!`/`flatMap!` take the
**function first**, then the data — so partials over them build reusable
transformers naturally:

```punk
> incAll:map'{_}(+!(_. 1)) ⏎
> incAll!(1 2 3) ⏎
(2 3 4)

> sum:reduce'(+. 0) ⏎
> sum!(1 2 3 4 5) ⏎
15
```

## 12. Pattern matching

Patterns describe shapes that a value either matches or doesn't. They're
written with `{ }`. Inside a pattern, `_` matches any single Thing, `___`
{three underscores} matches any run of Things, and any literal matches
itself.

```punk
isTim:{Tim}              # matches exactly the Thing `Tim`
isFive:{5}               # matches the number 5
isPair:{_ _}             # matches any 2-element list
startsWithThree:{3 ___}  # matches any list starting with 3
```

### 11. Dispatch — `?`

Punk's `?` is **value-first**: the value to dispatch on is on the left,
and the right is one or more **function values** used as branches. Each
branch's pattern is tested against the value in order; the first match
wins and runs (its body sees the matched bindings). No match → `NULL`.

| Form | Meaning |
| --- | --- |
| `value?fn.` | single branch — function ref |
| `value?{pat}(body)` | single branch — inline function literal |
| `value?(fn1 fn2 fn3)` | ordered list of branches |

Single branch with a literal pattern:

```punk
> 5?{5}(yes) ⏎
yes
```

```punk
> 3?{5}(yes) ⏎
NULL
```

Multi-branch — wildcard as a catch-all:

```punk
> classify:{_}(
    _.?(
      {1}(one)
      {2}(two)
      {_}(other)
    )
  ) ⏎
> classify!1 ⏎
one
> classify!9 ⏎
other
```

If/else falls out for free: a literal-match branch plus a wildcard.

```punk
> v:TRUE ⏎
> v.?({TRUE}(yes) {_}(no)) ⏎
yes
```

`?` is a standalone token — whitespace either side is optional. Drop
the spaces for terse code, keep them for emphasis:

```punk
> 5?{5}(yes) ⏎
yes
> 5 ? {5}(yes) ⏎
yes
> 5 ? ( {1}(one) {5}(five) {_}(other) ) ⏎
five
```

Branches are real function values, so:

- their pattern bindings are visible inside the body
  (e.g. `{n:_}(n.)` returns whatever was matched);
- a tail-position self-call inside a branch trampolines;
- branches can be named functions, inline literals, or dereferences
  of any expression that evaluates to one.

```punk
> yes:{1}(one) ⏎
> no:{_}(other) ⏎
> dispatch:{_}(_.?(yes. no.)) ⏎
> dispatch!1 ⏎
one
> dispatch!9 ⏎
other
```

### Regex slots

A pattern slot can be a regex literal `"..."`. The slot binds to a list
`(whole g1 g2 ...)`; named groups `(?<name>...)` are wrapped at their
positional index (so `slot.name` works) **and** bound at top level:

```punk
> parseDate:{s:"^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$"}(
    (s.y. s.m. s.d.)
  ) ⏎
> parseDate!2024-01-15 ⏎
(2024 01 15)
```

Multiple regex slots match positional elements of a list arg:

```punk
> both:{a:"\d+" b:"[a-z]+"}(prep!(a.0. prep!(b.0. ()))) ⏎
> both!(42 hello) ⏎
(42 hello)
```

A failing regex slot binds to `NULL` in a **direct call**, but **skips
the branch** in a `?` dispatch — so `?` works as a regex-driven case
statement:

```punk
> classify:{_}(_.?(
    {n:"^\d+$"}(number)
    {w:"^[a-z]+$"}(word)
    {_}(other)
  )) ⏎
> classify!123 ⏎
number
> classify!hello ⏎
word
> classify!Hello ⏎
other
```

The input is rendered to text via the standard formatter first, so the
same machinery works on numbers, lists, etc.

## 13. Escaping special characters

Punk uses a handful of characters for syntax: `.`, `:`, `!`, `?`, `(`, `)`,
`{`, `}`, `[`, `]`, `<`, `>`, `_`, `~`, `#`, and `\`. To put any of these
inside a Thing's value, prefix each occurrence with `\`:

```punk
> \. ⏎
.
```

```punk
> \\ ⏎
\\
```

```punk
> (Hello \. world\.) ⏎
(Hello . world.)
```

Each occurrence is escaped individually — `\.\.\.` is three full stops.

The math/comparison symbols `+ - * / ^ % = < >` are **not** special inside a
Thing — they're ordinary characters. So `Hello+World` is one 11-character
Thing, and `1+2` is the three-character Thing "1+2" {not an expression}.
The same symbols become callable Thing-name builtins when followed by `!`
or `.` {e.g. `+!(1 2)` is 3}.

### Multi-word text

A regular space is the delimiter between Things in a list, and there is
no escape to embed one inside a single Thing. Multi-word text is just a
list:

```punk
> (Hello World) ⏎
(Hello World)
```

```punk
> len!(Hello World) ⏎
2
```

```punk
> len!((Hello World)) ⏎
1
```

```punk
> join!((John Doe) -) ⏎
John-Doe
```

## 14. Mutable cells

Punk's bindings are immutable: `name:value` doesn't change a previous
binding, it creates a new one. When you genuinely need mutation, use a
*cell*. A cell holds a single value that can be replaced.

Create a cell with `[ ]`, read it with `->`, write to it with `<-`:

```punk
> counter:[0] ⏎
> counter-> ⏎
0
```

```punk
> counter:[0] ⏎
> counter<-5 ⏎
> counter-> ⏎
5
```

```punk
> counter:[0] ⏎
> counter<-5 ⏎
> counter<-+!(counter-> 1) ⏎
> counter-> ⏎
6
```

The cell terminators {`->` and `<-`} are dereference-step terminators just
like `.` and `!` — they fit the same uniform rule.

## 15. Data, code, and `(…)!`

A `( )` written in source is **always** just data. Its contents are not
executed simply because they're written down — they're held as values.
Active forms inside a list {calls, dereferences, dispatch} only run
when something applies `!` to the containing list.

```punk
> held:(log!(hi)) ⏎
```
{nothing runs — the list is held as data}

```punk
> held:(log!(hi)) ⏎
> held! ⏎
hi
```
{the list is evaluated as a body}

```punk
> (log!(hi))! ⏎
hi
```
{literal list applied directly}

This is also why top-level statements run at all: a Punk source file is
evaluated as if the whole file were wrapped as `(file contents)!` — a
zero-argument anonymous list applied to itself.

The upshot: code and data look the same in source. The choice between
"data" and "code" is made at the point of use.

A function can take a `(…)` argument and apply `!` to it itself —
that's all there is to a "macro". For example:

```punk
> when:{test:_ body:_}(test.?{TRUE}(body!)) ⏎
> when!(TRUE (log!(hi))) ⏎
hi
> when!(FALSE (log!(nope))) ⏎
```

The `body!` runs in the **caller's** scope, so the block sees the
caller's variables. Combine with `concat!` to splice forms
together for Lisp-style template macros.

## 16. Recursion and tail calls

A named function can call itself by name; the binding is in scope
before the body runs:

```punk
fact:{_}(
  _.?(
    {0}(1)
    {_}(*!(_. fact!-!(_. 1)))
  )
)
> fact!10 ⏎
3628800
```

When the self-call is in **tail position** — the last expression of a
body, or the matched branch of `?` whose value is the body's
result — Punk trampolines the call instead of growing the JavaScript
stack. So tail-recursive loops run at any depth:

```punk
countdown:{_}(
  _.?(
    {0}(done)
    {_}(countdown!-!(_. 1))   # tail call — trampolines
  )
)
> countdown!100000 ⏎
done
```

Non-tail recursion {like `fact` above} still uses the JS stack and is
bounded by it.

---

## Quick Reference

```punk
name:value                         # bind
name.                              # dereference
(item1 item2 item3)                # list
(name:value)                       # named thing in list
list.0.                            # index 0 {every step ends with `.`/`!`/`<-`/`->`}
list.~.                            # last
list.name.                         # by name
(1 2 3).0.                         # same rule for literal lists
function!argument                  # call {implicitly dereferences}
function.                          # reference to the function itself
value?fn.                          # single-branch dispatch
value?{p}(body)                    # inline literal branch
value?(fn1 fn2 fn3)                # ordered branches; first match wins, else NULL
{_}(body)                          # anonymous function {single arg, deref via `_.`}
{name:_}(body)                     # anonymous function {named parameter}
_.                                 # inside a body: the raw argument as passed
[value]  name->  name<-v           # cell create / read / write
#text#                             # comment
```

## Core Principles

1. **Everything is a Thing** — values, lists, functions are all Things.
2. **Lists are single Things** — from the outside, a list is one Thing.
3. **A bare name is data; `.` dereferences.**
4. **Every dereference step ends with `.`, `!`, `<-`, or `->`** — one uniform rule.
5. **`.` only ever dereferences** — every named parameter is referenced as
   `name.`; `_.` inside a body is the raw argument as passed.
6. **A body returns its last expression's value** {Clojure-style} — earlier
   expressions run for their side effects and any bindings they introduce.
7. **Functions take one Thing** — pass a list when you need multiple values.
8. **Immutable by default** — names rebind; cells {`[ ]`} opt into mutability.
9. **Pattern matching is the primary control-flow mechanism.**
10. **Flat library** — every builtin {`+`, `map`, `split`, `=`, `read`, …} lives at the top level, no namespaces.
11. **Whitespace matters** — no space between a name and its postfix `.`.
