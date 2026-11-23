# Slices

A query takes a range: `.1-2?` for the first two, `.-1?` for the last
one, `.-2?` for the last two, and `.3-?` from the third to the end.

```punk
l:[a b c d e]
[l.2-3? l.-2? l.-1?]!
```
**`[[b c] [d e] e]`**

```punk
l:[a b c d e]
l.2-3?
```
**`[b c]`**

```punk
[1 2 3 4 5] > rev!
```
**`[5 4 3 2 1]`**
