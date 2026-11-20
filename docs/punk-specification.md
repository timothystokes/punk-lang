# Punk Language Specification

Status: draft. Derived from `README.md`; rules not stated there are listed in
[Appendix A](#appendix-a-undefined-behaviour) and are deliberately undefined.

## Conventions

- **MUST**, **MUST NOT**, **MAY** are normative.
- Every rule has a stable ID (`THING-2`, `PAT-7`, …). Cite IDs in tests, error
  messages and issues.
- `⇒` means "evaluates to". `⇒ ✗` means "is not a valid program / is an error"
  (conformance examples only; i.e. a syntax error, see ERR-1).
- A **conformance example** under a rule is a normative test case for it.

---

## 1. Lexical rules (`LEX`)

| ID | Rule |
|---|---|
| LEX-1 | Space MUST be the delimiter between things. |
| LEX-2 | Punk MUST NOT have reserved words. Any run of non-reserved characters is a word. |
| LEX-3 | The reserved symbols are `:` `[` `]` `.` `?` `!` `>` `->` `(` `)` `{` `}` `\|` `_` `#`. |
| LEX-4 | `_` and `#` are reserved only as placeholders inside a pattern. |
| LEX-5 | `->` MAY be lengthened (`-->`, `--->`, …) to denote deeper case levels (see CASE-4). |
| LEX-6 | Function names MUST NOT contain `>`, `<` or `\|`. `^` is allowed as a function name (logical or). (`>` is the pipe symbol; `\|` is such-that.) |
| LEX-7 | `TRUE` and `FALSE` MUST be ordinary words with no special evaluation. They are used by convention for logical results. |

## 2. Things (`THING`)

| ID | Rule |
|---|---|
| THING-1 | Punk has exactly one data type: the **thing**. |
| THING-2 | A thing MUST be exactly one of: word, group, named thing, pattern, function. A word and a single-element group are the same thing (GRP-1). |
| THING-3 | A **word** is a run of characters. Numbers, text and logical values are all words. |
| THING-4 | A word MUST NOT be treated as a number or as text until a function coerces it (e.g. `+`, `upper`). |
| THING-5 | A **group** `[ a b c ]` contains zero or more things separated by space. |
| THING-6 | `[ ]` MUST mean grouping only; it MUST NOT carry any other semantics (see section 2.1). |
| THING-7 | The empty group `[]` is the **non-thing**. |
| THING-8 | The non-thing MUST be the result of any query that does not align with the structure queried. |
| THING-9 | The non-thing MUST be the result of calling a function whose pattern does not match the argument. |

```punk
[Paul is 42]    ⇒ [Paul is 42]
Paul            ⇒ Paul
```

### 2.1 Grouping (`GRP`)

`[ ]` does not create a different kind of thing. It only marks which
elements belong together relative to the things around them.

| ID | Rule |
|---|---|
| GRP-1 | A thing with a single element MUST be the same thing as that element: `word` ≡ `[word]`. |
| GRP-2 | `[ ]` MUST be required only to delimit a thing of two or more elements from its surroundings. |
| GRP-3 | `[ ]` around a single element MUST be optional on input to any function, pattern, query or definition (`welcome![Jim]` ≡ `welcome!Jim`). |
| GRP-4 | A function or query result of a single element MUST NOT be wrapped; implementations MUST NOT distinguish `x` from `[x]` in output. (`message.1? ⇒ Hello`, not `[Hello]`.) |
| GRP-5 | Because of GRP-1, nested single-element groups MUST collapse: `[[x]]` ≡ `[x]` ≡ `x`, and `[[a b]]` ≡ `[a b]`. |
| GRP-6 | Equality (`=`, LIB-4) MUST hold between a thing and its single-element wrapping. |
| GRP-7 | A pattern's `_` and `(_)` MUST match a single word (a single element is a one-item thing, PAT-2). |
| GRP-8 | The empty group `[]` has zero elements and MUST NOT collapse into any word (THING-7). |
| GRP-9 | Multi-element results MUST be shown with `[ ]`: `[Hello Sally]`. Display of a single element MUST omit them. |

```punk
Tim = [Tim]                          ⇒ TRUE
welcome!Jim                          ⇒ [Hello Jim]
[[Jim]] > welcome!                   ⇒ [Hello Jim]
```

## 3. Names (`NAME`)

| ID | Rule |
|---|---|
| NAME-1 | `name:thing` MUST attach `name` to `thing`, producing a **named thing**. |
| NAME-2 | A name MUST be immutable within its namespace context: once attached, it MUST NOT be attached to a different thing. |
| NAME-2a | Each function body and each file MUST be its own namespace context. |
| NAME-2b | Namespace contexts MUST form a chain up to the global namespace. |
| NAME-2c | Name resolution MUST cascade: look in the current context, then each enclosing context in turn, up to global. |
| NAME-2d | An inner context MAY bind a name already bound in an outer context (shadowing); this MUST NOT violate NAME-2. |
| NAME-2e | `.` inside a function body MUST always refer to the local argument and MUST NOT cascade (FN-3). |
| NAME-3 | Evaluating a named-thing definition MUST yield the named thing itself (`x:1 ⇒ x:1`). |
| NAME-4 | A named thing MAY contain other named things at any depth. |

```punk
x:1                          ⇒ x:1
message:[Hello world]        ⇒ message:[Hello world]
person:[name:[Paul Jones] age:42]
```

## 4. Queries (`QRY`)

| ID | Rule |
|---|---|
| QRY-1 | A query is written `path?`. |
| QRY-2 | A path is a name followed by zero or more `.`-separated segments. |
| QRY-3 | A **name segment** MUST select the named thing of that name in the current thing. |
| QRY-4 | A **numeric segment** `n` MUST select the nth item of the current thing. |
| QRY-5 | Indexes MUST start at `1`. |
| QRY-6 | Segments MUST be resolved left to right, each applying to the result of the previous. |
| QRY-7 | A query MUST resolve to the non-thing if any segment fails to align (THING-8). |
| QRY-8 | A query is itself a thing and MAY appear inside another thing. |

```punk
message?            ⇒ [Hello world]
message.1?          ⇒ Hello
person.age?         ⇒ 42
person.name.2?      ⇒ Jones
```

## 5. Templates (`TMPL`)

| ID | Rule |
|---|---|
| TMPL-1 | Evaluating a thing with `!` MUST resolve every embedded query within it. |
| TMPL-2 | A thing without embedded queries MUST evaluate to itself. |

```punk
person:[Paul]
message:[Hello person?]
message!            ⇒ [Hello Paul]
```

### 5.1 Embeds (`EMB`)

`{ }` embeds the result of a query inside surrounding text without the
native space delimiter. It is concatenation where the boundary is not a space.

| ID | Rule |
|---|---|
| EMB-1 | `{query?}` MUST be recognised only in a template being evaluated (a function template, or any template evaluated with `!`). |
| EMB-2 | In a thing that is not evaluated, `{` and `}` MUST be kept as ordinary characters. |
| EMB-3 | Evaluating `{query?}` MUST replace the whole `{ }` with the query's result. |
| EMB-4 | Characters directly adjacent to `{ }` (no space) MUST be concatenated to the result with no delimiter between them. |
| EMB-5 | A bare query (`person?`, no braces) MUST remain a separate element delimited by space, per TMPL-1. |
| EMB-6 | The contents of `{ }` MUST be a single query path (QRY-2), and MAY use `.` segments and `.` references to the function argument (FN-3). |
| EMB-7 | A query inside `{ }` that fails MUST yield the non-thing (THING-8), which embeds as no characters. |
| EMB-8 | `{ }` MUST NOT be allowed to nest. |
| EMB-9 | A multi-element result MUST be concatenated with its internal spaces intact; only the first and last elements join to adjacent characters. |
| EMB-10 | The evaluated template MUST be re-read as source after embedding, so the result MAY contain a different number of things than the template had elements (`[Dr-{name?}]` ⇒ `[Dr-Paul Jones]`, two things). |
| EMB-11 | A single-element result joins to its neighbours as one word (GRP-1). |

```punk
env:prod
region:ap
[{env?}-database]!                   ⇒ prod-database
[db-{env?}]!                         ⇒ db-prod
[{env?}-{region?}]!                  ⇒ prod-ap
name:[Paul Jones]
[Dr-{name?}]!                        ⇒ [Dr-Paul Jones]   (two things)
greet:(_)[Hi {.?}!]
Sam > greet!                         ⇒ Hi Sam!
```

## 6. Patterns (`PAT`)

### 6.1 Shape

| ID | Rule |
|---|---|
| PAT-1 | A pattern `( … )` describes the shape a thing can have. |
| PAT-2 | `_` MUST match exactly one item. |
| PAT-3 | `#` MUST match any number of items, including none. |
| PAT-3a | `#` MUST be the last positional slot, and a pattern level MUST contain at most one `#`; otherwise it is a syntax error. |
| PAT-4 | A literal word in a pattern MUST match only an item whose value equals that word. The item's name, if any, MUST be ignored: `[name:Tim]` matches `(Tim)`. |
| PAT-5 | Items MUST be matched positionally, left to right. |
| PAT-6 | A pattern MUST match only if every item of the thing is accounted for. |

| Pattern | Matches |
|---|---|
| `(_)` | a thing with exactly one item |
| `(_ _)` | exactly two items |
| `(#)` | any number of items |
| `(5 _ _)` | three items, the first equal to `5` |
| `(_ _ _ #)` | at least three items |

### 6.2 Executing

| ID | Rule |
|---|---|
| PAT-7 | Executing a pattern against a thing with `!` MUST yield `TRUE` on match, `FALSE` otherwise. |
| PAT-8 | A thing MAY be supplied by pipe (`thing > (p)!`) or by attachment (`thing(p)!`); both MUST behave identically. |
| PAT-9 | A pattern with an attached template (`(p)[t]`) MUST evaluate `t` on match instead of yielding `TRUE`. |

```punk
name:[Paul Jones]
name? > (_ _)!                       ⇒ TRUE
name?(_)!                            ⇒ FALSE
name? > (_ _)[Full name found]!      ⇒ [Full name found]
```

### 6.3 Labels

| ID | Rule |
|---|---|
| PAT-10 | A slot written `label:slot` (e.g. `n:_`) MUST match by shape only. |
| PAT-11 | The `label` MUST be a new name bound to the matched value, resolvable in the function body. |
| PAT-12 | A label MUST NOT constrain the name of the matched item. `[tim]` matches `(n:_)` and `n?` resolves to `tim`. |
| PAT-13 | Names MUST take part in matching only on the right of a `\|` (see 6.4). |
| PAT-13a | Left of `\|`, a pattern matches shape, and optionally values (PAT-4), and optionally introduces new labels (PAT-11). |

### 6.4 Such-that (`|`)

| ID | Rule |
|---|---|
| PAT-14 | A pattern MAY contain at most one `\|` at its top level. |
| PAT-15 | The left of `\|` MUST be an ordinary shape pattern (6.1, 6.3). |
| PAT-16 | The right of `\|` MUST be one or more `name:value` pairs. |
| PAT-17 | Each right-hand pair MUST match a named thing of that name and value inside the thing being matched. |
| PAT-18 | Right-hand pairs MUST be matched in any order. |
| PAT-18a | A right-hand `value` MAY itself be nested (e.g. `person:[name:[Bob Smith]]`) and MUST match by the same rules at that depth. |
| PAT-18b | The right side MUST NOT constrain shape: it asserts that the named elements exist with the given values and MUST ignore all other structure. |
| PAT-19 | The whole pattern MUST match only if the left shape matches and every right-hand pair matches. |

```punk
person:[name:Bob age:42]
person? > (# | name:Bob)!             ⇒ TRUE
person? > (# | name:Sally)!           ⇒ FALSE
```

## 7. Functions (`FN`)

| ID | Rule |
|---|---|
| FN-1 | A function is a pattern attached to a template: `(pattern)[template]`. |
| FN-2 | A function MUST receive exactly one thing. |
| FN-3 | Within the template, `.` MUST reference the thing passed to the function. |
| FN-4 | Within the template, labels bound by the pattern MUST be resolvable with `?`. |
| FN-5 | A function is a thing and MAY be named (`welcome:(name:_)[Hello .name?]`). |
| FN-6 | A function MUST be called with `!`, by pipe or attachment. |
| FN-7 | A call whose argument does not match the pattern MUST yield the non-thing (THING-9). |
| FN-8 | The function result MUST be the template evaluated per TMPL-1. |

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome!                     ⇒ [Hello Sally]
welcome![Jim]                        ⇒ [Hello Jim]
```

## 8. Pipes (`PIPE`)

| ID | Rule |
|---|---|
| PIPE-1 | `a > f! > g!` MUST pass the result of `a` to `f`, and the result of `f` to `g`. |
| PIPE-2 | A pipe stage MUST receive exactly one thing (FN-2). |
| PIPE-3 | A pipe is a function: its input pattern MUST be the first stage's pattern and its output the last stage's result. |
| PIPE-4 | A pipe MAY be named (`p:> f! > g!`) and called like a function. |

```punk
Sally > welcome! > upper!            ⇒ [HELLO SALLY]
upperWelcome:> welcome! > upper!
John > upperWelcome!                 ⇒ [HELLO JOHN]
```

## 9. Cases (`CASE`)

| ID | Rule |
|---|---|
| CASE-1 | `->` introduces a case: a function or pipe tried against the subject. |
| CASE-2 | Cases at the same level MUST be tried in source order. |
| CASE-3 | Only the **first** matching case MUST execute; later cases MUST NOT be tried. |
| CASE-4 | A case with more arrows (`-->`) MUST be a sub-case of the nearest preceding case with one fewer arrow. |
| CASE-5 | Sub-cases MUST be tried only if their parent case matched. |
| CASE-6 | If a parent case matched and no sub-case matches, the result MUST be the non-thing, with no fall through to later cases at the parent level. |
| CASE-7 | If no case matches at the top level, the result MUST be the non-thing. |

```punk
number:43
number?
-> (42)[This is Forty Two]!
-> (n:_)[This is .n?]!               ⇒ [This is 43]

person:[name:[John Smith] role:vip]
person?
-> (_ _)[.?]!
--> (n:_ vip)[.n?]! > upper!
--> (n:_ _)[.n?]!
-> (_)[You need to provide two names]!   ⇒ [JOHN SMITH]
```

## 10. Currying (`CURRY`)

| ID | Rule |
|---|---|
| CURRY-1 | A function given fewer things than its pattern expects MUST return a new function awaiting the rest. |
| CURRY-2 | Supplied things MUST fill slots left to right. |
| CURRY-3 | A directly attached argument (`f!x`) MUST be usable mid-pipeline. |
| CURRY-4 | `a > f!b` MUST be equivalent to `f![b a]` (attached fills first, piped fills the rest). |

```punk
timesTwo:*[2]!
4 > timesTwo!                        ⇒ 8
4 > -!8 > *!7                        ⇒ 28
*![-![8 4] 7]                        ⇒ 28
```

## 11. Standard library (`LIB`)

| ID | Rule |
|---|---|
| ERR-1 | Syntax errors MUST abort the program with an error carrying a source location. |
| ERR-2 | Syntax errors MUST be the only kind of error. There MUST be no runtime errors. |
| ERR-1a | A syntax error message SHOULD name the location and the offending token; its exact wording is not normative. |
| ERR-3 | Every other failure (failed match, failed query, wrong argument count or shape, division by zero, wrong type, file or I/O failure) MUST NOT abort and MUST evaluate to the non-thing, unless a rule degrades it gracefully (LIB-5). |
| LIB-1 | Library functions MUST obey FN-2 and PAT rules like any function. |
| LIB-2 | Signatures are written `name(pattern)`; a call MUST fail to match (THING-9) if the argument does not fit the pattern. |
| LIB-4 | Equality (`=`, `~=`) MUST be deep structural, comparing names and values. |
| LIB-5 | Numeric functions MUST treat a non-numeric thing as `0`; text functions MUST treat a number as a word. Library functions MUST degrade gradually in line with intent and MUST NOT raise errors (ERR-2). |
| LIB-6 | Division by zero MUST yield the non-thing. |
| LIB-3 | Library functions MUST NOT mutate their inputs (immutability, NAME-2). |

### 11.1 Maths

| Signature | Rule |
|---|---|
| `+(_ _ #)` | MUST return the sum of two or more numbers. |
| `-(_ _)` | MUST return first − second (exactly two arguments). |
| `*(_ _ #)` | MUST return the product of two or more numbers. |
| `\(_ _)` | MUST return first ÷ second (exactly two arguments); by zero yields the non-thing (LIB-6). |
| `mod(_ _)` | MUST return the remainder of first ÷ second. |
| `pow(_ _)` | MUST return first raised to second. |
| `sqrt(_)` `abs(_)` `neg(_)` | square root, absolute value, sign flip. |
| `floor(_)` `ceil(_)` `round(_)` | round down, up, to nearest whole number. |
| `min(_ _ #)` `max(_ _ #)` | smallest / largest of two or more numbers. |
| `sum(#)` | MUST return the sum of every item. |
| `rand(_ _)` | MUST return a random number between first and second. |

### 11.2 Comparison

| Signature | Rule |
|---|---|
| `=(_ _ #)` | MUST return `TRUE` iff all things are the same. |
| `~=(_ _ #)` | MUST equal `~` applied to `=`. |
| `lt(_ _)` `gt(_ _)` | first < second; first > second. |
| `lte(_ _)` `gte(_ _)` | first ≤ second; first ≥ second. |

### 11.3 Logic

| Signature | Rule |
|---|---|
| `~(#)` | MUST invert the logical input. |
| `&(_ _ #)` | MUST return `TRUE` iff all inputs are `TRUE`. |
| `^(_ _ #)` | MUST return `TRUE` iff any of two or more inputs is `TRUE` (or). |
| `xor(_ _)` | MUST return `TRUE` iff exactly one input is `TRUE`. |

### 11.4 Type checks

| Signature | Rule |
|---|---|
| `isnum(_)` | `TRUE` iff the thing can be treated as a number. |
| `istext(_)` | `TRUE` iff the thing is text. |
| `isempty(#)` | `TRUE` iff the thing has no items. |
| `isfn(_)` | `TRUE` iff the thing is a function. |
| `num(_)` | MUST convert to a number, or return the non-thing if impossible. |

### 11.5 Text

| Signature | Rule |
|---|---|
| `upper(#)` `lower(#)` | uppercase / lowercase all alpha characters. |
| `trim(#)` | remove leading and trailing whitespace. |
| `length(#)` | number of characters. |
| `chars(#)` | split into individual characters. |
| `split(_ _)` | split text by a separator. |
| `join(_ #)` | join items with a separator. |
| `replace(_ _ _)` | replace every occurrence of a search text. |
| `sub(_ _ _)` | part of a text between start and end. |
| `startsWith(_ _)` `endsWith(_ _)` | `TRUE` iff text begins / ends with the given text. |
| `repeat(_ _)` | repeat a text a number of times. |
| `pad(_ _ _)` | pad a text to a width with a fill character. |

### 11.6 Collections

| Signature | Rule |
|---|---|
| `count(#)` | number of items. |
| `first(#)` `last(#)` | first / last item. |
| `rev(#)` `sort(#)` `unique(#)` | reverse, sort ascending, remove duplicates. |
| `contains(_ #)` | `TRUE` iff the thing contains the item. |
| `concat(_ _ #)` | join two or more things into one. |
| `slice(_ _ #)` | items between start and end. |
| `range(_ _)` | every whole number from first to second. |
| `zip(_ _)` | pair up items of two things. |
| `flatten(#)` | remove one level of nesting. |

### 11.7 Higher-order (`HOF`)

| ID | Rule |
|---|---|
| HOF-1 | The function MUST be the first argument and the data MUST be the last, so partially applied (curried, CURRY-1) higher-order functions work as pipeline stages with data flowing through. |
| HOF-2 | `f` MUST be called once per item with exactly one thing (FN-2), except `reduce` (HOF-4). |
| HOF-3 | Items MUST be processed in order, first to last. |
| HOF-4 | `reduce` MUST call `f` with a group `[accumulator item]`; the result becomes the next accumulator. |
| HOF-5 | A predicate MUST count as true only if it returns `TRUE`; any other result, including `[]`, is false. |
| HOF-6 | Higher-order functions MUST NOT mutate their input (LIB-3). |
| HOF-7 | On empty data, `map` `filter` `flatMap` `sortBy` return `[]`; `find` returns `[]`; `any` returns `FALSE`; `all` returns `TRUE`; `reduce` returns its start value. |

| Signature | Rule |
|---|---|
| `map(_ #)` | MUST return a group of `f` applied to every item. |
| `flatMap(_ #)` | MUST map `f` over the items and remove one level of nesting from the results. |
| `filter(_ #)` | MUST keep the items for which `f` is `TRUE`. |
| `find(_ #)` | MUST return the first item for which `f` is `TRUE`, else `[]`. |
| `each(_ #)` | MUST call `f` per item for side effects and return the data unchanged. |
| `reduce(_ _ #)` | MUST combine items with `f` and a start value (second argument). |
| `any(_ #)` | `TRUE` iff `f` is `TRUE` for at least one item. |
| `all(_ #)` | `TRUE` iff `f` is `TRUE` for every item. |
| `sortBy(_ #)` | MUST sort items ascending by the result of `f` on each item. |
| `partition(_ #)` | MUST return `[[matching] [others]]` split by `f`. |

```punk
double:*[2]!
[1 2 3] > map!double                 ⇒ [2 4 6]
[1 2 3 4] > filter!(n:_)[gt![.n? 2]] ⇒ [3 4]
[1 2 3 4] > reduce!+!0               ⇒ 10
doubleAll:> map!double
[5 6] > doubleAll!                   ⇒ [10 12]
```

### 11.8 Input, output, files

| Signature | Rule |
|---|---|
| `print(#)` | write a thing to output. |
| `read(_)` | read a file's contents. |
| `write(_ _)` | write a thing to a file, replacing contents. |
| `append(_ _)` | add a thing to the end of a file. |
| `exists(_)` | `TRUE` iff the file exists. |

### 11.9 Utility

| Signature | Rule |
|---|---|
| `assert(_ #)` | MUST return `TRUE` if the first thing is `TRUE`. Otherwise MUST write the remaining things as a message to output (as `print`) and return the non-thing. MUST NOT abort (ERR-2). |
| `serialize(_)` `deserialize(_)` | thing → text; text → thing. |
| `import(_)` | load functions from another Punk file. |

---

## Appendix A: Undefined behaviour

None currently.
