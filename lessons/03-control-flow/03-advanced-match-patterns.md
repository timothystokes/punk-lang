# Such that

Names only take part in matching on the right of a `|` (PAT-13). The
left is matched by shape, the right asserts that named things exist,
in any order (PAT-17, PAT-18).

```punk
[name:Bob age:42](# | name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](# | age:42 name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](# | name:Sally)!
```
**`FALSE`**
