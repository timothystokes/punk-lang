# Embeds

Inside an evaluated template, `{query?}` joins its result to the text
around it with no space (EMB-3, EMB-4).

```punk
env:prod
[{env?}-database]!
```
**`prod-database`**

A multi-element result keeps its internal spaces and the template is
re-read, so the number of things can change (EMB-9, EMB-10).

```punk
name:[Paul Jones]
[Dr-{name?}]!
```
**`[Dr-Paul Jones]`**

```punk
name:[Paul Jones]
[Dr-{name?}]! > count!
```
**`2`**

Embeds also work in names, so a name can be computed (NAME-8).

```punk
k:colour
v:red
x:{k?}:{v?}
x.colour?
```
**`red`**

A failed query embeds as nothing (EMB-7).

```punk
[a{missing?}b]!
```
**`ab`**
