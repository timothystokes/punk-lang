# Protocols and overloads

Python describes what an object can do with a protocol. A Punk pattern describes what a thing contains, so any record with the right named things qualifies, whatever else it has. Cases give you overloads by trying one pattern after another.

```punk
describe:(#)[
.?
-> (# | name:_)[named .name?]!
-> (_ _)[a pair]!
-> (_)[something else]!
]
[describe![name:Paul age:42] describe![1 2] describe!5]!
```
**`[[named Paul] [a pair] [something else]]`**
