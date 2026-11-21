# Queries

`name?` looks a thing up. Segments after `.` select a named thing or the
nth item, counting from 1 (QRY-3..5).

```punk
person:[name:[Paul Jones] age:42]
person.age?
```
**`42`**

```punk
person:[name:[Paul Jones] age:42]
person.name.2?
```
**`Jones`**

A negative index counts from the end (`-1` is the last item), `a-b` is a
range of items and `a-` runs to the end (QRY-9..12). A range is cut back
to the items that exist, and one that selects nothing gives the non-thing.

```punk
letters:[a b c d]
letters.-1?
```
**`d`**

```punk
letters:[a b c d]
letters.1-2?
```
**`[a b]`**

```punk
letters:[a b c d]
letters.3-?
```
**`[c d]`**

A function or template returns its whole expression, including the named
things it defined while preparing. Name the result and use `-1?` to get just
the final thing.

```punk
g:(n:_)[x:+![n? 1] x? *![x? 2]]
r:g!3
r.-1?
```
**`8`**

A query that does not align with the structure gives the non-thing
(QRY-7).

```punk
person:[name:[Paul Jones] age:42]
person.height?
```
**`[]`**

A name or position held in a thing can be used in a query by putting it in `{ }`. The embed is evaluated first, and its text is used as the segment.

```punk
person:[name:Paul age:42]
field:age
[person.{field?}?]!
```
**`42`**

It also works inside a function, so a group of names can be mapped to their values.

```punk
person:[name:Paul age:42 city:Perth]
[name age] > map!(k:_)[person.{k?}?]
```
**`[Paul 42]`**
