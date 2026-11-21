# Lists

A group is Punk's list. Items are counted from 1 and functions return new groups rather than changing the old one.

```punk
fruit:[apple pear plum]
[count!fruit? first!fruit? last!fruit?]!
```
**`[3 apple plum]`**

```punk
fruit:[apple pear plum]
push![fruit? fig]
```
**`[apple pear plum fig]`**

```punk
fruit:[apple pear plum]
unshift![fig fruit?]
```
**`[fig apple pear plum]`**

```punk
fruit:[apple pear plum]
[pop!fruit? shift!fruit? remove![2 fruit?]]!
```
**`[[apple pear] [pear plum] [apple plum]]`**

```punk
fruit:[apple pear plum]
fruit?
```
**`[apple pear plum]`**
