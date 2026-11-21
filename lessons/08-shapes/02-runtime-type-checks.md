# Runtime type checks

The `is` functions ask what a thing is.

```punk
[isnum!4 isnum!four istext!four isempty![] isfn![(x:_)[x?]]]!
```
**`[TRUE FALSE TRUE TRUE TRUE]`**

```punk
isnamed![a:1]
```
**`TRUE`**

A pattern is a type check too: a function only accepts things of the shape it describes, and anything else is the non-thing (FN-7).

```punk
twice:(n:_)[*![n? 2]]
[twice!4 twice![4 5]]!
```
**`[8 []]`**
