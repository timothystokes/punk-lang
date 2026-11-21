# Operators

Punk has no infix operators. What other languages write as `a + b` is the call `+![a b]`. The only operators are structural: `:` names, `?` looks up, `!` calls and `>` pipes.

```punk
+![2 3]
```
**`5`**

Operators take any number of things where it makes sense, so there is no need to chain them.

```punk
*![2 3 4]
```
**`24`**

Pipes feed a thing into a function as its last argument.

```punk
[1 2 3] > sum!
```
**`6`**

`min` and `max` pick from several things.

```punk
[min![4 2 9] max![4 2 9]]!
```
**`[2 9]`**
