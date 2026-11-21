# Sets

There is no set type. Take the unique items of a group, and test membership with `contains`.

```punk
unique![a b a c b]
```
**`[a b c]`**

```punk
contains![b [a b c]]
```
**`TRUE`**

A union is a concatenation made unique, and an intersection is a filter.

```punk
concat![[a b] [b c]] > unique!
```
**`[a b c]`**

```punk
[a b c] > filter!(x:_)[contains![x? [b c d]]]
```
**`[b c]`**
