# Immutable data structures

The easiest way to avoid changing state is to use things that cannot change. "Adding" to or "removing" from a group makes a new group like the old one with the needed change. The old group is still there afterwards.

```punk
my-vector:[1 2 3 4]
my-map:[fred:ethel]
my-list:[4 3 2 1]
[
  push![my-vector? 5]
  [my-map? ricky:lucy]!
  unshift![5 my-list?]
  my-vector?
  my-map?
  my-list?
]!
```
**`[[1 2 3 4 5] [fred:ethel ricky:lucy] [5 4 3 2 1] [1 2 3 4] fred:ethel [4 3 2 1]]`**

A group is the only collection in Punk, so one thing plays the part of list, vector and map. The query decides whether it is read by position or by name.

```punk
data:[1 2 3 4 fred:ethel]
[data.1? data.fred?]!
```
**`[1 ethel]`**

Because nothing changes in place, a group can be shared freely. Passing it to a function can never alter it for anyone else.

```punk
v:[1 2 3]
bigger:push![v? 4]
[v? bigger?]!
```
**`[[1 2 3] [1 2 3 4]]`**
