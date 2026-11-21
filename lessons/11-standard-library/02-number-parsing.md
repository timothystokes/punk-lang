# Number parsing

Text that looks like a number is already a number to Punk's arithmetic. `num` makes it explicit, and gives the non-thing when the text is not a number.

```punk
num!42
```
**`42`**

```punk
num!abc
```
**`[]`**

```punk
[3.5 x 10] > map!num? > filter!(n:_)[isnum!n?]
```
**`[3.5 10]`**
