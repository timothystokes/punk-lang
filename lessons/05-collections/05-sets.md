# Sets

There is no separate set type. Use `set` to remove duplicate items from a
group, and test membership with `contains`.

```punk
set![a b a c b]
```
**`[a b c]`**

```punk
contains![b [a b c]]
```
**`TRUE`**

A union is a flattened set, and an intersection is a filter.

```punk
flatten![[a b] [b c]] > set!
```
**`[a b c]`**

```punk
[a b c] > filter!(x:_)[contains![x? [b c d]]]
```
**`[b c]`**
