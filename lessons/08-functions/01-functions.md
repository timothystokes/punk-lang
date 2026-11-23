# Functions

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
welcome!Jim
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

Functions are things, so they can be named, passed to other functions and
returned from one. A function can also have several cases, tried in order.

```punk
argcount:(-)[
  .?
  -> ()[0]!
  -> (_)[1]!
  -> (_ _)[2]!
  -> (_ _ r:-)[+![2 count!r?]]!
]
[argcount! argcount!a argcount![a b] argcount![a b c d e]]!
```
**`[0 1 2 5]`**
