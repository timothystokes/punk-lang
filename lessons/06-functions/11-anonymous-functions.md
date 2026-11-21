# Anonymous functions

Every function is anonymous until it is named, so there is no `lambda`. Write it where it is needed.

```punk
[1 2 3] > map!(x:_)[+![x? 1]]
```
**`[2 3 4]`**

```punk
(x:_)[*![x? 3]]!4
```
**`12`**
