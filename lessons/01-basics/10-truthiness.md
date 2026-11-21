# Truthiness

Python decides whether things are truthy or falsy. Punk does not: only the word `TRUE` is true. Anything else, including `1`, `yes` and `[]`, is not (HOF-5).

```punk
[1 2 3 4] > filter!(n:_)[n?]
```
**`[]`**

```punk
[TRUE FALSE yes 1] > filter!(x:_)[=![x? TRUE]]
```
**`TRUE`**

To ask a real question use a comparison or a test function.

```punk
[isnum!4 isnum!x isempty![] istext!abc]!
```
**`[TRUE FALSE TRUE TRUE]`**
