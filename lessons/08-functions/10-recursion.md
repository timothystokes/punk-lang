# Recursion

A function can call itself by name. Put the finishing case first.

```punk
fact:(n:_)[
  n?
  -> (0)[1]!
  -> (_)[*![n? fact![-![n? 1]]]]!
]
fact!5
```
**`120`**

```punk
total:(n:_)[
  n?
  -> (0)[0]!
  -> (_)[+![n? total![-![n? 1]]]]!
]
total!4
```
**`10`**

Recursion suits nested data. A taxonomy is groups inside groups, and a function can count its leaves without knowing how deep it goes. A single thing is a leaf and counts as 1. Anything with more items is mapped over, calling the function again on each item, and the results are summed.

```punk
leaves:(#)[
  .?
  -> (_)[1]!
  -> (_ _ #)[
    .? > map!(v:_)[leaves![v?]] > sum!
  ]!
]
leaves![
  animals:[
    mammals:[dog cat]
    birds:[owl hawk eagle]
  ]
  plants:[oak fern]
]
```
**`7`**
