# Pipes

`>` passes the result of one stage to the next (PIPE-1).

```punk
welcome:(name:_)[Hello .name?]
Sally > welcome! > upper!
```
**`[HELLO SALLY]`**

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
