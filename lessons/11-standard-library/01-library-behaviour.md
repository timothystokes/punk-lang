# Library behaviour

Numeric functions treat a non-number as 0 and division by zero gives the
non-thing (LIB-5, LIB-6).

```punk
+![1 x]
```
**`1`**

```punk
/![5 0]
```
**`[]`**

Equality is deep and structural, and a thing equals its single-element
wrapping (LIB-4, GRP-6).

```punk
=![[a b:1] [a b:1]]
```
**`TRUE`**

Library functions never change their input (LIB-3).

```punk
x:[b a]
sort!x?
x?
```
**`[b a]`**
