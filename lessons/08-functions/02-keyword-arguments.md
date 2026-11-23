# Keyword arguments

A name is part of the thing, so a function can ask for named things in any order with a such-that pattern: the part after `|` is matched by name.

```punk
describe:(- | name:_ age:_)[{.name?} is {.age?}]
describe![age:42 name:Paul]
```
**`[Paul is 42]`**

If a named thing is missing the call gives the non-thing.

```punk
describe:(- | name:_ age:_)[{.name?} is {.age?}]
describe![name:Paul]
```
**`[]`**
