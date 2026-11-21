# Numbers

Numbers are words, so there is no integer or float type. Arithmetic is done by functions: `+` `-` `*` `/` `mod` `pow` and friends. A function is called with its things attached to `!`.

```punk
+![1 2 3]
```
**`6`**

```punk
/![7 2]
```
**`3.5`**

```punk
[pow![2 10] mod![7 3] sqrt!16]!
```
**`[1024 1 4]`**

Rounding is by function too.

```punk
[floor!2.7 ceil!2.2 round!2.5 abs!-4]!
```
**`[2 3 3 4]`**

A word that is not a number counts as 0 in arithmetic, and dividing by zero gives the non-thing (LIB-5, LIB-6).

```punk
+![1 apple]
```
**`1`**

```punk
/![5 0]
```
**`[]`**
