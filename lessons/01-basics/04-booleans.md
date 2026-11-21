# Booleans

`TRUE` and `FALSE` are ordinary words. Comparisons return `TRUE` or `FALSE`, and the logic functions are `~` (not), `&` (and), `^` (or) and `xor`.

```punk
gt![3 2]
```
**`TRUE`**

```punk
[lt![1 2] gte![2 2] =![a a]]!
```
**`[TRUE TRUE TRUE]`**

```punk
[&![TRUE FALSE] ^![TRUE FALSE] ~!TRUE xor![TRUE FALSE]]!
```
**`[FALSE TRUE FALSE TRUE]`**
