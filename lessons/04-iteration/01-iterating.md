# Iterating

Punk has no `for` loop. Instead a function is applied to every item: `map` transforms, `filter` selects, `each` is for side effects like printing.

```punk
[1 2 3] > map!(x:_)[*![x? x?]]
```
**`[1 4 9]`**

```punk
[a b c] > each!print?
```
**`[a b c]`**

`each` returns its data unchanged. With more parameters the function also receives the key and the position starting from 1 (HOF-9).

```punk
[x y z] > map!(v:_ k:_ i:_)[{i?}={v?}]
```
**`[1=x 2=y 3=z]`**

`find`, `any` and `all` ask questions of every item.

```punk
[1 2 3 4] > find!(n:_)[gt![n? 2]]
```
**`3`**

```punk
[1 2 3] > all!(n:_)[gt![n? 0]]
```
**`TRUE`**

```punk
[1 2 3] > any!(n:_)[gt![n? 2]]
```
**`TRUE`**
