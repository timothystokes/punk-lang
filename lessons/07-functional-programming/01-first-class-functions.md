# First-class functions

A function is a thing like any other. You can name it, pass it to other functions and return it from one. `(params)[body]` makes a function and `:` names it.

```punk
hello:()[Hello world]
hello!
```
**`[Hello world]`**

A function can have several cases, tried in order, so one function can answer for no arguments, one, two or any number more. `argcount` counts its arguments with a case for each small size and `r:#` to take the rest.

```punk
argcount:(#)[
  .?
  -> ()[0]!
  -> (_)[1]!
  -> (_ _)[2]!
  -> (_ _ r:#)[+![2 count!r?]]!
]
[argcount! argcount!a argcount![a b] argcount![a b c d e]]!
```
**`[0 1 2 5]`**

A function made inside another closes over the names around it.

```punk
make-adder:(x:_)[
  (z:_)[+![x? z?]]
]
add2:make-adder!2
add2!4
```
**`6`**

Names are not variables. Once a name has a value it keeps it, so a closure can never see a captured value change.
