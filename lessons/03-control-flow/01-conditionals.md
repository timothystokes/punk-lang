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
-> (_)[You need to provide two things]!
```
**`[JOHN SMITH]`**

A parent case works like an outer `if`, and its sub-cases like the `if`s inside it. Here the parent asks "is this a book?" and the sub-cases ask about the quantity.

```punk
order:[item:book qty:0]
order?
-> (- | item:book)[book]!
--> (- | qty:0)[out of stock]!
--> (- | qty:1)[one left]!
-> (_ _)[something else]!
```
**`[out of stock]`**

If the parent matches but none of its sub-cases do, the result is `[]`. The case is already decided as a book, so the later `(_ _)` case is not tried. Here a book with a quantity of 5 has no sub-case, so the result is `[]`.

```punk
order:[item:book qty:5]
order?
-> (- | item:book)[book]!
--> (- | qty:0)[out of stock]!
--> (- | qty:1)[one left]!
-> (_ _)[something else]!
```
**`[]`**

When the parent does not match, the next top-level case is tried as usual.

```punk
order:[item:pen qty:5]
order?
-> (- | item:book)[book]!
--> (- | qty:0)[out of stock]!
-> (_ _)[something else]!
```
**`[something else]`**

If nothing matches at the top level the result is also the non-thing
(CASE-7).
