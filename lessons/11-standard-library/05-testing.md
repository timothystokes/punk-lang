# Testing

A test is an `assert` with a message. A failing one prints its message and gives the non-thing, so a run can show every failure.

```punk
double:(n:_)[*![n? 2]]
assert![=![double!4 8] double of 4]
```
**`TRUE`**
