# Multiple return values

A function always returns a template, so returning several things needs nothing special: just list them. Query the result to pick one.

```punk
minmax:(l:#)[min!.? max!.?]
r:minmax![4 9 2]
r?
```
**`[2 9]`**

```punk
minmax:(l:#)[min!.? max!.?]
r:minmax![4 9 2]
r.2?
```
**`9`**
