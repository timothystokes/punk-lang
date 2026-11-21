# Extensible abstractions

Every collection is a group, so the same functions work on all of them. `first` and the `.2-?` range read any group as a head and a rest, which is all it takes to walk a list one item at a time.

```punk
my-vector:[1 2 3 4]
[first!my-vector? my-vector.2-?]!
```
**`[1 [2 3 4]]`**

```punk
my-list:[4 3 2 1]
[first!my-list? my-list.2-?]!
```
**`[4 [3 2 1]]`**

Named things are read the same way. A name picks out the value and a position picks out the item.

```punk
my-map:[fred:ethel ricky:lucy]
[my-map.fred? my-map.2? count!my-map?]!
```
**`[ethel ricky:lucy 2]`**

The standard functions take and return groups, so they chain. Each stage hands a new group to the next.

```punk
[1 2 3 4 5 6] > filter!(n:_)[gt![n? 2]] > map!(n:_)[*![n? n?]] > sum!
```
**`86`**

Every group is complete in memory, so Punk has no lazy or infinite sequences. `range` builds exactly the items asked for and `take` cuts a group short.

```punk
take![5 range![1 100]]
```
**`[1 2 3 4 5]`**
