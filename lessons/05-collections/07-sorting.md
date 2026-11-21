# Sorting

`sort` sorts ascending and `sortBy` sorts by the result of a function. Neither changes its input (HOF-6).

```punk
[3 1 2] > sort!
```
**`[1 2 3]`**

```punk
[pear fig banana] > sortBy!length?
```
**`[fig pear banana]`**

```punk
people:[[name:Ann age:31] [name:Bob age:25]]
people? > sortBy!(p:_)[p.age?] > map!(p:_)[p.name?]
```
**`[Bob Ann]`**

```punk
[3 1 2] > sort! > rev!
```
**`[3 2 1]`**
