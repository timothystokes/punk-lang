# Slices

Python slices with `a[1:3]`. In Punk a query takes a range: `.1-2?` for the first two, `.-1?` for the last and `.3-?` for the third to the end. The `slice`, `take` and `drop` functions do the same by call.

```punk
l:[a b c d e]
[l.2-3? l.-2-? l.-1?]!
```
**`[[b c] [d e] e]`**

```punk
slice![2 3 [a b c d e]]
```
**`[b c]`**

```punk
[1 2 3 4 5] > rev!
```
**`[5 4 3 2 1]`**
