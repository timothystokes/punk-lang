# Cases

`->` starts a case: a function or pipe tried against the subject on the
line above. The first case that matches runs, and no later case is tried
(CASE-1..3).

```punk
number:43
number?
-> (42)[This is Forty Two]!
-> (n:_)[This is .n?]!
```
**`[This is 43]`**

More arrows make sub-cases, tried only if their parent matched (CASE-4,
CASE-5). If the parent matches but no sub-case does, the result is the
non-thing, with no fall through (CASE-6).

```punk
person:[name:[John Smith] role:vip]
person?
-> (_ _)[.?]!
--> (n:_ vip)[.n?]! > upper!
--> (n:_ _)[.n?]!
-> (_)[You need to provide two names]!
```
**`[JOHN SMITH]`**

```punk
x:5
x?
-> (5)[a]!
--> (6)[sub]!
-> (5)[b]!
```
**`[]`**

If nothing matches at the top level the result is also the non-thing
(CASE-7).
