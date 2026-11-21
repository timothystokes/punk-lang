# Assertions

`assert` returns `TRUE` when its first thing is `TRUE`. Otherwise it prints the rest as a message and returns the non-thing. It never aborts the program (ERR-2).

```punk
assert![=![+![1 1] 2] math works]
```
**`TRUE`**

```punk
assert![=![+![1 1] 3] math is broken]
```
**`[]`**
