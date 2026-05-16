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
user=> 'hello ⏎
hello
```

**Punk**
```punk
> 42 ⏎
42
```
**Clojure**
```clojure
user=> 42 ⏎
42
```

**Punk**
```punk
> TRUE ⏎
TRUE
```
**Clojure**
```clojure
user=> true ⏎
true
```

**Punk**
```punk
> FALSE ⏎
FALSE
```
**Clojure**
```clojure
user=> false ⏎
false
```

**Punk**
```punk
> NULL ⏎
NULL
```
**Clojure**
```clojure
user=> nil ⏎
nil
```

Punk numbers use European-style decimals {`,` because `.` is reserved
for dereferencing}. Clojure uses `.`.

**Punk**
```punk
> 3,14 ⏎
3,14
```
**Clojure**
```clojure
user=> 3.14 ⏎
3.14
```

## 2. Binding and dereferencing

`name:value` binds; postfix `.` dereferences. In Clojure, `def` binds
at the top level {and a bare symbol auto-dereferences its var}.

**Punk**
```punk
> name:Alice ⏎
> name. ⏎
Alice
```
*{the value bound to `name`. Without the trailing `.`, `name` is just
the literal Thing `name` — binding doesn't change what a bare word
means, only what `.` retrieves.}*

**Clojure**
```clojure
user=> (def name 'Alice) ⏎
user=> name ⏎
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
user=> (println 'hello) ⏎
hello
```

**Punk**
```punk
> log!(hello world) ⏎
hello world
```
**Clojure**
```clojure
user=> (println 'hello 'world) ⏎
hello world
```

## 4. Arithmetic

Punk's arithmetic primitives are bare names {`+!`, `-!`, …};
Clojure uses operator symbols {`+`, `-`, …}.

**Punk**
```punk
> +!(5 3) ⏎
8
```
**Clojure**
```clojure
user=> (+ 5 3) ⏎
8
```

**Punk**
```punk
> -!(10 4) ⏎
6
```
**Clojure**
```clojure
user=> (- 10 4) ⏎
6
```

**Punk**
```punk
> *!(6 7) ⏎
42
```
**Clojure**
```clojure
user=> (* 6 7) ⏎
42
```

**Punk**
```punk
> /!(20 4) ⏎
5
```
**Clojure**
```clojure
user=> (/ 20 4) ⏎
5
```

**Punk**
```punk
> ^!(2 8) ⏎
256
```
**Clojure**
```clojure
user=> (Math/pow 2 8) ⏎
256.0
```

**Punk**
```punk
> %!(10 3) ⏎
1
```
**Clojure**
```clojure
user=> (mod 10 3) ⏎
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
user=> (min 3 1 4 1 5) ⏎
1
```

**Punk**
```punk
> max!(3 1 4 1 5) ⏎
5
```
**Clojure**
```clojure
user=> (max 3 1 4 1 5) ⏎
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
user=> (clojure.string/upper-case "hello") ⏎
"HELLO"
```

**Punk**
```punk
> lower!BOB ⏎
bob
```
**Clojure**
```clojure
user=> (clojure.string/lower-case "BOB") ⏎
"bob"
```

**Punk**
```punk
> split!(a,b,c ,) ⏎
(a b c)
```
**Clojure**
```clojure
user=> (clojure.string/split "a,b,c" #",") ⏎
["a" "b" "c"]
```

**Punk**
```punk
> join!((John Doe) +) ⏎
John+Doe
```
**Clojure**
```clojure
user=> (clojure.string/join "+" ["John" "Doe"]) ⏎
"John+Doe"
```

**Punk**
```punk
> join!((a b c) ,) ⏎
a,b,c
```
**Clojure**
```clojure
user=> (clojure.string/join "," ["a" "b" "c"]) ⏎
"a,b,c"
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
user=> (seq "hello") ⏎
(\h \e \l \l \o)
```

**Punk** {`len!` is shape-aware: text → char count, list → item count, range → span}
```punk
> len!hello ⏎
5
> len!split!hello ⏎
5
```
**Clojure**
```clojure
user=> (count "hello") ⏎
5
```

**Punk** {list builtins are polymorphic on text/numbers}
```punk
> slice!(hello 0~1) ⏎
he
```
**Clojure**
```clojure
user=> (subs "hello" 0 2) ⏎
"he"
```

`startsWith` built from the same polymorphic ops:

**Punk**
```punk
> startsWith:{s:_ p:_}(
    =!(slice!(s. 0 len!p.) p.)
  ) ⏎
> startsWith!(hello he) ⏎
TRUE
```
**Clojure**
```clojure
user=> (defn starts-with? [s p]
         (= (subs s 0 (count p)) p)) ⏎
user=> (starts-with? "hello" "he") ⏎
true
```

## 6. Comparisons and logic

Punk uses `logic.*`; Clojure uses bare predicates. Truthiness rules match:
in both languages `nil`/`NULL` and `false`/`FALSE` are falsy and
everything else is truthy.

**Punk**
```punk
> >!(10 5) ⏎
TRUE
```
**Clojure**
```clojure
user=> (> 10 5) ⏎
true
```

**Punk**
```punk
> <!(3 8) ⏎
TRUE
```
**Clojure**
```clojure
user=> (< 3 8) ⏎
true
```

**Punk**
```punk
> =!(5 5) ⏎
TRUE
```
**Clojure**
```clojure
user=> (= 5 5) ⏎
true
```

**Punk**
```punk
> >!(xyz abc) ⏎
TRUE
```
**Clojure**
```clojure
user=> (pos? (compare "xyz" "abc")) ⏎
true
```

**Punk**
```punk
> =!((1 2 3) (1 2 3)) ⏎
TRUE
```
**Clojure**
```clojure
user=> (= [1 2 3] [1 2 3]) ⏎
true
```

**Punk**
```punk
> not!FALSE ⏎
TRUE
```
**Clojure**
```clojure
user=> (not false) ⏎
true
```

**Punk**
```punk
> not!hello ⏎
FALSE
```
**Clojure**
```clojure
user=> (not 'hello) ⏎
false
```

**Punk**
```punk
> and!(TRUE TRUE TRUE) ⏎
TRUE
```
**Clojure**
```clojure
user=> (and true true true) ⏎
true
```

**Punk**
```punk
> and!(TRUE FALSE TRUE) ⏎
FALSE
```
**Clojure**
```clojure
user=> (and true false true) ⏎
false
```

**Punk**
```punk
> or!(FALSE NULL hello) ⏎
TRUE
```
**Clojure**
```clojure
user=> (or false nil 'hello) ⏎
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
user=> [1 2 3] ⏎
[1 2 3]
```

**Punk**
```punk
> (Alice Bob Charlie) ⏎
(Alice Bob Charlie)
```
**Clojure**
```clojure
user=> '[Alice Bob Charlie] ⏎
[Alice Bob Charlie]
```

**Punk**
```punk
> person:(name:Alice age:30) ⏎
> person.name. ⏎
Alice
```
**Clojure**
```clojure
user=> (def person {:name 'Alice :age 30}) ⏎
user=> (:name person) ⏎
Alice
```

**Punk**
```punk
> person:(name:Alice age:30) ⏎
> person.age. ⏎
30
```
**Clojure**
```clojure
user=> (:age person) ⏎
30
```

## 8. Indexing lists

Punk: `list.0.`, `list.~.`. Clojure: `nth` / `first` / `last`.

**Punk**
```punk
> numbers:(10 20 30) ⏎
> numbers.0. ⏎
10
```
**Clojure**
```clojure
user=> (def numbers [10 20 30]) ⏎
user=> (nth numbers 0) ⏎
10
```

**Punk**
```punk
> numbers.1. ⏎
20
```
**Clojure**
```clojure
user=> (nth numbers 1) ⏎
20
```

**Punk**
```punk
> numbers.~. ⏎
30
```
**Clojure**
```clojure
user=> (last numbers) ⏎
30
```

**Punk**
```punk
> (10 20 30).0. ⏎
10
```
**Clojure**
```clojure
user=> (nth [10 20 30] 0) ⏎
10
```

**Punk**
```punk
> (10 20 30).~. ⏎
30
```
**Clojure**
```clojure
user=> (last [10 20 30]) ⏎
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
user=> (:person (merge {:person 'John} {:person 'Tim})) ⏎
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
user=> (get-in [[1 2] [3 4] [5 6]] [0 0]) ⏎
1
```

**Punk**
```punk
> ((1 2) (3 4) (5 6)).~.~. ⏎
6
```
**Clojure**
```clojure
user=> (last (last [[1 2] [3 4] [5 6]])) ⏎
6
```

**Punk**
```punk
> ((name:Tim age:44) (name:John age:30)).0.name. ⏎
Tim
```
**Clojure**
```clojure
user=> (:name (first [{:name 'Tim :age 44} {:name 'John :age 30}])) ⏎
Tim
```

Postfix indexing is polymorphic in Punk: text and numbers drill down to
characters/digits with the same `.N.` / `.~.` / `.N~M.` chain. Clojure
requires explicit conversion (`seq`/`subs`/`nth`).

**Punk**
```punk
> word:Steve ⏎
Steve
> word.0. ⏎
S
> word.1~3. ⏎
tev
> (Tim Bob).0.0. ⏎
T
```
**Clojure**
```clojure
user=> (first "Steve") ⏎
\S
user=> (subs "Steve" 1 4) ⏎
"tev"
user=> (first (first ["Tim" "Bob"])) ⏎
\T
```

## 9. List operations

**Punk**
```punk
> len!(1 2 3 4) ⏎
4
```
**Clojure**
```clojure
user=> (count [1 2 3 4]) ⏎
4
```

**Punk**
```punk
> concat!((1 2) (3 4)) ⏎
(1 2 3 4)
```
**Clojure**
```clojure
user=> (concat [1 2] [3 4]) ⏎
(1 2 3 4)
```

**Punk**
```punk
> 0~10 ⏎
(0 1 2 3 4 5 6 7 8 9 10)
```
**Clojure** {Punk drops `range` since steps other than 1 aren't supported}
```clojure
user=> (range 0 11) ⏎
(0 1 2 3 4 5 6 7 8 9 10)
```

**Punk**
```punk
> slice!((0 1 2 3 4 5) 0~2) ⏎
(0 1 2)
> slice!((0 1 2 3 4 5) 0 3) ⏎
(0 1 2)
```
**Clojure**
```clojure
user=> (subvec [0 1 2 3 4 5] 0 3) ⏎
[0 1 2]
```

**Punk** {`slice!` accepts a Range value for static bounds or `(start endExclusive)` for computed bounds}
```punk
> slice!((0 1 2 3 4 5) 2~3) ⏎
(2 3)
```
**Clojure**
```clojure
user=> (subvec [0 1 2 3 4 5] 2 4) ⏎
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
user=> (.indexOf [1 2 3] 2) ⏎
1
```

**Punk**
```punk
> contains!((1 2 3) 2) ⏎
TRUE
```
**Clojure**
```clojure
user=> (boolean (some #{2} [1 2 3])) ⏎
true
```

`map`, `filter`, `reduce`:

**Punk**
```punk
> map!(
    {_}(*!(_. 2))
    (1 2 3)
  ) ⏎
(2 4 6)
```
**Clojure**
```clojure
user=> (map (fn [n] (* n 2)) [1 2 3]) ⏎
(2 4 6)
```

**Punk**
```punk
> filter!(
    {_}(=!(%!(_. 2) 0))
    (1 2 3 4)
  ) ⏎
(2 4)
```
**Clojure**
```clojure
user=> (filter even? [1 2 3 4]) ⏎
(2 4)
```

**Punk**
```punk
> reduce!(
    {acc:_ item:_}(+!(acc. item.))
    0
    (1 2 3 4)
  ) ⏎
10
```
**Clojure**
```clojure
user=> (reduce + 0 [1 2 3 4]) ⏎
10
```

### The Lisp spine: `.0.` / `.1~.` / `prep`

Punk replaces Clojure's `first`/`rest` with slice sugar on the postfix-dot
chain: `xs.0.` is `first`, `xs.1~.` is `rest`, and the slice generalises to
`xs.N~M.` (inclusive). `prep!` plays the part of `cons`.

**Punk**
```punk
> (a b c).0. ⏎
a
> (a b c).1~. ⏎
(b c)
> prep!(z (a b c)) ⏎
(z a b c)
> ().0. ⏎
NULL
> ().1~. ⏎
()
```
**Clojure**
```clojure
user=> (first '[a b c]) ⏎
a
user=> (rest '[a b c]) ⏎
(b c)
user=> (cons 'z '[a b c]) ⏎
(z a b c)
user=> (first []) ⏎
nil
user=> (rest []) ⏎
()
```

Recursive `sum`:

**Punk**
```punk
sum:{lst:_}(
  len!lst.?(
    {0}(0)
    {_}(+!(lst.0. sum!(lst.1~.)))
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
user=> (sum [1 2 3 4 5]) ⏎
15
```

### Range literals

Punk's `N~M` is the inclusive cousin of Clojure's `(range a b)`. It also
shares the `~` glyph with the slice form, so the same operator builds a
list of integers and indexes into it.

**Punk**
```punk
> 1~5 ⏎
(1 2 3 4 5)
> sum!(1~100) ⏎
5050
> (1~10).2~4. ⏎
(3 4 5)
```
**Clojure**
```clojure
user=> (range 1 6) ⏎
(1 2 3 4 5)
user=> (reduce + (range 1 101)) ⏎
5050
user=> (subvec (vec (range 1 11)) 2 5) ⏎
[3 4 5]
```

Open forms (`1~`, `~5`, `~`) are lazy and only legal where context
provides a bound; Clojure's `(range)` is similarly an unbounded lazy seq.

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
user=> (-> "hello" seq first) ⏎
\h
user=> (-> [1 2 3] count) ⏎
3
```

`|` is a standalone token — whitespace either side is optional. Same
freedom as Clojure's `->` reader macro, just expressed as infix:

```punk
> hello|split.|head. ⏎
h
> hello | split. | head. ⏎
h
```

### Pipe-fn binding `name:|` — point-free composition

A headless pipeline is a deferred function. Bind it with `:|`
{adjacent, no space} and it's a reusable function value — Punk's
equivalent of Clojure's `comp`, expressed in the language's own
pipeline grammar.

**Punk**
```punk
> twice:|inc.|inc. ⏎
> twice!5 ⏎
7
> flow:|inc.|*'2.|+'1. ⏎
> flow!3 ⏎
9
```
**Clojure**
```clojure
user=> (def twice (comp inc inc)) ⏎
user=> (twice 5) ⏎
7
user=> (def flow (comp #(+ % 1) #(* % 2) inc)) ⏎
user=> (flow 3) ⏎
9
```

Pipe-fns are first-class — map them, branch on them, pipe them again:

**Punk**
```punk
> map!(twice. (1 2 3)) ⏎
(3 4 5)
> 5?twice. ⏎
7
```
**Clojure**
```clojure
user=> (map twice [1 2 3]) ⏎
(3 4 5)
```

## 10. Functions

Punk's `{pattern}(body)` corresponds to Clojure's `(fn [params] body)`.
Both use **last-expression-is-value** body semantics.

**Punk**
```punk
> double:{_}(*!(_. 2)) ⏎
> double!5 ⏎
10
```
**Clojure**
```clojure
user=> (defn double [n] (* n 2)) ⏎
user=> (double 5) ⏎
10
```

Multi-statement body {in Clojure, use `let` for local bindings}:

**Punk**
```punk
> compute:{_}(
    y:+!(_. 1)
    *!(y. 10)
  ) ⏎
> compute!4 ⏎
50
```
**Clojure**
```clojure
user=> (defn compute [x]
         (let [y (+ x 1)]
           (* y 10))) ⏎
user=> (compute 4) ⏎
50
```

Two arguments:

**Punk**
```punk
> add:{a:_ b:_}(+!(a. b.)) ⏎
> +!(5 3) ⏎
8
```
**Clojure**
```clojure
user=> (defn add [a b] (+ a b)) ⏎
user=> (add 5 3) ⏎
8
```

Variadic parameter — Punk's `{___}` {three underscores} maps to Clojure's
`& args`. Inside any Punk function body, `_.` is the raw argument as passed:

**Punk**
```punk
> all:{___}(_.) ⏎
> all!(a b c) ⏎
(a b c)
```
**Clojure**
```clojure
user=> (defn all [& xs] xs) ⏎
user=> (all 'a 'b 'c) ⏎
(a b c)
```

**Punk**
```punk
> pairAll:{a:_ b:_}(_.) ⏎
> pairAll!(1 2) ⏎
(1 2)
```
**Clojure**
```clojure
;; No exact equivalent — Clojure params don't double as "the whole input"
user=> (defn pair-all [a b] [a b]) ⏎
user=> (pair-all 1 2) ⏎
[1 2]
```

Anonymous slots — Punk patterns may omit names entirely, and the
implicit `_` binding stands in for the raw argument:

**Punk**
```punk
> processOne:{_}(_.) ⏎
> processOne!hello ⏎
hello
> processTwo:{_ _}(+!(_.0. _.1.)) ⏎
> processTwo!(3 4) ⏎
7
> processN:{___}(len!_.) ⏎
> processN!(a b c) ⏎
3
```
**Clojure**
```clojure
;; Clojure requires a binding name; nearest equivalents:
user=> (defn process-one [x] x) ⏎
user=> (defn process-two [[a b]] (+ a b)) ⏎
user=> (defn process-n [& xs] (count xs)) ⏎
```

Functions are first-class values:

**Punk**
```punk
> double:{_}(*!(_. 2)) ⏎
> map!(double. (1 2 3)) ⏎
(2 4 6)
```
**Clojure**
```clojure
user=> (defn double [n] (* n 2)) ⏎
user=> (map double [1 2 3]) ⏎
(2 4 6)
```

Anonymous functions:

**Punk**
```punk
> map!({_}(^!(_. 2)) (1 2 3)) ⏎
(1 4 9)
```
**Clojure**
```clojure
user=> (map #(* % %) [1 2 3]) ⏎
(1 4 9)
```

## 10b. Partial application `'`

Punk's `'` mirrors `!` (same arg forms, same evaluation) but pre-binds
the args and returns a Partial instead of invoking. Later `!` extends
the captured args and runs the function. Clojure uses `partial` for the
same job.

**Punk**
```punk
> addTen:+'10 ⏎
> addTen!5 ⏎
15
```
**Clojure**
```clojure
user=> (def add-ten (partial + 10)) ⏎
user=> (add-ten 5) ⏎
15
```

Pre-bind multiple positions with the args-list form `'(a b)`:

**Punk**
```punk
> add3:{a:_ b:_ c:_}(+!(a. +!(b. c.))) ⏎
> add12:add3'(1 2) ⏎
> add12!10 ⏎
13
```
**Clojure**
```clojure
user=> (defn add3 [a b c] (+ a b c)) ⏎
user=> (def add12 (partial add3 1 2)) ⏎
user=> (add12 10) ⏎
13
```

Partials can be further partialled by name:

**Punk**
```punk
> addOne:add3'1 ⏎
> twoPlus:addOne'2 ⏎
> twoPlus!7 ⏎
10
```
**Clojure**
```clojure
user=> (def add-one (partial add3 1)) ⏎
user=> (def two-plus (partial add-one 2)) ⏎
user=> (two-plus 7) ⏎
10
```

Where Clojure makes `partial` a higher-order function, Punk makes
partial application a primary operator — symmetric with the call
operator `!`. `!` always invokes; under-arity on a fixed-arity function
is an error rather than an implicit partial. Use `'` explicitly when
you want to defer the call.

The function-first arg order on `map`/`filter`/`reduce`/`flatMap` is
deliberate — it lets you build reusable transformers via partial:

**Punk**
```punk
> incAll:map'{_}(+!(_. 1)) ⏎
> incAll!(1 2 3) ⏎
(2 3 4)
> sum:reduce'(+. 0) ⏎
> sum!(1 2 3 4 5) ⏎
15
```
**Clojure**
```clojure
user=> (def inc-all (partial map inc)) ⏎
user=> (inc-all [1 2 3]) ⏎
(2 3 4)
user=> (def sum (partial reduce + 0)) ⏎
user=> (sum [1 2 3 4 5]) ⏎
15
```

## 11. Pattern dispatch

Clojure has no built-in destructure-and-dispatch matcher in `core` — the
standard tool is `core.match`, or `cond` / `case` / `if`. Punk has one
unified `?` operator that takes function values as branches; the first
whose pattern matches the LHS value runs, else `NULL`.

```punk
# Pattern-bearing function values are just functions
isFive:{5}(yes)             # only matches the number 5
firstChar:{(c:_ __)}(c.)    # destructure a list
```
```clojure
;; Clojure equivalents (predicate + accessor, no reified pattern)
(defn five? [x] (= x 5))
(defn first-char [[c & _]] c)
```

### 11a. Single-branch dispatch

Match → run body; miss → `NULL`. The branch can be a function ref or
an inline literal:

**Punk**
```punk
> isFive:{5}(yes) ⏎
> 5?isFive. ⏎
yes
> 3?isFive. ⏎
NULL
> 5?{5}(yes) ⏎
yes
```
**Clojure**
```clojure
user=> (when (five? 5) 'yes) ⏎
yes
user=> (when (five? 3) 'yes) ⏎
nil
```

The body is **lazy** — only the matched branch runs, so side effects in
unmatched branches don't fire.

### 11b. Multi-branch dispatch

Pass a list of function values; the first match wins.

**Punk**
```punk
> classify:{_}(
    _.?(
      {1}(one)
      {2}(two)
      {_}(other)
    )
  ) ⏎
> classify!1 ⏎
one
> classify!9 ⏎
other
```
**Clojure**
```clojure
user=> (defn classify [x]
         (cond
           (= x 1) 'one
           (= x 2) 'two
           :else   'other)) ⏎
user=> (classify 1) ⏎
one
user=> (classify 9) ⏎
other
```

If/else is a literal-match plus a wildcard:

**Punk**
```punk
> v.?({TRUE}(yes) {_}(no)) ⏎
```
**Clojure**
```clojure
(if v 'yes 'no)
```

`?` is a standalone token like `|` — whitespace either side is
optional, so dispatch can be terse or spaced:

**Punk**
```punk
> 5?{5}(yes) ⏎
yes
> 5 ? {5}(yes) ⏎
yes
> 5 ? ( {1}(one) {5}(five) {_}(other) ) ⏎
five
```

Branches see their pattern bindings, so dispatch on shape is one form:

**Punk**
```punk
describe:{___}(
  _.?(
    {(name:_)}(prep!(name. (one)))
    {(first:_ last:_)}(two)
    {_}(other)
  )
)
```
**Clojure** (with `core.match`)
```clojure
(require '[clojure.core.match :refer [match]])
(defn describe [xs]
  (match [xs]
    [[name]]        ['just name]
    [[first last]]  ['both first last]
    :else            'something-else))
```

### Regex slots

Punk lets a pattern slot be a regex literal `"..."`. The slot binds to
`(whole g1 g2 ...)`; `(?<name>...)` groups are also bound at top level
inside the body. In `?` dispatch a non-matching regex skips the branch,
so it acts like a regex case statement.

**Punk**
```punk
classify:{_}(_.?(
  {n:"^\d+$"}(number)
  {w:"^[a-z]+$"}(word)
  {_}(other)
))
```

**Clojure** (closest equivalent is `condp re-matches` or `core.match`'s
guard support, which is a bit more verbose):
```clojure
(defn classify [x]
  (condp re-matches (str x)
    #"^\d+$"   'number
    #"^[a-z]+$" 'word
    'other))
```

Punk's regex captures bind by name automatically, so `parseDate` is a
single signature rather than `let`-destructuring after `re-find`.

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
user=> "." ⏎
"."
```

**Punk**
```punk
> \/ ⏎
/
```
**Clojure**
```clojure
user=> "/" ⏎
"/"
```

**Punk**
```punk
> \\ ⏎
\\
```
**Clojure**
```clojure
user=> "\\" ⏎
"\\"
```

**Punk**
```punk
> (Hello \. world\.) ⏎
(Hello . world.)
```
**Clojure**
```clojure
user=> ["Hello" "." "world."] ⏎
["Hello" "." "world."]
```

### Multi-word text

Punk has no way to embed a space inside a single Thing — space is the
list delimiter, full stop. Multi-word text is just a list. Clojure
strings have no such restriction.

**Punk**
```punk
> (Hello World) ⏎
(Hello World)
```
**Clojure**
```clojure
user=> "Hello World" ⏎
"Hello World"
```

**Punk**
```punk
> len!(Hello World) ⏎
2
```
**Clojure**
```clojure
user=> (count "Hello World") ⏎
11
```

**Punk**
```punk
> len!((Hello World)) ⏎
1
```
**Clojure**
```clojure
user=> (count ["Hello World"]) ⏎
1
```

**Punk**
```punk
> join!((John Doe) -) ⏎
John-Doe
```
**Clojure**
```clojure
user=> (clojure.string/join "-" ["John" "Doe"]) ⏎
"John-Doe"
```

`+`, `-`, `*`, `/`, `^`, `%`, `=`, `<`, and `>` are **not** special inside a
Thing — they're ordinary characters. They become callable Thing-name
builtins only when followed by `!` or `.`, e.g. `+!(1 2)` is 3.

**Punk**
```punk
> a+b ⏎
a+b
```
**Clojure**
```clojure
user=> "a+b" ⏎
"a+b"
```

## 13. Mutable cells

Punk cells map directly to Clojure atoms.

**Punk**
```punk
> counter:[0] ⏎
> counter-> ⏎
0
```
**Clojure**
```clojure
user=> (def counter (atom 0)) ⏎
user=> @counter ⏎
0
```

**Punk**
```punk
> counter:[0] ⏎
> counter<-5 ⏎
> counter-> ⏎
5
```
**Clojure**
```clojure
user=> (def counter (atom 0)) ⏎
user=> (reset! counter 5) ⏎
user=> @counter ⏎
5
```

**Punk**
```punk
> counter:[0] ⏎
> counter<-5 ⏎
> counter<-+!(counter-> 1) ⏎
> counter-> ⏎
6
```
**Clojure**
```clojure
user=> (def counter (atom 0)) ⏎
user=> (reset! counter 5) ⏎
user=> (swap! counter inc) ⏎
user=> @counter ⏎
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
user=> (def held '(println "hi")) ⏎
#'user/held
```
*{nothing runs}*

**Punk**
```punk
> held:(log!(hi)) ⏎
> held! ⏎
hi
```
**Clojure**
```clojure
user=> (def held '(println "hi")) ⏎
user=> (eval held) ⏎
hi
```

**Punk**
```punk
> (log!(hi))! ⏎
hi
```
**Clojure**
```clojure
user=> (eval '(println "hi")) ⏎
hi
```

A "macro" in Punk is just a function that takes a `(…)` argument and
applies `!` to it itself — no special syntax required. Clojure has a
real `defmacro` form for this, but the everyday analogue is `when`.

**Punk**
```punk
> when:{test:_ body:_}(test.?{TRUE}(body!)) ⏎
> when!(TRUE (log!(hi))) ⏎
hi
> when!(FALSE (log!(nope))) ⏎
```
**Clojure**
```clojure
;; `when` already exists in core
user=> (when true (println "hi")) ⏎
hi
user=> (when false (println "nope")) ⏎
nil
```
```clojure
;; If you wanted to define it yourself — this is what a Clojure macro looks like
user=> (defmacro my-when [test & body]
         `(if ~test (do ~@body))) ⏎
user=> (my-when true (println "hi")) ⏎
hi
```

## 15. Recursion and tail calls

Both languages trampoline tail calls. Clojure makes the tail call
**explicit** with `recur`; Punk detects it automatically.

Non-tail recursion {uses the stack in both}:

**Punk**
```punk
fact:{_}(
  _.?(
    {0}(1)
    {_}(*!(_. fact!-!(_. 1)))
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
user=> (fact 10) ⏎
3628800
```

Tail-call optimised loop:

**Punk**
```punk
countdown:{_}(
  _.?(
    {0}(done)
    {_}(countdown!-!(_. 1))    # implicit tail call
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
user=> (countdown 100000) ⏎
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
| Anonymous fn      | `{_}(…)` {single arg} / `{n:_}(…)` {named} | `#(…)` / `(fn [n] …)`             |
| Last-expression body | yes                                  | yes                                  |
| Variadic param    | `{___}` / `_.`                          | `& xs`                               |
| Dispatch (1 branch) | `value?fn.` / `value?{p}(body)`        | `(when (pred? v) then)`              |
| Dispatch (n branches) | `value?(fn1 fn2 fn3)`                 | `(cond …)` / `core.match`            |
| Cell / Atom       | `[value]` / `c->` / `c<-v`              | `(atom value)` / `@a` / `(reset! a v)` |
| Code as data      | `(forms)` {data} / `(forms)!` {run}     | `'(forms)` / `(eval '(forms))`       |
| Tail call         | implicit {in tail position}             | explicit `(recur …)`                 |
| Pipeline          | `a \| f. \| g.`                         | `(-> a f g)`                         |
| Spine             | `xs.0.` `xs.1~.` `prep!` | `first` `rest` `cons`              |

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

* **Pattern dispatch.** Punk has one unified `?` operator that takes
  function values as branches and dispatches on pattern match. Clojure
  ships `cond` / `case` / `if` in core and leaves destructuring patterns
  to `core.match`.

* **Macros.** Clojure macros are a separate syntactic phase {`defmacro`,
  `~`, `~@`}. Punk uses the homoiconic nature directly — a function
  that receives a `(…)` and applies `!` to it is, effectively, a macro.
