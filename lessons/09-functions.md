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
