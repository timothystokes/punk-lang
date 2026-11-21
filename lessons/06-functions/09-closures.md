# Closures

A function made inside another function remembers the names around it.

```punk
adder:(n:_)[(m:_)[+![n? m?]]]
add2:adder!2
add2!3
```
**`5`**

Functions are things, so they can be named, passed and returned.

```punk
adder:(n:_)[(m:_)[+![n? m?]]]
[1 2 3] > map!adder!10
```
**`[11 12 13]`**
