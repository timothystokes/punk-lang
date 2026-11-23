# Such that

Names only take part in matching on the right of a `|` (PAT-13). The
left is matched by shape, the right asserts that named things exist,
in any order (PAT-17, PAT-18). A `-` on the left means any shape, the same as
`-` (PAT-3b).

```punk
[name:Bob age:42](- | name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](- | age:42 name:Bob)!
```
**`TRUE`**

```punk
[name:Bob age:42](- | name:Sally)!
```
**`FALSE`**

Such-that names can also match values deep inside nested named things:

```punk
[name:[first:Tom last:Jones] age:42](- | age:42 name.last:Jones)!
```
**`TRUE`**
