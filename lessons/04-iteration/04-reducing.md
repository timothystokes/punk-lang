# Reducing

`reduce` folds a group into one thing. Its function receives `[accumulator item]` and the start value is the second argument (HOF-4).

```punk
[1 2 3 4] > reduce![+? 0]
```
**`10`**

```punk
[1 2 3 4] > reduce![*? 1]
```
**`24`**

`any`, `all` and `count` summarise too.

```punk
count![a b c d]
```
**`4`**
