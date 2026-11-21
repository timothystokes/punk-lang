# Copying collections

Python needs `copy` and `deepcopy` because lists change in place. Punk never changes anything, so every name is already its own independent copy. There is nothing to copy.

```punk
a:[1 2 3]
b:push![a? 4]
[a? b?]!
```
**`[[1 2 3] [1 2 3 4]]`**

Equality is structural, so two things with the same shape are equal.

```punk
=![[a b:1] [a b:1]]
```
**`TRUE`**
