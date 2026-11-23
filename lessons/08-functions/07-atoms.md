# Atoms

An atom is a global place to keep state that changes while a program runs. Write one with a pipe and read it by naming it.

```punk
[1 2] > @list!
@list
```
**`[1 2]`**

An atom that has never been written is `[]`.

```punk
@nothingYet
```
**`[]`**

Writing returns the stored thing, so a counter is a pipe from the atom back into itself.

```punk
1 > @count!
@count > +!5 > @count!
@count
```
**`6`**

`<>` is a compact atom swap. Spaces may surround it, but `<` and `>` must
stay together. The stage receives the atom's current value, and its result is
stored back and returned.

```punk
1 > @countSwap!
[@countSwap <> +!5 @countSwap]!
```
**`[6 6]`**
