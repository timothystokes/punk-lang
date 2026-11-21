# Strings

Text is just words in a group. Library functions work on it and never change the original (LIB-3).

```punk
upper!hello
```
**`HELLO`**

```punk
[upper!hello lower!WORLD length!punk]!
```
**`[HELLO world 4]`**

```punk
trim![  padded  ]
```
**`padded`**

`split` and `join` convert between text and groups. The separator comes first.

```punk
split![, a,b,c]
```
**`[a b c]`**

```punk
join![- [a b c]]
```
**`a-b-c`**

```punk
replace![l L hello]
```
**`heLLo`**

`sub` takes the start and end positions and then the text, `repeat` a count and then the text.

```punk
sub![2 4 hello]
```
**`ell`**

```punk
repeat![3 ab]
```
**`ababab`**

```punk
[startsWith![he hello] endsWith![lo hello] chars!abc]!
```
**`[TRUE TRUE [a b c]]`**

`pad` takes a width, a fill character and then the text.

```punk
pad![8 * hello]
```
**`***hello`**
