# Higher order functions

The function comes first and the data last, so a partly applied
function is a pipeline stage (HOF-1). A predicate counts as true only
when it returns `TRUE` (HOF-5).

```punk
double:*![2]
[1 2 3] > map!double?
```
**`[2 4 6]`**

```punk
[1 2 3 4] > filter!(n:_)[gt![.n? 2]]
```
**`[3 4]`**

A function is passed by reference with `?`, as in `map!double?`. A bare word is just text (HOF-8).

The function can ask for more than the item (HOF-9). With two parameters it also gets the key (the name of a named item, or `[]`), and with three it also gets the position, starting at 1. A function with `#` gets all three.

```punk
[a:1 b:2] > map!(v:_ k:_ i:_)[{k?}-{v?}-{i?}]
```
**`[a-1-1 b-2-2]`**

`reduce` calls its function with `[accumulator item]` (HOF-4).

```punk
[1 2 3 4] > reduce![+? 0]
```
**`10`**

Each item is one value, so a record can be taken whole and queried.

```punk
todos:[[note:milk done:FALSE] [note:code done:TRUE] [note:sleep done:FALSE]]
isOpen:(t:_)[=![t.done? FALSE]]
noteOf:(t:_)[t.note?]
todos? > filter!isOpen? > map!noteOf?
```
**`[milk sleep]`**
