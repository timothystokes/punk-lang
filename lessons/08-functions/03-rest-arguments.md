# Rest arguments

`#` in a pattern takes any number of things. Labelled, it keeps them as a group.

```punk
count-all:(#)[count!.?]
count-all![a b c]
```
**`3`**

```punk
first-and-rest:(f:_ r:#)[[f?] [r?]]
first-and-rest![1 2 3 4]
```
**`[1 [2 3 4]]`**
