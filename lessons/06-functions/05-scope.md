# Scope

Every function body and every file is its own context. Lookups cascade
outwards, an inner context may shadow a name, and `.` never cascades
(NAME-2a..2e).

```punk
x:1
f:(_)[x?]
0 > f!
```
**`1`**

```punk
x:1
f:(_)[x:2 x?]
0 > f!
```
**`[x:2 2]`**

```punk
n:outer
f:(_)[.n?]
0 > f!
```
**`[]`**
