# Conditional guards

A guard is a case with a narrow pattern, placed first. The first matching case wins and the rest are never tried.

```punk
describe:(n:_)[
  n?
  -> (0)[zero]!
  -> (1)[one]!
  -> (_)[many]!
]
[describe!0 describe!1 describe!7]!
```
**`[zero one many]`**

A function in a case can ask a question with a comparison.

```punk
sign:(n:_)[
  gt![n? 0]
  -> (TRUE)[positive]!
  -> (_)[not positive]!
]
[sign!5 sign!-5]!
```
**`[positive [not positive]]`**
