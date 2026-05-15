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

In Punk a name is dereferenced by appending `.` (postfix). The `.` does one job everywhere: dereference the thing on its left. A bare `name` on its own is just data (a literal Thing); writing `name.` retrieves the value bound to `name`.

```punk
name:Tim   # define a Named Thing
name.      # Dereferences to the value 'Tim' (retrieved from the default namespace)
```

A leading-dot form like `.name` is **not** a dereference — it is reserved for the implicit single-parameter reference (see *Parameter Access* below).

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

A List is a collection of Things enclosed in brackets `[ ]`. **Importantly, a List itself is a single Thing** when viewed from outside. When you pass a List to a function, you're passing one Thing (which happens to contain multiple items).

**Single Things as Lists:** A single Thing can also be treated as a list of one Thing. This means `name.0.` (index 0 of `name`) on a scalar returns itself, and `name.~.` does too.

Lists can be used as both associative arrays (by name) and indexed arrays (by position):
```punk
[Tim age:44]  # A List containing a Thing and a Named Thing
```
NOTE: When dereferencing items from a List by name, the last value with that name is returned, on the principle that within the namespace new named things replace previous ones using that name.

**Lists are data; `!` is what evaluates them.** A `[ ]` written in source is *always* just data — its elements are not run as code. Active forms inside a bare list (function calls, dereferences, conditionals, pattern matches) are held as unevaluated Things. They only execute when something applies `!` to the containing list — directly (`fn![…]`), as a function body when the function is called, or as a branch of `?` / `??` that gets taken. A Punk source file is itself evaluated as if it were `[file contents]!` — a literal zero-parameter anonymous list applied directly — which is the only reason top-level statements run. This makes code and data interchangeable in form; the choice is made at the point of use.

**A list is a zero-parameter function body.** `!` can be applied to *any* list, literal or bound to a name, with no argument:

```punk
[log![hi]]!       # Literal list applied directly: prints 'hi'
code:[log![hi]]   # Bound — held as data, nothing runs yet
code!             # Evaluates the bound list as a body: prints 'hi'
```

Because of this, `[ ]!` is Punk's eval primitive: take any list value (built from literals, returned from a function, or manipulated as data) and run it. `!` with no argument is a zero-arg call; an argument is allowed only when it immediately follows the `!` with no whitespace.

### Character Rules

#### Special Characters
The following characters have special meaning in Punk and cannot appear in Thing values or names:
- `.` - Dereference operator (postfix on a name) / single-parameter reference (bare)
- `:` - Name assignment operator
- `!` - Function call operator (implicitly dereferences the name on its left)
- `?` - Pattern matching operator
- `??` - Multiple pattern matching operator
- `[` `]` - List delimiters
- `(` `)` - Pattern delimiters
- `{` `}` - Mutable cell delimiters
- `<` `>` - Cell write / cell read (implicitly dereferences the name on its left)
- `_` - Single wildcard in patterns
- `*` - Multiple wildcard in patterns
- `~` - Last-item accessor (a chain step name; must be followed by `.`, `!`, `<` or `>`)
- `+` - In-Thing space marker (so `Hello+World` is one Thing containing a literal space, not two)
- `#` - Comment delimiter (block style)
- `/` - **Reserved** for future ratio literals (e.g. `1/2`); not currently usable
- `\` - Escape character (see below)

**Escaping Special Characters:** To use a special character as literal text, prefix it with `\` for each instance. For example, `\.` is a literal full stop, `\/` is a literal forward slash, `\\` is a literal backslash, and `\+` is a literal plus sign. The escape must be repeated for each occurrence — `\.\.\.` is three dots.

**Spaces inside a Thing:** A regular space is the delimiter between Things in a list, so it can't appear inside a Thing's value. Use `+` to embed a literal space. `Hello+World` is one Thing of length 11; `[Hello World]` is a list of two Things. A standalone `+` (with whitespace around it) is a one-character Thing whose value is a single space — useful as a delimiter argument: `text.join![[John Doe] +]` yields `John+Doe`.

#### Things
- Can contain any character except the special characters listed above
- Examples:
  ```punk
  hello-world   # Valid Thing
  user@example  # Valid Thing
  price99       # Valid Thing
  ```

#### Names of things
- Must start with a letter (a-z, A-Z)
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
- European format: `1,5` (comma as decimal separator, equivalent to `1.5`)

Examples:
```punk
42        # Integer
-17       # Negative integer
3,14159   # European decimal (equals 3.14159)
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
message:[Hello World]  # A list containing two Things
log!message.           # Logs: Hello World
```

#### Literal Boolean and Null Things
Punk has three special literal Things:
- `TRUE` - Represents a true value
- `FALSE` - Represents a false value
- `NULL` - Represents the absence of a value

These are capitalized to emphasize they are static literals.

### Whitespace
Whitespace (spaces, tabs, newlines) serves as a delimiter between tokens. Whitespace between operators and operands is significant — for example, `numbers.1.` (no spaces) dereferences index 1, while `numbers .1.` (with space) is two separate tokens and is a syntax error (a leading `.` no longer has any meaning). The postfix dereference is `name.` only when the `.` immediately follows the name with no whitespace.

### Lists
Lists in Punk have a unique dual nature — they can be accessed both by index (like traditional arrays) and by name (like associative arrays).

```punk
[1 2 3]              # Simple List
names:[Tim Bob Mary]  # Simple Named list
people:[
  [name:Tim age:44]
  [name:John age:30]
]  # Named List of Lists
```

Important rules for list things:
1. Simple Things don't need individual brackets
2. Nested Lists require their own brackets: `[[1 2] [3 4]]`
3. Lists can contain Things, Named Things, or other Lists
4. All Things are immutable
5. Things in a List can be accessed by both index and name (if named)
6. When multiple items have the same name, the last one supersedes earlier ones

#### List Access Examples

Every dereference step is terminated with `.`, `!`, `<`, or `>`. There is no
special-case for indexes — `0.`, `~.`, and `name.` all behave the same way.

```punk
# Access by numeric index — every step ends with `.`
numbers:[1 2 3]
numbers.1.            # Returns 2 (0-based indexing) — note no space before `.1.`

# Access the last item with `~`
numbers.~.            # Returns 3

# Same rule applies to list literals
[10 20 30].0.         # Returns 10
[10 20 30].~.         # Returns 30
numbers.1             # Error: step '1' must be terminated with '.', '!', '<' or '>'

# Access by name — same shape
people:[person:John person:Tim]
people.person.        # Returns 'Tim' (the last value bound to `person`)

# Chains compose uniformly
matrix:[[1 2] [3 4]]
matrix.0.0.           # Returns 1
matrix.~.~.           # Returns 4
```

The rule reads as one sentence: **every dereference step ends with `.`, `!`,
`<`, or `>`** — `.` continues or ends a chain, `!` calls, `<`/`>` are cell
write/read. `.` always means "dereference one step."

## Mutable Cells

Punk supports controlled mutability through *cells*: lexically scoped boxes whose contents can be replaced. A cell is created with `{value}` and accessed with two operators that work on the cell's name:

- `name>` — read the cell's contents
- `name<value` — write `value` into the cell

```punk
counter:{0}                       # bind counter to a cell containing 0
counter<math.add![counter> 1]     # increment
log!counter>                      # prints 1
```

The `name` itself stays bound to the same cell — the cell's *contents* change. A cell captured in a closure is shared by all closures that captured it, which is the standard way to express shared mutable state.

## Pattern Matching

A pattern in Punk is defined by shapes of data placed between `( )` where:
- `_` represents a single Thing in a pattern shape
- `*` represents any number of Things (including zero Things)

For example:
```punk
(_ _)            # Matches a List containing exactly two Things
(3 _ _)          # Matches a List containing three Things where the first is the Thing '3'
(*)              # Matches any Thing
(person:Tim *)   # Matches any List where 'person:Tim' is the first Thing in the list
```

**Note:** Empty patterns `()` are not currently implemented.

### Conditional Pattern Matching (`?`)

The `?` operator is **pattern-first** and dispatches on the shape of its right-hand side:

| Form | Result |
| --- | --- |
| `pattern?value` | `TRUE` if matched, `FALSE` otherwise (pure predicate) |
| `pattern?[value]` | `TRUE` / `FALSE` (equivalent) |
| `pattern?[value then]` | `then` if matched, `NULL` otherwise |

There's no third "else" slot — use `??` when you want a branch for the no-match case.

```punk
isTim:(Tim)
isTim?Tim                    # TRUE
isTim?Bob                    # FALSE
isTim?[Tim [log!Found Tim]!] # runs log!Found Tim, returns its value
isTim?[Bob hit]              # NULL
```

The `then` slot is **lazy** — it only runs on a match, so a side effect (or error) in the body doesn't fire when the pattern misses. Wrap multiple steps in `[…]!` to evaluate them as a body.

To test a pattern against a list value (which would otherwise look like the match-form), bind the value to a name first:

```punk
isPair:(_ _)
pair:[1 2]
isPair?pair.                 # TRUE
```

### Multiple Pattern Matching (`??`)

The `??` operator dispatches one value against many patterns. The right-hand side is a list of cases:

- `[pattern result]` — on match, evaluate `result` lazily and return it.
- `[pattern]` — on match, do nothing and return `NULL`.

Cases are tried in order; the first match wins. Falling off the end with no match also yields `NULL`. A trailing `[_]` is a "swallow everything else" no-op catch-all.

```punk
wild:(_)
classify:(x:_)[
  x.??[
    [1 one]
    [2 two]
    [wild. other]
  ]
]
classify!1                   # one
classify!9                   # other
```

### Named Patterns

Patterns can be named just like any other Thing. Dereference them with postfix `.` wherever a pattern is expected.

```punk
isTim:(Tim)
isBob:(Bob)
isZero:(0)
```

## Functions

Functions are defined by a pattern connected to an expression (List) that can be applied to a Thing passed to the function that matches that pattern. They are executed by using `!` after the function name (or function literal).

**Every function takes exactly one Thing as its parameter.** Since a List is a single Thing, you can effectively pass multiple values by wrapping them in a List `[ ]`.

Punk has no methods. Operations live in function libraries (like `math`, `list`, `text`), and the target Thing is passed as the argument. For example, use `list.map![numbers. (n:_)[...]]` rather than `numbers.map`.

To call a named function, write the name immediately followed by `!`. The `!` implicitly dereferences the name. For example:

```punk
double:(n:_)[math.mul![n. 2]]   # Define a function named 'double'
double!4                        # Returns 8  — the value of the last expression
```

If a function name is followed by postfix `.` (not `!`), the result is a *reference* to the function itself, suitable for passing to another function:

```punk
double:(n:_)[math.mul![n. 2]]
list.map![numbers. double.]    # Passes the list and the function reference to map
```

Punk supports anonymous functions, which are useful for higher-order functions that accept a function as a parameter.

```punk
list.map![people. (person:_)[person.name.]]
```
Returns a list of names from a list of people that contain an element called `name`.

There are a number of built-in functions such as those within the `math` global namespace.

#### Named Function Example

```punk
sum:(a:_ b:_)[math.add![a. b.]]
sum![2 3]      # Returns 5
```

**Function Return Values:** A function body is a sequence of expressions
evaluated in order. The call's value is the **value of the last expression**
(Clojure-style). Earlier expressions run for their side effects and any
name bindings they introduce. This rule applies uniformly to function
bodies, conditional branches (`?` / `??`), and the eval primitive `[…]!`.

```punk
compute:(x:_)[
    y:math.add![x. 1]
    math.mul![y. 10]
]
compute!4      # Returns 50
```

## Parameter Access

Every parameter slot in a function pattern must be **named**. Use `(name:_)`
for a single Thing and `(name:*)` for a run of Things, then dereference the
binding inside the body with `name.`:

```punk
double:(n:_)[math.mul![n. 2]]
add:(a:_ b:_)[math.add![a. b.]]
all:(xs:*)[xs.]
```

There is no implicit-parameter `.` — every `.` has a name (or expression)
on its left. The one universal shorthand is `*.`, which is **always**
bound inside a function body to the full argument-as-a-list (even when
the pattern uses positional named params). For functions whose pattern is
`(*)`, `*.` is the only way to reach the input:

```punk
all:(*)[*.]                  # *. is the whole argument
pairAll:(a:_ b:_)[*.]        # *. = [a b] even though the slots are named
```

For functions that take a List of inputs, use `name.0.`, `name.1.`,
`name.~.` etc. to access items in that List:

```punk
# Accessing list items by index — every step ends with `.`
numbers:[10 20 30]
numbers.0.   # Returns 10
numbers.1.   # Returns 20
numbers.~.   # Returns 30
```

Name lookup resolves the function's local parameter namespace first, then walks up the calling namespaces to the default namespace.

## Recursion and Tail Calls

A named function can refer to itself by name from inside its own body
(the binding is in scope before the body runs):

```punk
fact:(n:_)[
  n. ?? [
    [0 1]
    [_ math.mul![n. fact!math.sub![n. 1]]]
  ]
]
fact!5      # 120
```

When a self-call sits in **tail position** — the last expression of a
body, or the chosen branch of a `?` / `??` whose value is the body's
result — Punk trampolines the call instead of pushing a new JavaScript
stack frame. So tail-recursive loops (e.g. countdown, mutual recursion
via the spine) run at any depth:

```punk
countdown:(n:_)[
  n. ?? [
    [0 done]
    [_ countdown!math.sub![n. 1]]    # tail call — trampolines
  ]
]
countdown!100000      # done
```

Non-tail recursion (like `math.mul![n. fact!...]` above) still uses the
JS stack and is bounded by it.

## Multi-arity Dispatch

Punk has no overloads — every function takes one Thing. The Clojure-style
"different shapes of input" pattern is just `??` on the whole argument
(`*.` is always the argument as a list):

```punk
greet:(*)[
  *. ?? [
    [()              hello]
    [(name:_)        math.add![hi+ name.]]
    [(first:_ last:_) math.add![first. math.add![+ last.]]]
  ]
]
greet![]              # hello
greet![Alice]         # hi+Alice    (one Thing; `+` marks internal space)
greet![Ada Lovelace]  # Ada+Lovelace
```

## Pipeline `|`

`a | f!` desugars to `f!a`. The trailing `!` is required — it makes the
execution explicit. Pipelines are left-associative, so `a | f! | g!`
means `g!(f!a)`:

```punk
hello | text.toList! | list.head!     # h
[1 2 3] | list.len!                   # 3
[a b c] | list.tail!                  # [b c]
```

The LHS is wrapped as a single-element argument, so a list value isn't
spread across positional slots. For multi-argument stages, wrap in a
lambda:

```punk
5 | (n:_)[math.add![n. 10]]!          # 15
```

Whitespace around `|` is irrelevant; the RHS is a deref chain only
(no `!`/`<`/`>` postfix), and the implicit call is the trailing `!`.

## Code as Data (Macros)

A list of forms — `[log!yes log!done]` — is **data** until something
applies `!` to it. So a function can accept a "block of code" as a
parameter and choose whether (and when) to run it. This is the macro
mechanism; there is no separate quoting form.

```punk
when:(test:_ body:_)[
  test. ? [TRUE body!]      # body is a list value; body! runs it
]
when![TRUE [log!yes]]       # prints yes
when![FALSE [log!no]]       # nothing happens
```

The body list is captured as data when `when!` is called; only `body!`
(applying `!` to the value) evaluates the forms — and they evaluate in
the **caller's** scope, so they see the variables the caller sees.

You can also build code by composing lists with `list.concat!` and run
the result, giving Lisp-style template macros without a separate
syntax for quote/unquote.

## Library Functions

Punk provides library functions organized in namespaces. These are independent functions that take Things as arguments — they are not methods attached to objects.

Common built-in function libraries (each name is dereferenced in the usual way, e.g. `math.add!`):

### Mathematical Operations (`math` namespace)
```punk
math.add!     # Add two numbers
math.sub!     # Subtract two numbers
math.mul!     # Multiply two numbers
math.div!     # Divide two numbers
math.pow!     # Power function
math.sqrt!    # Square root
math.mod!     # Modulo (remainder after division)
math.min!     # Find minimum value in a list
math.max!     # Find maximum value in a list
math.isnum!   # Check if a Thing is a number (returns TRUE or FALSE)
```

Example usage:
```punk
math.add![5 3]    # Returns 8
math.mul![4 7]   # Returns 28
```

### List Operations (`list` namespace)

These functions operate on lists by taking the list as the first argument. They return new lists without modifying the original.

```punk
list.map!       # Transform each element: takes [list, function]
list.filter!    # Filter elements: takes [list, function]
list.reduce!    # Reduce to single value: takes [list, function, initial]
list.flatMap!   # Transform and flatten: takes [list, function]
list.len!       # Get length: takes list
list.concat!    # Concatenate: takes [list, list, ...]
list.range!     # Generate range: takes [start, end, step]
list.slice!     # Extract portion: takes [list, start, end]
list.find!      # Find index: takes [list, value]
list.contains!  # Check contains: takes [list, value]
list.sort!      # Sort list: takes list, returns sorted copy
list.head!      # First element (NULL if empty): takes list
list.tail!      # All but the first (always a list): takes list
list.prepend!   # Add an item to the front: takes [item, list]
```

Together, `list.head!`, `list.tail!`, `list.prepend!` and `list.concat!` form a Lisp-style spine — every other list traversal can be written recursively in terms of them.

### Text Operations (`text` namespace)

```punk
text.upper!     # Convert to uppercase: takes text
text.lower!     # Convert to lowercase: takes text
text.trim!      # Remove whitespace: takes text
text.split!     # Split into list: takes [text delimiter]
text.join!      # Join list into text: takes [list delimiter]
text.replace!   # Replace text: takes [text search replacement]
text.toList!    # Decompose into a List of single-character Things
text.fromList!  # Inverse of toList: rejoin a List of Things into one text Thing
```

Punk has no separate "string" type — text is just a Thing. Operations like
length, first/last, slice, `startsWith`, or substring search are not
mirrored in `text.*`; instead, decompose with `text.toList!` and use the
existing `list.*` functions. Reassemble with `text.fromList!` when needed.

```punk
list.len![text.toList!hello]                              # 5
text.fromList![list.slice![text.toList!hello 0 2]]        # he

#startsWith#
startsWith:(s:_ p:_)[
  chars: text.toList!s.
  prefix: text.toList!p.
  logic.eq![list.slice![chars. 0 list.len![prefix.]] prefix.]
]
startsWith![hello he]                                     # TRUE
```

Only the genuine character-class operations (`upper`/`lower`/`trim`) and
delimiter ops (`split`/`join`/`replace`) live in `text.*`.

### File Operations (`file` namespace)

```punk
file.read!      # Read file: takes filename, returns list of lines
file.write!     # Write file: takes [filename, content]
```

Example:
```punk
#Read a file#
lines:file.read!myfile\.txt

#Write a file (content can be list of lines or text)#
file.write![[output\.txt] [line1 line2 line3]]
```

### Logic Operations (`logic` namespace)

Logic functions compare Things and combine truth values. `NULL` and `FALSE` are falsy; every other Thing (including `0`, the empty list, and arbitrary atoms) is truthy.

```punk
logic.gt!   # Greater than: takes [a b] (works with numbers or text)
logic.lt!   # Less than: takes [a b] (works with numbers or text)
logic.eq!   # Equal: takes [a b] (deep equality)
logic.not!  # Logical NOT: TRUE if its Thing is falsy, FALSE otherwise
logic.and!  # Variadic AND: TRUE iff every Thing in the list is truthy
logic.or!   # Variadic OR: TRUE if any Thing in the list is truthy
```

The `logic.gt!` and `logic.lt!` functions work on both numbers and text. For text, they compare using alphanumeric order (e.g., `xyz` is greater than `abc`).

The `logic.eq!` function performs deep equality checking:
```punk
logic.eq![[1 2 3] [1 2 3]]      # Returns TRUE
logic.eq![5 5]                  # Returns TRUE
logic.eq![[a:1 b:2] [a:1 b:2]]  # Returns TRUE
```

`logic.and!` and `logic.or!` are variadic and eager — every argument is evaluated before the call. Empty `and` is `TRUE`, empty `or` is `FALSE` (their identity values):

```punk
logic.not!hello                 # FALSE  (hello is truthy)
logic.not!NULL                  # TRUE
logic.and![TRUE TRUE TRUE]      # TRUE
logic.and![TRUE FALSE TRUE]     # FALSE
logic.or![FALSE NULL hello]     # TRUE
logic.and![]                    # TRUE
logic.or![]                     # FALSE
```

### Log Function

The log function outputs Things. It's one of the few functions available at the top level.

```punk
log![This is a message]   # Logs each Thing in the list
log![Hello World]         # Logs: Hello World
```

The log function takes a single Thing as its parameter (which can be a List). It returns nothing.

### Assert Function

`assert` is a self-checking equality assertion built for tests. It takes two
Things — `actual` and `expected` — and compares them by deep equality. It is
silent on success and throws a Punk-shaped error on failure, so a passing test
file produces no output of its own.

```punk
assert![math.add![2 3] 5]              # silent: pass
assert![list.concat![[1 2] [3 4]] [1 2 3 4]]
assert![NULL NULL]
assert![1 2]                           # Error: assert failed: expected 2 got 1
```

Wrong arity reports through the same pattern channel as any other built-in:

```
Error: assert expects (actual:_ expected:_)
```

This lets a test file double as both the test and its expected outcome — the
file passes if and only if every `assert` holds.

## Running

Punk source is interpreted by the Node.js implementation in `src/`.

```bash
# Run a Punk file
node src/index.js path/to/file.punk

# Or via npm
npm start path/to/file.punk
```

## Tests

The test suite lives in `tests/`. Each `.punk` file has a paired `.expected` file
holding its captured stdout. The runner diffs actual output against expected:

```bash
npm test
# or
bash tests/run.sh
```

The suite covers basics, lists, functions, patterns, cells, math/logic libraries,
escaping, the postfix-dot deref rules, and the `assert` built-in.
