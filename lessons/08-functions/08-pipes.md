# Pipes

`>` passes the result of one stage to the next (PIPE-1).

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome! > upper!
```
**`[HELLO SALLY]`**

An inline function without `!` is passed to the next stage as a function
reference. Add `!` when the inline function should receive the piped thing and
pass its result onward.

```punk
1 > (n:_)[n?] > isfn!
```
**`TRUE`**

```punk
1 > (n:_)[n?]! > isfn!
```
**`FALSE`**

A pipe is a function, so it can be named (PIPE-4), and the result of a
pipe can be named (PIPE-5).

```punk
welcome:(name:_)[Hello .name?]
shout:> welcome! > upper!
Jim > shout!
```
**`[HELLO JIM]`**

```punk
y:[a b c]
size:y? > count!
size?
```
**`3`**
