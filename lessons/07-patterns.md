# Patterns

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
