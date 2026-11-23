# Sorting

`sort` takes a comparator as its first item. Pass `[]` for the default
ascending comparison. Neither form changes its input (HOF-6).

```punk
sort![[] 3 1 2]
```
**`[1 2 3]`**

```punk
compare:(a:_ b:_)[-![a? b?]]
[3 1 2] > sort!compare?
```
**`[1 2 3]`**

```punk
byAge:(a:_ b:_)[-![a.age? b.age?]]
people:[[name:Ann age:31] [name:Bob age:25]]
people? > sort!byAge? > map!(p:_)[p.name?]
```
**`[Bob Ann]`**

```punk
[3 1 2] > sort![] > rev!
```
**`[3 2 1]`**
