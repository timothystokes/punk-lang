# Structured data

Where Python builds classes and dataclasses, Punk uses named things. A record is a group of named things and a function reads its fields with queries.

```punk
person:[name:Paul age:42]
[person.name? person.age?]!
```
**`[Paul 42]`**

A pattern can describe the shape a function accepts.

```punk
birthday:(# | name:_ age:_)[[.name? age:+![.age? 1]]]
birthday![name:Paul age:42]
```
**`[Paul age:43]`**

A "method" is a function that takes the record.

```punk
describe:(# | name:_ age:_)[{.name?} is {.age?}]
describe![name:Paul age:42]
```
**`[Paul is 42]`**
