# Recursive looping

Without variables to change, a loop has nothing to count with. Repeating work is done by a function calling itself with new values. Punk has no `for` or `while`.

This adds the numbers from `n` down to 1. The running total travels along as an argument, so each call starts from fresh values.

```punk
sum-to:(n:_ acc:_)[
  n?
  -> (0)[acc?]!
  -> (_)[sum-to![-![n? 1] +![acc? n?]]]!
]
sum-to![10 0]
```
**`55`**

Recursion also walks a group, splitting off the first item and calling itself on the rest.

```punk
total:(#)[
  .?
  -> ()[0]!
  -> (f:_ r:#)[+![f? total!r?]]!
]
total![3 4 5]
```
**`12`**

Punk does not optimise calls in tail position, so very deep recursion runs out of space. Use `map`, `filter` and `reduce` for long groups.
