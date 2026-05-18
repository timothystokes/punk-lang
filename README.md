# Punk Programming Language

## Introduction
Punk is a functional programming language designed for concise and expressive data processing. It features a unique syntax that emphasizes readability and composability, with a focus on functional programming patterns and data transformation.

## Core Concepts

### Things and Named Things
Things are the basic building blocks in Punk. They can be Simple Things or Named Things.

```punk
hello           # Simple Thing
person:Tim      # Named Thing
```

#### Accessing a thing by its name

In Punk a name is dereferenced by appending `.` {postfix}. The `.` does one job everywhere: dereference the thing on its left. A bare `name` on its own is just data {a literal Thing}; writing `name.` retrieves the value bound to `name`.

```punk
name:Tim   # define a Named Thing
name.      # Dereferences to the value 'Tim' {retrieved from the default namespace}
```

A leading-dot form like `.name` is **not** a dereference — it is reserved for the implicit single-parameter reference {see *Parameter Access* below}.

**Immutability and Naming:**  
All Things in Punk are immutable. Once a Thing is named, its value cannot be changed. However, a new Named Thing within the same namespace will remap the new Thing to that name. This is similar to shadowing or rebinding in other functional languages.

For mutability when truly needed, see *Mutable Cells* below.

**No Null Things:**  
Punk has no null Thing. If an expression produces nothing, then nothing is returned and no Thing exists to be used or printed.

```punk
person:Tim
person:Bob
person.     # returns Bob, the new Thing named 'person'
```

### Lists are Things

A List is a collection of Things enclosed in brackets `( )`. **Importantly, a List itself is a single Thing** when viewed from outside. When you pass a List to a function, you're passing one Thing {which happens to contain multiple items}.

**Single Things as Lists:** A single Thing can also be treated as a list of one Thing. This means `name.0.` {index 0 of `name`} on a scalar returns itself, and `name.~.` does too.

Lists can be used as both associative arrays {by name} and indexed arrays {by position}:
```punk
(Tim age:44)  # A List containing a Thing and a Named Thing
```
NOTE: When dereferencing items from a List by name, the last value with that name is returned, on the principle that within the namespace new named things replace previous ones using that name.

**Lists are data; `!` is what evaluates them.** A `( )` written in source is *always* just data — its elements are not run as code. Active forms inside a bare list {function calls, dereferences, dispatch} are held as unevaluated Things. They only execute when something applies `!` to the containing list — directly {`fn!(…)`}, as a function body when the function is called, or as a branch of `?` that gets taken. A Punk source file is itself evaluated as if it were `(file contents)!` — a literal zero-parameter anonymous list applied directly — which is the only reason top-level statements run. This makes code and data interchangeable in form; the choice is made at the point of use.

**A list is a zero-parameter function body.** `!` can be applied to *any* list, literal or bound to a name, with no argument:

```punk
(log!(hi))!       # Literal list applied directly: prints 'hi'
code:(log!(hi))   # Bound — held as data, nothing runs yet
code!             # Evaluates the bound list as a body: prints 'hi'
```

Because of this, `( )!` is Punk's eval primitive: take any list value {built from literals, returned from a function, or manipulated as data} and run it. `!` with no argument is a zero-arg call; an argument is allowed only when it immediately follows the `!` with no whitespace.

### Character Rules

#### Special Characters
The following characters have special meaning in Punk and cannot appear in Thing values or names:
- `.` - Dereference operator {postfix on a name} / single-parameter reference {bare}
- `:` - Name assignment operator
- `!` - Function call operator {implicitly dereferences the name on its left}
- `?` - Pattern matching operator
- `?` - Value-first dispatch operator
- `(` `)` - List delimiters
- `{` `}` - Pattern delimiters
- `[` `]` - Mutable cell delimiters
- `<-` `->` - Cell write / cell read {implicitly dereferences the name on its left}
- `_` - Single wildcard in patterns; in a body, `_.` derefs the whole argument
- `___` - Variadic wildcard in patterns {three underscores; matches zero or more}
- `'` - Partial application {mirrors `!` but pre-binds args without invoking}
- `~` - Last-item accessor {a chain step name; must be followed by `.`, `!`, `<-` or `->`}
- `#` - Comment delimiter {block style}
- `\` - Escape character {see below}

The following characters were once reserved but are now ordinary Thing characters and double as callable symbol-name builtins {`+!`, `-!`, `*!`, `/!`, `^!`, `%!`, `=!`, `<!`, `>!`}: `+ - * / ^ % = < >`. Inside a Thing they're just text — `Hello+World` is a single 11-character Thing whose value is `Hello+World`; `1+2` is the three-character Thing "1+2", not a sum.

**Escaping Special Characters:** To use a special character as literal text, prefix it with `\` for each instance. For example, `\.` is a literal full stop, `\\` is a literal backslash, and `\ ` {backslash-space} is a literal space embedded inside a Thing.

**Spaces inside a Thing:** A regular space is the delimiter between Things in a list, so a Thing cannot contain a space. There is no escape for embedding a space; multi-word text is naturally a list. `(Hello World)` is a list of two Things. `Hello+World` is one 11-character Thing (the `+` is just text, not a marker).

#### Things
- Can contain any character except the special characters listed above
- Examples:
  ```punk
  hello-world   # Valid Thing
  user@example  # Valid Thing
  price99       # Valid Thing
  ```

#### Names of things
- Must start with a letter {a-z, A-Z}
- Can only contain letters and numbers after the first character
- Examples:
  ```punk
  person:John     # Valid name
  field27:Monday  # Valid name
  name:Tim        # Valid name
  3x:             # Not a valid name
  ```

#### Numbers
Punk supports numeric literals in two formats:
- Standard format: `123`, `-45`, `0`
- European format: `1,5` {comma as decimal separator, equivalent to `1.5`}

Examples:
```punk
42        # Integer
-17       # Negative integer
3,14159   # Decimal {comma is the decimal separator; `.` is reserved for dereferencing}
```

#### Comments
Comments in Punk use block-style delimiters with `#`:
```punk
#This is a comment#
name:Tim  #inline comment# age:44
```
Comments are completely removed during tokenization and can span multiple lines.

#### Strings
Punk has no string literal type. To represent text with multiple words, use a List of Things:
```punk
message:(Hello World)  # A list containing two Things
log!message.           # Logs: Hello World
```

#### Literal Boolean and Null Things
Punk has three special literal Things:
- `TRUE` - Represents a true value
- `FALSE` - Represents a false value
- `NULL` - Represents the absence of a value

These are capitalized to emphasize they are static literals.

### Whitespace
Whitespace {spaces, tabs, newlines} serves as a delimiter between tokens. Whitespace between operators and operands is significant — for example, `numbers.1.` {no spaces} dereferences index 1, while `numbers .1.` {with space} is two separate tokens and is a syntax error {a leading `.` no longer has any meaning}. The postfix dereference is `name.` only when the `.` immediately follows the name with no whitespace.

### Lists
Lists in Punk have a unique dual nature — they can be accessed both by index {like traditional arrays} and by name {like associative arrays}.

```punk
(1 2 3)              # Simple List
names:(Tim Bob Mary)  # Simple Named list
people:(
  (name:Tim age:44)
  (name:John age:30)
)  # Named List of Lists
```

Important rules for list things:
1. Simple Things don't need individual brackets
2. Nested Lists require their own brackets: `((1 2) (3 4))`
3. Lists can contain Things, Named Things, or other Lists
4. All Things are immutable
5. Things in a List can be accessed by both index and name {if named}
6. When multiple items have the same name, the last one supersedes earlier ones

#### List Access Examples

Every dereference step is terminated with `.`, `!`, `<`, or `>`. There is no
special-case for indexes — `0.`, `~.`, and `name.` all behave the same way.

```punk
# Access by numeric index — every step ends with `.`
numbers:(1 2 3)
numbers.1.            # Returns 2 {0-based indexing} — note no space before `.1.`

# Access the last item with `~`
numbers.~.            # Returns 3

# Same rule applies to list literals
(10 20 30).0.         # Returns 10
(10 20 30).~.         # Returns 30
numbers.1             # Error: step '1' must be terminated with '.', '!', '<' or '>'

# Access by name — same shape
people:(person:John person:Tim)
people.person.        # Returns 'Tim' {the last value bound to `person`}

# Chains compose uniformly
matrix:((1 2) (3 4))
matrix.0.0.           # Returns 1
matrix.~.~.           # Returns 4
```

The rule reads as one sentence: **every dereference step ends with `.`, `!`,
`<-`, or `->`** — `.` continues or ends a chain, `!` calls, `<-`/`->` are
cell write/read. `.` always means "dereference one step."

## Mutable Cells

Punk supports controlled mutability through *cells*: lexically scoped boxes whose contents can be replaced. A cell is created with `[value]` and accessed with two arrow operators that work on the cell's name:

- `name->` — read the cell's contents
- `name<-value` — write `value` into the cell

```punk
counter:[0]                       # bind counter to a cell containing 0
counter<-+!(counter-> 1)        # increment
log!counter->                     # prints 1
```

The `name` itself stays bound to the same cell — the cell's *contents* change. A cell captured in a closure is shared by all closures that captured it, which is the standard way to express shared mutable state.

## Pattern Matching

A pattern in Punk is defined by shapes of data placed between `{ }` where:
- `_` represents a single Thing in a pattern shape
- `___` {three underscores} represents any number of Things {including zero Things}

For example:
```punk
{_ _}            # Matches a List containing exactly two Things
{3 _ _}          # Matches a List containing three Things where the first is the Thing '3'
{___}            # Matches any Thing
{person:Tim ___} # Matches any List where 'person:Tim' is the first Thing in the list
```

**Note:** Empty patterns `{}` are not currently implemented.

### Dispatch — `?`

The `?` operator is **value-first**: the left-hand side is a value, the right-hand side is one or more **function values** used as branches. Each branch's pattern is tried against the value in order; the first that matches runs (its body is evaluated with the matched bindings). No branch matches → `NULL`.

| Form | Meaning |
| --- | --- |
| `value?fn.` | single branch — function ref |
| `value?{pat}(body)` | single branch — inline function literal |
| `value?(fn1 fn2 fn3)` | ordered list of branches; first match wins |

```punk
1?{1}(yes)                       # yes
9?{1}(yes)                       # NULL  {no match}

isOne:{1}(matched)
1?isOne.                         # matched
9?isOne.                         # NULL

classify:{_}(
  _.?(
    {1}(one)
    {2}(two)
    {_}(other)               # wildcard catch-all
  )
)
classify!1                       # one
classify!9                       # other
```

If/else is just literal-match plus wildcard:

```punk
value.?(
  {TRUE}(then-branch)
  {_}(else-branch)
)
```

Branch bodies are **lazy** — only the matched branch runs, so side effects in unmatched branches don't fire. Because each branch is a real function, its pattern bindings (e.g. `{n:_}`) are visible inside its body, and tail calls in the branch body trampoline through the normal function-call path.

### Named branches

Branches can be any expression that evaluates to a function value — a named function (`fn.`), an inline literal (`{p}(body)`), or even an element of a list:

```punk
yes:{1}(one)
no:{_}(other)
dispatch:{_}(_.?(yes. no.))
dispatch!1                       # one
dispatch!9                       # other
```

## Functions

Functions are defined by a pattern connected to an expression {List} that can be applied to a Thing passed to the function that matches that pattern. They are executed by using `!` after the function name {or function literal}.

**Every function takes exactly one Thing as its parameter.** Since a List is a single Thing, you can effectively pass multiple values by wrapping them in a List `( )`.

Punk has no methods. Operations live in function libraries {like `math`, `list`, `text`}, and the target Thing is passed as the argument. For example, use `map!({_}(...) numbers.)` rather than `numbers.map`. Higher-order list builtins take the **function first** {Clojure-style} — this composes naturally with partial application (`map'fn.`).

To call a named function, write the name immediately followed by `!`. The `!` implicitly dereferences the name. For example:

```punk
double:{_}(*!(_. 2))            # Define a function named 'double'
double!4                        # Returns 8  — the value of the last expression
```

If a function name is followed by postfix `.` {not `!`}, the result is a *reference* to the function itself, suitable for passing to another function:

```punk
double:{_}(*!(_. 2))
map!(double. numbers.)    # Passes the function reference and the list to map
```

Punk supports anonymous functions, which are useful for higher-order functions that accept a function as a parameter.

```punk
map!({_}(_.name.) people.)
```
Returns a list of names from a list of people that contain an element called `name`.

There are a number of built-in functions {`+!`, `map!`, `=!`, …} all available at the top level — see "Library Functions" below.

#### Named Function Example

```punk
sum:{a:_ b:_}(+!(a. b.))
sum!(2 3)      # Returns 5
```

**Function Return Values:** A function body is a sequence of expressions
evaluated in order. The call's value is the **value of the last expression**
{Clojure-style}. Earlier expressions run for their side effects and any
name bindings they introduce. This rule applies uniformly to function
bodies, dispatch branches {`?`}, and the eval primitive `(…)!`.

```punk
compute:{_}(
    y:+!(_. 1)
    *!(y. 10)
)
compute!4      # Returns 50
```

## Parameter Access

Every parameter slot in a function pattern can be named or unnamed.
For a single-arg function, prefer `{_}` and dereference with `_.`. Use
`{name:_}` when you want to give the parameter a documenting name (or
when the body would be clearer with one); `{name:___}` for a named
variadic run of Things; `{___}` for an unnamed variadic.

```punk
double:{_}(*!(_. 2))
add:{a:_ b:_}(+!(a. b.))
all:{xs:___}(xs.)
```

Every function body also has `_` implicitly bound to the **raw argument
as passed** — scalar stays scalar, list stays list. This means the
simplest functions can skip naming altogether:

```punk
processOne:{_}(_.)            # _. is the single arg
processTwo:{_ _}(+!(_.0. _.1.))
processN:{___}(len!_.)        # variadic: _. is the list of args
trailing:{x:_ ___}(_.)        # _. = the full (x ___) list
```

For functions that take a List of inputs, use `name.0.`, `name.1.`,
`name.~.` etc. to access items in that List:

```punk
# Accessing list items by index — every step ends with `.`
numbers:(10 20 30)
numbers.0.   # Returns 10
numbers.1.   # Returns 20
numbers.~.   # Returns 30
```

Name lookup resolves the function's local parameter namespace first, then walks up the calling namespaces to the default namespace.

## Recursion and Tail Calls

A named function can refer to itself by name from inside its own body
{the binding is in scope before the body runs}:

```punk
fact:{_}(
  _.?(
    {0}(1)
    {_}(*!(_. fact!-!(_. 1)))
  )
)
fact!5      # 120
```

When a self-call sits in **tail position** — the last expression of a
body, or the matched branch of `?` whose value is the body's
result — Punk trampolines the call instead of pushing a new JavaScript
stack frame. So tail-recursive loops {e.g. countdown, mutual recursion
via the spine} run at any depth:

```punk
countdown:{_}(
  _.?(
    {0}(done)
    {_}(countdown!-!(_. 1))   # tail call — trampolines
  )
)
countdown!100000      # done
```

Non-tail recursion {like `*!(_. fact!...)` above} still uses the
JS stack and is bounded by it.

## Multi-arity Dispatch

Punk has no overloads — every function takes one Thing. The Clojure-style
"different shapes of input" pattern is just `?` on the whole argument
{`_.` is always the argument as passed}:

```punk
describe:{___}(
  _.?(
    {(name:_)}(prep!(name. (one)))
    {(first:_ last:_)}(two)
    {_}(other)
  )
)
describe!(Alice)        # (Alice one) — list result#
describe!(Ada Lovelace) # two#
describe!()             # other#
```

(Each branch destructures a different shape; the wildcard catches the rest.
Function bodies return only the *last* expression — to return multi-word
text, build a list explicitly.)

## Regex in Patterns

A pattern slot can be a regex literal `"..."` instead of `_`. The slot
matches its input element against the regex; on a match it binds to a
list `(whole g1 g2 ...)`, with any named groups `(?<name>...)` appearing
both at their positional index (wrapped as named items, so `m.name` works)
and as top-level bindings in the function body. Multiple regex slots
work the same way patterns always do: each slot matches one element of
the input list.

```punk
parseDate:{s:"^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$"}(
  (s.y. s.m. s.d.)
)
parseDate!2024-01-15      # (2024 01 15)
```

```punk
both:{a:"\d+" b:"[a-z]+"}(
  prep!(a.0. prep!(b.0. ()))
)
both!(42 hello)           # (42 hello)
```

Failure rules differ by context:
- **Direct call**: a failing regex slot binds to `NULL`, and every named
  group from that regex also binds to `NULL`. Other slots still match.
- **`?` dispatch**: a failing regex skips the branch, so `?` can pick
  among several regex shapes:

```punk
classify:{_}(
  _.?(
    {n:"^\d+$"}(number)
    {w:"^[a-z]+$"}(word)
    {_}(other)
  )
)
classify!123              # number
classify!hello            # word
classify!Hello            # other
```

The input is rendered to text via the standard formatter before
matching, so numbers, lists, etc. all work — "do the best with what
you get."

## Pipeline `|`

`a | f.` desugars to `f!a` exactly — the LHS becomes the call's argument as
written. So `(a b c) | f.` is `f!(a b c)` {3 args, not a single list arg}.
The trailing `.` is required: it gives the pipe the function **value** to
call. Pipelines are left-associative, so `a | f. | g.` means `g!{f!a}`:

```punk
hello | split. | head.           # h
(1 2 3) | len.                   # 3
(a b c) | tail.                  # (b c)
```

If a stage needs the LHS as a single list-shaped arg, give it a `{xs:___}`
parameter or wrap in a lambda:

```punk
5 | {_}(+!(_. 10)).            # 15
```

Whitespace around `|` is irrelevant; the RHS is any expression that
evaluates to a function value — typically `f.` {deref a name} or
`getFn!x` {a call that itself returns a function}. The pipe is what
performs the final call with the LHS as the single argument.

## Partial Application `'`

The apostrophe is the partial-application operator. It mirrors `!` —
same argument forms, same evaluation rules — but instead of invoking
the function it returns a **Partial**: a value carrying the function
and its pre-bound args. A later `!` call extends those args and invokes:

```punk
addTen:+'10                    # Partial: + with first arg = 10
addTen!5                       # 15        {+!(10 5)}
addTen!90                      # 100

add3:{a:_ b:_ c:_}(+!(a. +!(b. c.)))
add12:add3'(1 2)               # pre-bind two args
add12!10                       # 13        {add3!(1 2 10)}
```

Args-list form pre-binds multiple positions in one go {`'(a b)`}. A scalar
form pre-binds one {`'x`}. Partials can be partialled further by name:

```punk
addOne:add3'1
twoPlus:addOne'2
twoPlus!7                      # 10
```

`!` always invokes — under-arity on a fixed-arity function is an error,
not an implicit partial. Use `'` explicitly when you want partials.

## Code as Data {Macros}

A list of forms — `(log!yes log!done)` — is **data** until something
applies `!` to it. So a function can accept a "block of code" as a
parameter and choose whether {and when} to run it. This is the macro
mechanism; there is no separate quoting form.

```punk
when:{test:_ body:_}(
  test.?{TRUE}(body!)         # body is a list value; body! runs it
)
when!(TRUE (log!yes))         # prints yes
when!(FALSE (log!no))         # nothing happens
```

The body list is captured as data when `when!` is called; only `body!`
{applying `!` to the value} evaluates the forms — and they evaluate in
the **caller's** scope, so they see the variables the caller sees.

You can also build code by composing lists with `concat!` and run
the result, giving Lisp-style template macros without a separate
syntax for quote/unquote.

## Library Functions

Punk provides library functions at the top level — they're plain Things in the global scope. There are no namespaces; every builtin is just a name like `+`, `map`, `split`. Pick a unique name when you bind your own and you won't shadow them.

### Mathematical Operations
```punk
+!       # Add two numbers
-!       # Subtract two numbers
*!       # Multiply two numbers
/!       # Divide two numbers
^!       # Power function
%!       # Modulo {remainder after division}
sqrt!    # Square root
min!     # Find minimum value in a list
max!     # Find maximum value in a list
isnum!   # Check if a Thing is a number {returns TRUE or FALSE}
```

Example usage:
```punk
+!(5 3)   # Returns 8
*!(4 7)   # Returns 28
```

### List Operations

These functions operate on lists by taking the list as the first argument. They return new lists without modifying the original.

```punk
map!       # Transform each element: takes (function, list)
filter!    # Filter elements: takes (function, list)
reduce!    # Reduce to single value: takes (function, initial, list)
flatMap!   # Transform and flatten: takes (function, list)
len!       # Shape-aware size:
           #   list     → item count
           #   text     → character count   {len!hello → 5}
           #   number   → digit count incl. decimal comma  {len!3,14 → 4}
           #   range    → span, or INFINITE for unbounded
           #   function → AST node count  {builtins → 1}
           #   NULL     → 0
concat!    # Concatenate: takes (list, list, ...)
slice!     # Extract a sublist. Two forms:
           #   slice!(list range)        — Range value, inclusive both ends
           #   slice!(list start endEx)  — exclusive end, for computed bounds
find!      # Find index: takes (list, value)
contains!  # Check contains: takes (list, value)
sort!      # Sort list: takes list, returns sorted copy
prep!   # Add an item to the front: takes (item, list)
```

For indexing and first/rest the postfix-dot chain does the job:
`xs.0.` for the first element, `xs.~.` for the last, `xs.N~.` for the slice
from N to the end, `xs.N~M.` for N..M inclusive, `xs.~N.` for 0..N inclusive.

The same `~` is a **range literal** at the expression level: `1~5` is the
list `(1 2 3 4 5)`, `0~3` is `(0 1 2 3)`, a reversed range `5~1` is `()`.
Open forms (`1~`, `~5`, `~`) are lazy and only legal where context supplies
a bound — forcing one elsewhere errors with "Cannot force an unbounded
range". Together, the slice forms plus `prep!` and `concat!` form a
Lisp-style spine — every other list traversal can be written recursively in
terms of them.

### Text Operations

```punk
upper!     # Convert to uppercase: takes text
lower!     # Convert to lowercase: takes text
trim!      # Remove whitespace: takes text
split!     # With (text delim): split into list at each delim.
           # With one Thing: decompose into a List of single-character Things.
join!      # With (list delim): glue with delim between elements.
           # With one list: concatenate elements with nothing between.
replace!   # Replace text: takes (text search replacement)
```

Punk has no separate "string" type — text is just a Thing. The list builtins
are polymorphic: pass a text Thing or a number and they auto-decompose into
characters/digits, run the op, and rewrap to the original shape. `split!` and
`join!` are still there for when you actually want the list form.

```punk
slice!(hello 0~1)                        # he         {text in, text out}
slice!(12345 1~2)                        # 23         {number in, number out}
sort!hello                               # ehllo
prep!(W hello)                        # Whello
concat!(foo bar)                         # foobar
find!(hello l)                           # 2
contains!(hello e)                       # TRUE
map!(upper. abc)                         # ABC
len!hello                                # 5          {smart len}

#startsWith collapses to a plain slice + equality.#
startsWith:{s:_ p:_}(=!(slice!(s. 0 len!p.) p.))
startsWith!(hello he)                    # TRUE
```

`split!`/`join!` are inverses for when you do need the list shape:
`join!split!hello.` round-trips to `hello`.

### File Operations

```punk
read!      # Read file: takes filename, returns list of lines
write!     # Write file: takes (filename, content)
```

Example:
```punk
#Read a file#
lines:read!myfile\.txt

#Write a file {content can be list of lines or text}#
write!((output\.txt) (line1 line2 line3))
```

### Logic Operations

Logic functions compare Things and combine truth values. `NULL` and `FALSE` are falsy; every other Thing {including `0`, the empty list, and arbitrary atoms} is truthy.

```punk
>!   # Greater than: takes (a b) {works with numbers or text}
<!   # Less than: takes (a b) {works with numbers or text}
=!   # Equal: takes (a b) {deep equality}
not!  # Logical NOT: TRUE if its Thing is falsy, FALSE otherwise
and!  # Variadic AND: TRUE iff every Thing in the list is truthy
or!   # Variadic OR: TRUE if any Thing in the list is truthy
```

The `>!` and `<!` functions work on both numbers and text. For text, they compare using alphanumeric order {e.g., `xyz` is greater than `abc`}.

The `=!` function performs deep equality checking:
```punk
=!((1 2 3) (1 2 3))      # Returns TRUE
=!(5 5)                  # Returns TRUE
=!((a:1 b:2) (a:1 b:2))  # Returns TRUE
```

`and!` and `or!` are variadic and eager — every argument is evaluated before the call. Empty `and` is `TRUE`, empty `or` is `FALSE` {their identity values}:

```punk
not!hello                 # FALSE  {hello is truthy}
not!NULL                  # TRUE
and!(TRUE TRUE TRUE)      # TRUE
and!(TRUE FALSE TRUE)     # FALSE
or!(FALSE NULL hello)     # TRUE
and!()                    # TRUE
or!()                     # FALSE
```

### Log Function

The log function outputs Things. It's one of the few functions available at the top level.

```punk
log!(This is a message)   # Logs each Thing in the list
log!(Hello World)         # Logs: Hello World
```

The log function takes a single Thing as its parameter {which can be a List}. It returns nothing.

### Assert Function

`assert` is a self-checking equality assertion built for tests. It takes two
Things — `actual` and `expected` — and compares them by deep equality. It is
silent on success and throws a Punk-shaped error on failure, so a passing test
file produces no output of its own.

```punk
assert!(+!(2 3) 5)              # silent: pass
assert!(concat!((1 2) (3 4)) (1 2 3 4))
assert!(NULL NULL)
assert!(1 2)                           # Error: assert failed: expected 2 got 1
```

Wrong arity reports through the same pattern channel as any other built-in:

```
Error: assert expects {actual:_ expected:_}
```

This lets a test file double as both the test and its expected outcome — the
file passes if and only if every `assert` holds.

## Running

Punk source is interpreted by the Node.js implementation in `src/`.

```bash
# Run a Punk file
node src/cli.js path/to/file.punk

# Or via npm
npm start path/to/file.punk
```

## Tests

The test suite lives in `tests/` as `node:test` files (`*.test.mjs`).

```bash
npm test
```
