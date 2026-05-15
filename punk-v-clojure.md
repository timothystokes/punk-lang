# Punk vs Clojure — Side by Side

A walk through the same examples as [punk-by-example.md](./punk-by-example.md),
with the Clojure equivalent next to each Punk snippet. Punk borrows ideas
from Lisp/Clojure {lists-as-everything, last-expression-is-value bodies,
homoiconic code-as-data, `recur`-style tail calls} but spells them with a
postfix `.` / `!` syntax instead of S-expressions.

Where the two languages disagree on philosophy — Punk has only Things
{no separate string / keyword / map types}; Clojure has rich literal
types — the Clojure column shows the most idiomatic translation rather
than a literal one.

## 1. The simplest expressions

A literal Thing — a word, a number, a boolean — just *is* itself.

**Punk**
```punk
> hello ⏎
hello
```
**Clojure**
```clojure
;; A bare word would be resolved as a var, so quote it to keep it literal
user=> 'hello
hello
```

**Punk**
```punk
> 42 ⏎
42
```
**Clojure**
```clojure
user=> 42
42
```

**Punk**
```punk
> TRUE ⏎
TRUE
```
**Clojure**
```clojure
user=> true
true
```

**Punk**
```punk
> FALSE ⏎
FALSE
```
**Clojure**
```clojure
user=> false
false
```

**Punk**
```punk
> NULL ⏎
NULL
```
**Clojure**
```clojure
user=> nil
nil
```

Punk numbers use European-style decimals {`,` because `.` is reserved
for dereferencing}. Clojure uses `.`.

**Punk**
```punk
> 3,14 ⏎
3.14
```
**Clojure**
```clojure
user=> 3.14
3.14
```

## 2. Binding and dereferencing

`name:value` binds; postfix `.` dereferences. In Clojure, `def` binds
at the top level {and a bare symbol auto-dereferences its var}.

**Punk**
```punk
> name:Alice
> name. ⏎
Alice
```
*{the value bound to `name`. Without the trailing `.`, `name` is just
the literal Thing `name` — binding doesn't change what a bare word
means, only what `.` retrieves.}*

**Clojure**
```clojure
user=> (def name 'Alice)
#'user/name
user=> name
Alice
```
*{in Clojure a bare symbol auto-dereferences; you'd need `'name` to
keep it literal.}*

## 3. Calling functions

A Punk call is `name!arg`; in Clojure it's `(name arg)`.

**Punk**
```punk
> log!hello ⏎
hello
```
**Clojure**
```clojure
user=> (println 'hello)
hello
```

**Punk**
```punk
> log!(hello world) ⏎
hello world
```
**Clojure**
```clojure
user=> (println 'hello 'world)
hello world
```

## 4. Arithmetic

Punk's arithmetic primitives are bare names {`add!`, `sub!`, …};
Clojure uses operator symbols {`+`, `-`, …}.

**Punk**
```punk
> add!(5 3) ⏎
8
```
**Clojure**
```clojure
user=> (+ 5 3)
8
```

**Punk**
```punk
> sub!(10 4) ⏎
6
```
**Clojure**
```clojure
user=> (- 10 4)
6
```

**Punk**
```punk
> mul!(6 7) ⏎
42
```
**Clojure**
```clojure
user=> (* 6 7)
42
```

**Punk**
```punk
> div!(20 4) ⏎
5
```
**Clojure**
```clojure
user=> (/ 20 4)
5
```

**Punk**
```punk
> pow!(2 8) ⏎
256
```
**Clojure**
```clojure
user=> (Math/pow 2 8)
256.0
```

**Punk**
```punk
> mod!(10 3) ⏎
1
```
**Clojure**
```clojure
user=> (mod 10 3)
1
```

Variadic min/max:

**Punk**
```punk
> min!(3 1 4 1 5) ⏎
1
```
**Clojure**
```clojure
user=> (min 3 1 4 1 5)
1
```

**Punk**
```punk
> max!(3 1 4 1 5) ⏎
5
```
**Clojure**
```clojure
user=> (max 3 1 4 1 5)
5
```

## 5. Text

Punk has no string type — text is just a Thing. Clojure has real strings,
so most text operations live in `clojure.string`.

**Punk**
```punk
> upper!hello ⏎
HELLO
```
**Clojure**
```clojure
user=> (clojure.string/upper-case "hello")
"HELLO"
```

**Punk**
```punk
> lower!BOB ⏎
bob
```
**Clojure**
```clojure
user=> (clojure.string/lower-case "BOB")
"bob"
```

**Punk**
```punk
> split!(a,b,c ,) ⏎
(a b c)
```
**Clojure**
```clojure
user=> (clojure.string/split "a,b,c" #",")
["a" "b" "c"]
```

**Punk**
```punk
> join!((John Doe) +) ⏎
John+Doe
```
**Clojure**
```clojure
user=> (clojure.string/join " " ["John" "Doe"])
"John Doe"
```

**Punk**
```punk
> join!((a b c) ,) ⏎
a,b,c
```
**Clojure**
```clojure
user=> (clojure.string/join ", " ["a" "b" "c"])
"a, b, c"
```

Punk's `split!` has two forms: with a delimiter it splits at each
occurrence, with just a Thing {no delimiter} it decomposes into
single-character Things. `join!` is its inverse — with a delimiter it
glues elements with that delimiter, alone it concatenates them flush.
Clojure splits these jobs between `clojure.string/split`, `seq`, `apply
str`, and `clojure.string/join`.

**Punk**
```punk
> split!hello ⏎
(h e l l o)
```
**Clojure**
```clojure
user=> (seq "hello")
(\h \e \l \l \o)
```

**Punk**
```punk
> len!(split!hello) ⏎
5
```
**Clojure**
```clojure
user=> (count "hello")
5
```

**Punk**
```punk
> join!(slice!(split!hello 0 2)) ⏎
he
```
**Clojure**
```clojure
user=> (apply str (take 2 "hello"))
"he"
```

`startsWith` built from the spine:

**Punk**
```punk
> startsWith:{s:_ p:_}(
    chars: split!s.
    prefix: split!p.
    eq!(slice!(chars. 0 len!(prefix.)) prefix.)
  )
> startsWith!(hello he) ⏎
TRUE
```
**Clojure**
```clojure
user=> (defn starts-with? [s p]
         (= (subs s 0 (count p)) p))
user=> (starts-with? "hello" "he")
true
```

## 6. Comparisons and logic

Punk uses `logic.*`; Clojure uses bare predicates. Truthiness rules match:
in both languages `nil`/`NULL` and `false`/`FALSE` are falsy and
everything else is truthy.

**Punk**
```punk
> gt!(10 5) ⏎
TRUE
```
**Clojure**
```clojure
user=> (> 10 5)
true
```

**Punk**
```punk
> lt!(3 8) ⏎
TRUE
```
**Clojure**
```clojure
user=> (< 3 8)
true
```

**Punk**
```punk
> eq!(5 5) ⏎
TRUE
```
**Clojure**
```clojure
user=> (= 5 5)
true
```

**Punk**
```punk
> gt!(xyz abc) ⏎
TRUE
```
**Clojure**
```clojure
user=> (pos? (compare "xyz" "abc"))
true
```

**Punk**
```punk
> eq!((1 2 3) (1 2 3)) ⏎
TRUE
```
**Clojure**
```clojure
user=> (= [1 2 3] [1 2 3])
true
```

**Punk**
```punk
> not!FALSE ⏎
TRUE
```
**Clojure**
```clojure
user=> (not false)
true
```

**Punk**
```punk
> not!hello ⏎
FALSE
```
**Clojure**
```clojure
user=> (not 'hello)
false
```

**Punk**
```punk
> and!(TRUE TRUE TRUE) ⏎
TRUE
```
**Clojure**
```clojure
user=> (and true true true)
true
```

**Punk**
```punk
> and!(TRUE FALSE TRUE) ⏎
FALSE
```
**Clojure**
```clojure
user=> (and true false true)
false
```

**Punk**
```punk
> or!(FALSE NULL hello) ⏎
TRUE
```
**Clojure**
```clojure
user=> (or false nil 'hello)
hello
```
*{Clojure's `or` returns the first truthy value, not `true` — but it's
still truthy.}*

## 7. Lists

Punk lists hold Things. A "named Thing in a list" plays the role of a
map entry — in Clojure that's an actual map.

**Punk**
```punk
> (1 2 3) ⏎
(1 2 3)
```
**Clojure**
```clojure
user=> [1 2 3]
[1 2 3]
```

**Punk**
```punk
> (Alice Bob Charlie) ⏎
(Alice Bob Charlie)
```
**Clojure**
```clojure
user=> '[Alice Bob Charlie]
[Alice Bob Charlie]
```

**Punk**
```punk
> person:(name:Alice age:30)
> person.name. ⏎
Alice
```
**Clojure**
```clojure
user=> (def person {:name 'Alice :age 30})
user=> (:name person)
Alice
```

**Punk**
```punk
> person:(name:Alice age:30)
> person.age. ⏎
30
```
**Clojure**
```clojure
user=> (:age person)
30
```

## 8. Indexing lists

Punk: `list.0.`, `list.~.`. Clojure: `nth` / `first` / `last`.

**Punk**
```punk
> numbers:(10 20 30)
> numbers.0. ⏎
10
```
**Clojure**
```clojure
user=> (def numbers [10 20 30])
user=> (nth numbers 0)
10
```

**Punk**
```punk
> numbers.1. ⏎
20
```
**Clojure**
```clojure
user=> (nth numbers 1)
20
```

**Punk**
```punk
> numbers.~. ⏎
30
```
**Clojure**
```clojure
user=> (last numbers)
30
```

**Punk**
```punk
> (10 20 30).0. ⏎
10
```
**Clojure**
```clojure
user=> (nth [10 20 30] 0)
10
```

**Punk**
```punk
> (10 20 30).~. ⏎
30
```
**Clojure**
```clojure
user=> (last [10 20 30])
30
```

Named access — when two items share a name, the last wins. In Clojure,
that maps to merging maps.

**Punk**
```punk
> (person:John person:Tim).person. ⏎
Tim
```
**Clojure**
```clojure
user=> (:person (merge {:person 'John} {:person 'Tim}))
Tim
```

Chained indexing:

**Punk**
```punk
> ((1 2) (3 4) (5 6)).0.0. ⏎
1
```
**Clojure**
```clojure
user=> (get-in [[1 2] [3 4] [5 6]] [0 0])
1
```

**Punk**
```punk
> ((1 2) (3 4) (5 6)).~.~. ⏎
6
```
**Clojure**
```clojure
user=> (last (last [[1 2] [3 4] [5 6]]))
6
```

**Punk**
```punk
> ((name:Tim age:44) (name:John age:30)).0.name. ⏎
Tim
```
**Clojure**
```clojure
user=> (:name (first [{:name 'Tim :age 44} {:name 'John :age 30}]))
Tim
```

## 9. List operations

**Punk**
```punk
> len!((1 2 3 4)) ⏎
4
```
**Clojure**
```clojure
user=> (count [1 2 3 4])
4
```

**Punk**
```punk
> concat!((1 2) (3 4)) ⏎
(1 2 3 4)
```
**Clojure**
```clojure
user=> (concat [1 2] [3 4])
(1 2 3 4)
```

**Punk**
```punk
> range!(1 6 1) ⏎
(1 2 3 4 5)
```
**Clojure**
```clojure
user=> (range 1 6 1)
(1 2 3 4 5)
```

**Punk**
```punk
> range!(0 10 2) ⏎
(0 2 4 6 8)
```
**Clojure**
```clojure
user=> (range 0 10 2)
(0 2 4 6 8)
```

**Punk**
```punk
> slice!((0 1 2 3 4 5) 0 3) ⏎
(0 1 2)
```
**Clojure**
```clojure
user=> (subvec [0 1 2 3 4 5] 0 3)
[0 1 2]
```

**Punk**
```punk
> slice!((0 1 2 3 4 5) 2 4) ⏎
(2 3)
```
**Clojure**
```clojure
user=> (subvec [0 1 2 3 4 5] 2 4)
[2 3]
```

Search:

**Punk**
```punk
> find!((1 2 3) 2) ⏎
1
```
**Clojure**
```clojure
user=> (.indexOf [1 2 3] 2)
1
```

**Punk**
```punk
> contains!((1 2 3) 2) ⏎
TRUE
```
**Clojure**
```clojure
user=> (boolean (some #{2} [1 2 3]))
true
```

`map`, `filter`, `reduce`:

**Punk**
```punk
> map!(
    (1 2 3)
    {n:_}(mul!(n. 2))
  ) ⏎
(2 4 6)
```
**Clojure**
```clojure
user=> (map (fn [n] (* n 2)) [1 2 3])
(2 4 6)
```

**Punk**
```punk
> filter!(
    (1 2 3 4)
    {n:_}(eq!(mod!(n. 2) 0))
  ) ⏎
(2 4)
```
**Clojure**
```clojure
user=> (filter even? [1 2 3 4])
(2 4)
```

**Punk**
```punk
> reduce!(
    (1 2 3 4)
    {acc:_ item:_}(add!(acc. item.))
    0
  ) ⏎
10
```
**Clojure**
```clojure
user=> (reduce + 0 [1 2 3 4])
10
```

### The Lisp spine: `head` / `tail` / `prepend`

This is where Punk and Clojure line up most directly — Punk's names are
just different spellings of `first` / `rest` / `cons`.

**Punk**
```punk
> head!((a b c)) ⏎
a
> tail!((a b c)) ⏎
(b c)
> prepend!(z (a b c)) ⏎
(z a b c)
> head!(()) ⏎
NULL
> tail!(()) ⏎
()
```
**Clojure**
```clojure
user=> (first '[a b c])
a
user=> (rest '[a b c])
(b c)
user=> (cons 'z '[a b c])
(z a b c)
user=> (first [])
nil
user=> (rest [])
()
```

Recursive `sum`:

**Punk**
```punk
sum:{lst:_}(
  len!(lst.) ?? (
    (0 0)
    (_ add!(head!(lst.) sum!(tail!(lst.))))
  )
)
> sum!((1 2 3 4 5)) ⏎
15
```
**Clojure**
```clojure
(defn sum [lst]
  (if (empty? lst)
    0
    (+ (first lst) (sum (rest lst)))))
user=> (sum [1 2 3 4 5])
15
```

### Pipeline `|`

Punk's `|` is exactly Clojure's thread-first `->` {since each Punk stage
takes the previous value as its single argument}.

**Punk**
```punk
> hello | split. | head. ⏎
h
> (1 2 3) | len. ⏎
3
```
**Clojure**
```clojure
user=> (-> "hello" seq first)
\h
user=> (-> [1 2 3] count)
3
```

## 10. Functions

Punk's `{pattern}(body)` corresponds to Clojure's `(fn [params] body)`.
Both use **last-expression-is-value** body semantics.

**Punk**
```punk
> double:{n:_}(mul!(n. 2))
> double!5 ⏎
10
```
**Clojure**
```clojure
user=> (defn double [n] (* n 2))
user=> (double 5)
10
```

Multi-statement body {in Clojure, use `let` for local bindings}:

**Punk**
```punk
> compute:{x:_}(
    y:add!(x. 1)
    mul!(y. 10)
  )
> compute!4 ⏎
50
```
**Clojure**
```clojure
user=> (defn compute [x]
         (let [y (+ x 1)]
           (* y 10)))
user=> (compute 4)
50
```

Two arguments:

**Punk**
```punk
> add:{a:_ b:_}(add!(a. b.))
> add!(5 3) ⏎
8
```
**Clojure**
```clojure
user=> (defn add [a b] (+ a b))
user=> (add 5 3)
8
```

Variadic parameter — Punk's `{*}` / `*.` maps to Clojure's `& args`:

**Punk**
```punk
> all:{*}(*.)
> all!(a b c) ⏎
(a b c)
```
**Clojure**
```clojure
user=> (defn all [& xs] xs)
user=> (all 'a 'b 'c)
(a b c)
```

**Punk**
```punk
> pairAll:{a:_ b:_}(*.)
> pairAll!(1 2) ⏎
(1 2)
```
**Clojure**
```clojure
;; No exact equivalent — Clojure params don't double as "the whole input"
user=> (defn pair-all [a b] [a b])
user=> (pair-all 1 2)
[1 2]
```

Functions are first-class values:

**Punk**
```punk
> double:{n:_}(mul!(n. 2))
> map!((1 2 3) double.) ⏎
(2 4 6)
```
**Clojure**
```clojure
user=> (defn double [n] (* n 2))
user=> (map double [1 2 3])
(2 4 6)
```

Anonymous functions:

**Punk**
```punk
> map!((1 2 3) {n:_}(pow!(n. 2))) ⏎
(1 4 9)
```
**Clojure**
```clojure
user=> (map #(* % %) [1 2 3])
(1 4 9)
```

## 11. Pattern matching

Clojure has no built-in destructure-and-dispatch pattern matcher in
`core` — the standard tool is `core.match`. For most of Punk's `?`/`??`
uses, idiomatic Clojure is `cond` / `case` / `if`.

```punk
isTim:{Tim}             # matches exactly the Thing `Tim`
isFive:{5}              # matches the number 5
isPair:{_ _}            # matches any 2-element list
startsWithThree:{3 *}   # matches any list starting with 3
```
```clojure
;; Clojure analogues (predicates rather than reified patterns)
(defn tim? [x] (= x 'Tim))
(defn five? [x] (= x 5))
(defn pair? [x] (and (sequential? x) (= 2 (count x))))
(defn starts-with-three? [x]
  (and (sequential? x) (= 3 (first x))))
```

### 11a. Conditionals — `?`

Predicate form:

**Punk**
```punk
> isFive:{5}
> isFive?5 ⏎
TRUE
```
**Clojure**
```clojure
user=> (defn five? [x] (= x 5))
user=> (five? 5)
true
```

**Punk**
```punk
> isFive?3 ⏎
FALSE
```
**Clojure**
```clojure
user=> (five? 3)
false
```

Match-or-null:

**Punk**
```punk
> isFive?(5 yes) ⏎
yes
```
**Clojure**
```clojure
user=> (when (five? 5) 'yes)
yes
```

**Punk**
```punk
> isFive?(3 yes) ⏎
NULL
```
**Clojure**
```clojure
user=> (when (five? 3) 'yes)
nil
```

Lazy evaluation of the `then` branch — Punk and Clojure's `when` / `if`
agree here.

**Punk**
```punk
> isFive?(5 (log!matched mul!(5 2))!) ⏎
matched
10
```
**Clojure**
```clojure
user=> (when (five? 5)
         (println 'matched)
         (* 5 2))
matched
10
```

Bind first, test second:

**Punk**
```punk
> isPair:{_ _}
> pair:(1 2)
> isPair?pair. ⏎
TRUE
```
**Clojure**
```clojure
user=> (defn pair? [x] (and (sequential? x) (= 2 (count x))))
user=> (def pair [1 2])
user=> (pair? pair)
true
```

### 11b. Multiple patterns — `??`

Punk's `??` is closest to Clojure's `cond`, or `core.match`'s `match`
when destructuring is involved.

**Punk**
```punk
> wild:{_}
> classify:{x:_}(
    x.??(
      (1 one)
      (2 two)
      (wild. other)
    )
  )
> classify!1 ⏎
one
```
**Clojure**
```clojure
user=> (defn classify [x]
         (cond
           (= x 1) 'one
           (= x 2) 'two
           :else   'other))
user=> (classify 1)
one
```

**Punk**
```punk
> classify!9 ⏎
other
```
**Clojure**
```clojure
user=> (classify 9)
other
```

A case with no body — Punk returns `NULL`, Clojure idiom is just `nil`:

**Punk**
```punk
> isOne:{1}
> 1??((isOne.)(_ other)) ⏎
NULL
```
**Clojure**
```clojure
user=> (cond
         (= 1 1) nil
         :else   'other)
nil
```

**Punk**
```punk
> 9??((isOne.)(_ other)) ⏎
other
```
**Clojure**
```clojure
user=> (cond
         (= 9 1) nil
         :else   'other)
other
```

## 12. Escaping special characters

Clojure uses real strings, so there's nothing to escape at the "Thing"
level — most Punk escapes become "just put the character in a string."

**Punk**
```punk
> \. ⏎
.
```
**Clojure**
```clojure
user=> "."
"."
```

**Punk**
```punk
> \/ ⏎
/
```
**Clojure**
```clojure
user=> "/"
"/"
```

**Punk**
```punk
> \\ ⏎
\\
```
**Clojure**
```clojure
user=> "\\"
"\\"
```

**Punk**
```punk
> (Hello \. world\.) ⏎
(Hello . world.)
```
**Clojure**
```clojure
user=> ["Hello" "." "world."]
["Hello" "." "world."]
```

### The `+` space marker

Punk needs `+` to put a space *inside* one Thing because space is a
delimiter. Clojure strings have no such restriction.

**Punk**
```punk
> Hello+World ⏎
Hello+World
```
**Clojure**
```clojure
user=> "Hello World"
"Hello World"
```

**Punk**
```punk
> len!(split!Hello+World) ⏎
11
```
**Clojure**
```clojure
user=> (count "Hello World")
11
```

**Punk**
```punk
> len!((Hello+World)) ⏎
1
```
**Clojure**
```clojure
user=> (count ["Hello World"])
1
```

**Punk**
```punk
> join!((John Doe) +) ⏎
John+Doe
```
**Clojure**
```clojure
user=> (clojure.string/join " " ["John" "Doe"])
"John Doe"
```

**Punk**
```punk
> a\+b ⏎
a\+b
```
**Clojure**
```clojure
user=> "a+b"
"a+b"
```

## 13. Mutable cells

Punk cells map directly to Clojure atoms.

**Punk**
```punk
> counter:[0]
> counter> ⏎
0
```
**Clojure**
```clojure
user=> (def counter (atom 0))
user=> @counter
0
```

**Punk**
```punk
> counter:[0]
> counter<5
> counter> ⏎
5
```
**Clojure**
```clojure
user=> (def counter (atom 0))
user=> (reset! counter 5)
user=> @counter
5
```

**Punk**
```punk
> counter:[0]
> counter<5
> counter<add!(counter> 1)
> counter> ⏎
6
```
**Clojure**
```clojure
user=> (def counter (atom 0))
user=> (reset! counter 5)
user=> (swap! counter inc)
user=> @counter
6
```

## 14. Data, code, and `(…)!`

Both languages are homoiconic: code is data. Punk's `( )` is held as
data; `!` evaluates it. Clojure's equivalent is `'(…)` {quoted list}
held as data, with `eval` evaluating it.

**Punk**
```punk
> held:(log!(hi)) ⏎
```
*{nothing runs}*

**Clojure**
```clojure
user=> (def held '(println "hi"))
#'user/held
```
*{nothing runs}*

**Punk**
```punk
> held:(log!(hi))
> held! ⏎
hi
```
**Clojure**
```clojure
user=> (def held '(println "hi"))
user=> (eval held)
hi
```

**Punk**
```punk
> (log!(hi))! ⏎
hi
```
**Clojure**
```clojure
user=> (eval '(println "hi"))
hi
```

A "macro" in Punk is just a function that takes a `(…)` argument and
applies `!` to it itself — no special syntax required. Clojure has a
real `defmacro` form for this, but the everyday analogue is `when`.

**Punk**
```punk
> when:{test:_ body:_}(test. ? (TRUE body!))
> when!(TRUE (log!(hi))) ⏎
hi
> when!(FALSE (log!(nope))) ⏎
```
**Clojure**
```clojure
;; `when` already exists in core
user=> (when true (println "hi"))
hi
user=> (when false (println "nope"))
nil
```
```clojure
;; If you wanted to define it yourself — this is what a Clojure macro looks like
user=> (defmacro my-when [test & body]
         `(if ~test (do ~@body)))
user=> (my-when true (println "hi"))
hi
```

## 15. Recursion and tail calls

Both languages trampoline tail calls. Clojure makes the tail call
**explicit** with `recur`; Punk detects it automatically.

Non-tail recursion {uses the stack in both}:

**Punk**
```punk
fact:{n:_}(
  n. ?? (
    (0 1)
    (_ mul!(n. fact!sub!(n. 1)))
  )
)
> fact!10 ⏎
3628800
```
**Clojure**
```clojure
(defn fact [n]
  (if (zero? n)
    1
    (* n (fact (dec n)))))
user=> (fact 10)
3628800
```

Tail-call optimised loop:

**Punk**
```punk
countdown:{n:_}(
  n. ?? (
    (0 done)
    (_ countdown!sub!(n. 1))   # implicit tail call
  )
)
> countdown!100000 ⏎
done
```
**Clojure**
```clojure
(defn countdown [n]
  (if (zero? n)
    'done
    (recur (dec n))))                ;; explicit `recur`
user=> (countdown 100000)
done
```

---

## Quick Reference — side by side

| Concept           | Punk                                    | Clojure                              |
| ----------------- | --------------------------------------- | ------------------------------------ |
| Bind              | `name:value`                            | `(def name value)`                   |
| Dereference       | `name.`                                 | `name`                               |
| List              | `(a b c)`                               | `[a b c]` / `'(a b c)`               |
| Map-like          | `(name:Alice age:30)`                   | `{:name 'Alice :age 30}`             |
| Index             | `xs.0.` / `xs.~.`                       | `(nth xs 0)` / `(last xs)`           |
| By name           | `xs.name.`                              | `(:name xs)`                         |
| Call              | `f!arg`                                 | `(f arg)`                            |
| Function value    | `f.`                                    | `f`                                  |
| Anonymous fn      | `{n:_}(…)`                              | `(fn [n] …)` / `#(…)`                |
| Last-expression body | yes                                  | yes                                  |
| Variadic param    | `{*}` / `*.`                            | `& xs`                               |
| Predicate         | `pattern?value`                         | `(pred? value)`                      |
| Match-or-null     | `pattern?(v then)`                      | `(when (pred? v) then)`              |
| Multi-pattern     | `v??((p1 r1) (p2 r2) …)`                | `(cond …)` / `core.match`            |
| Cell / Atom       | `[value]` / `c>` / `c<v`                | `(atom value)` / `@a` / `(reset! a v)` |
| Code as data      | `(forms)` {data} / `(forms)!` {run}     | `'(forms)` / `(eval '(forms))`       |
| Tail call         | implicit {in tail position}             | explicit `(recur …)`                 |
| Pipeline          | `a \| f. \| g.`                         | `(-> a f g)`                         |
| Spine             | `head!` `tail!` `prepend!` | `first` `rest` `cons`              |

## Where the languages part ways

* **Types.** Punk has one type {Thing}; Clojure has numbers, strings,
  keywords, symbols, vectors, lists, maps, sets, characters. Punk's
  single-type philosophy means text is just a Thing and `split!`
  → `list.*` covers what Clojure splits between `clojure.string` and
  the seq library.

* **Syntax.** Punk is postfix {`name.`, `f!arg`, `xs.0.`}; Clojure is
  prefix S-expressions. Both are homoiconic; both treat lists as the
  primary code form.

* **Recursion.** Clojure makes the tail call explicit with `recur` and
  refuses to TCO non-tail calls. Punk infers tail position and
  trampolines automatically — at the cost of having to keep the rules
  in your head.

* **Pattern matching.** Punk bakes patterns into the language with
  `?` / `??`. Clojure ships `cond` / `case` / `if` in core and leaves
  destructuring patterns to `core.match`.

* **Macros.** Clojure macros are a separate syntactic phase {`defmacro`,
  `~`, `~@`}. Punk uses the homoiconic nature directly — a function
  that receives a `(…)` and applies `!` to it is, effectively, a macro.
