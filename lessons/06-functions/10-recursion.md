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
