# Enums

An enum is a group of named things. Look a member up by name, or ask for its name.

```punk
colour:[red:1 green:2 blue:3]
colour.green?
```
**`2`**

```punk
colour:[red:1 green:2 blue:3]
colour? > map!(v:_ k:_)[k?]
```
**`[red green blue]`**

Literals in a pattern restrict a function to a fixed set of values, much like `Literal`.

```punk
mood:(happy)[smile]
[mood!happy mood!sad]!
```
**`[smile []]`**
