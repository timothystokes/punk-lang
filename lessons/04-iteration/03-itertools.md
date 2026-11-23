# Itertools

Pairing, flattening, splitting and joining groups are all ordinary functions.

```punk
zip![[1 2 3] [a b c]]
```
**`[[1 a] [2 b] [3 c]]`**

```punk
flatten![[1 [2]] [3 4]]
```
**`[1 2 3 4]`**

```punk
[1 2] > flatMap!(n:_)[[n? n?]]
```
**`[1 1 2 2]`**

```punk
[1 2 3 4 5] > partition!(n:_)[gt![n? 2]]
```
**`[[3 4 5] [1 2]]`**

```punk
flatten![[1 2] [3] [4 5]]
```
**`[1 2 3 4 5]`**
