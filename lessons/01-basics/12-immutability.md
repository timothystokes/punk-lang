# Immutability

Python lists and dictionaries change in place, so Punk's answer to "mutability" is that nothing mutates. Every library function returns a new thing and leaves its input alone (LIB-3).

```punk
a:[3 1 2]
b:sort!a?
[a? b?]!
```
**`[[3 1 2] [1 2 3]]`**

To "update" a record, build a new one from the old (the `!` evaluates the lookup inside the group).

```punk
person:[name:Paul age:42]
older:[person.name? age:43]!
older?
```
**`[Paul age:43]`**
