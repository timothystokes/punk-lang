# The non-thing

The absence of a thing is the empty group `[]`, the **non-thing**. It is what failed lookups, bad calls and unmatched cases give back (ERR-3).

```punk
[]
```
**`[]`**

```punk
person:[name:Paul]
person.age?
```
**`[]`**

`isempty` tests for it.

```punk
isempty![]
```
**`TRUE`**

```punk
isempty!a
```
**`FALSE`**

An empty group is still a thing when it sits inside a group.

```punk
[a [] b]
```
**`[a [] b]`**
