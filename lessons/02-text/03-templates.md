# Templates

A thing evaluated with `!` resolves every query and every call inside it
(TMPL-1).

```punk
person:[Paul]
message:[Hello person?]
message!
```
**`[Hello Paul]`**

Without `!` the queries are left as written (TMPL-6).

```punk
person:[Paul]
[Hello person?]
```
**`[Hello person?]`**

Calls evaluate inside a template too. The result of each call lands as
one element (TMPL-5).

```punk
[Total +![1 2]]!
```
**`[Total 3]`**
