# Ranges

`range` gives every whole number from the first to the second, which is how you count without a loop.

```punk
range![1 5]
```
**`[1 2 3 4 5]`**

```punk
range![1 5] > map!(n:_)[*![n? 10]]
```
**`[10 20 30 40 50]`**

```punk
range![1 100] > filter!(n:_)[=![mod![n? 25] 0]]
```
**`[25 50 75 100]`**

`take` and `drop` cut a group by count.

```punk
[take![2 [a b c d]] drop![2 [a b c d]]]!
```
**`[[a b] [c d]]`**
