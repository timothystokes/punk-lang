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

Lambdas can nest as deep as needed, and each level sees the names of every level around it. Here the innermost function uses `x` from the top, `y` from the middle and its own `z`.

```punk
a:(x:_)[(y:_)[(z:_)[+![x? y? z?]]]]
b:a!1
c:b!10
c!100
```
**`111`**

The same works with inline lambdas in a pipeline. The inner `map` uses `x` from the outer one, giving a multiplication table.

```punk
[1 2] > map!(x:_)[[10 20] > map!(y:_)[*![x? y?]]]
```
**`[[10 20] [20 40]]`**
