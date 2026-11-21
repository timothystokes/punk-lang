# Currying

Give a function fewer things than its pattern expects and you get a new
function waiting for the rest (CURRY-1, CURRY-2). In a pipe the attached
things fill first and the piped thing fills the rest (CURRY-4).

```punk
timesTwo:*!2
4 > timesTwo!
```
**`8`**

```punk
4 > -!8 > *!7
```
**`28`**

This is the same as

```punk
*![-![8 4] 7]
```
**`28`**
