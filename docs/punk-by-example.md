# Punk

Punk is an interpreted functional programming language that runs on any javascript implementation. It focuses on the idea that any language is made up of words, numbers and structure and so it's primary utility is to manipulate words, numbers and structure.

## Reading the examples

Throughout this document, code blocks marked `punk` follow REPL conventions:

| Mark | Meaning |
| --- | --- |
| `>` | a line of input typed into the Punk REPL |
| `⏎` | the end of an input line (where you'd press Enter) |
| anything else | the REPL's response on the next line |
| `# ... #` | a comment — comments are bracketed by `#` on both ends |

Whitespace inside `{ ... }` and `( ... )` is the item separator. Any run of spaces, tabs or newlines counts as a single separator, so indentation and line breaks are free to use for readability — they carry no meaning of their own.

## Templates

Any code that is defined before it gets executed is essentially a template. Punk defines templates using { }.

```punk
> {Hello world} ⏎ # The shortest program in Punk #
{Hello world}
```

A single tempalte with static text in it is the closest thing to a string in Punk.

### Numbers inside templates

Numbers are templates too. A few formatting rules keep them unambiguous against text:

| Form | Notes |
| --- | --- |
| `42` | a whole number |
| `0.5` | a decimal — a leading `0` is required (`.5` would look like a path segment) |
| `-5` | a negative number — the `-` is part of the number |
| `3.141` | the `.` inside a number is just text; path-query rules only kick in for tokens that end in `?` or `!` |

## Named Things

Everything in Punk can be given a name. Names are needed to be able to refer to things later or in other contexts. To name something in Punk we use pattern name:thing

```punk
> message:{Hello world} ⏎ 
message:{Hello world}
```

In this case we name named the template from above.

## Querying a name

The way to query for the thing based on it's name is by using the ? query notation.

```punk
> message? ⏎ 
{Hello world}
```

> Q: What does a single words do on it's own if there is no : to assign it as a name or ? to query for a value?
> A: Any single word evaluated by Punk is interpreted as a template.

> Q: Can i leave a space between the : and the thing I'm naming?
> A: No you are literally attaching the name to a thing so it must be connected else is will look, feel and be interpreted as two things. 
>
> A name on it's own is to name nothing and if resolved would return NULL. As Punk is a functional programing languages where names are imutable then this isn't very practical. 

## Nested Templates

Templates can also ontain further queries.

```punk
> person:Tim ⏎ # This is the same as person:{Tim} see QA above. #
person:{Tim}
> message:{Hello person?} ⏎ 
message:{Hello person?}
```

This is still a template so the person? reference is not resolved yet. When we query message from the outside then it cascades that query directive to all child queries in it's structure.

```punk
> message? ⏎ 
{Hello Tim}
```

> NOTE: Templates are **lazy** and carry their definition scope with them. The items inside `{...}` are stored as-written; queries like `person?` are not resolved until something forces them (a `?` query into the template, or any operation that needs the resolved form). When they do resolve, they resolve against the env where the template was **defined**, not the env where it's queried — exactly like a function closure. This is what makes `message:{Hello person?}` keep working even after `message` is passed elsewhere: the template remembers that `person` was `Tim` in its home scope.

### Data Structures

Templates can be used to define complext data structures.

```punk
> people:{
    a:{name:{John Smith} location:{New York}}
    b:{name:{Jane Green} location:{Sydney}}
  } ⏎ 
```

### Querying into a template structure

Information from a template can be queried without having to get the whole value. the . notation is used to provide the nested segments of a query.

> NOTE: Queries work on the **content** of a thing — the items inside, delimited by space — not on the outer wrapper. The `{` and `}` (or `(` and `)`) are just brackets that mark where a template or pattern begins and ends; they aren't counted, they aren't indexable, and they don't add a layer. So in `xs:{a b c}`, the content of `xs` is three things separated by spaces, and `xs.#?` is `3`, not `5`. The same idea is why text has structure: the content of the word `Sydney` is six characters in sequence, so `.5?` reaches the `e`. A query asks "what's inside?", never "what kind of bracket is around it?".

### Query by name

Getting a value based on it's position in a template can be done using nested name reference. For example to get the value of person a from above then you can do..

```punk
> people.a? ⏎
{name:{John Smith} location:{New York}} 
```

Or deeper.

```punk
> people.a.name? ⏎
{John Smith}
```

> NOTE: There is only one collection type in Punk which is a bybrid Array/List/Map type thing. It can hold named and un-named things and retains order so can be used like an array also.

### Query by index

Or even deeper using the structure in the name templates we can reference the first and second names by index. In Punk indexes start at 1, sorry I am a punk after all! 

```punk
> people.a.name.1? ⏎
{John}
```

Even though the people are named with a and b we can still get other parts of the template by index.

```punk
> people.2.location? ⏎
{Sydney} 
```

Going even further there is still structure that we can query because even a word has structure. Extracting the 5th character of the second person's location. 

```punk
> people.2.location.5? ⏎
{e} 
```

### Query by ranges

In punk and range of integers can be specified using the ~ notation. 

```punk
> numbers:5~15 ⏎
{5 6 7 8 9 10 11 12 13 14 15} 
```

Ranges can be used in querying.

```punk
> numbers.2~3? ⏎
{6 7} 
```

Ranges can also be unbound in some circumstances such as querying. In this case all items in the numbers template up to and including position 4.

```punk
> numbers.~4? ⏎
{5 6 7 8} 
```

Or in this case from position 7 to the last item.

```punk
> numbers.7~? ⏎
{11 12 13 14 15} 
```

There is one extra way of using ~ for convenience. On it's own it will return the last item.

```punk
> numbers.~? ⏎
{15} 
```

### Query for length

Use `#` as a path segment to ask for the number of items at that point in the structure.

```punk
> numbers.#? ⏎
{11}
> people.#? ⏎
{2}
> people.a.name.#? ⏎
{2}
```

The same `#` is used for comments at statement level, but the two never collide: a path is a single space-free token, so the `#` inside `numbers.#?` is part of the path. A `#` that *starts* a token opens a comment — "starts a token" meaning it has either whitespace OR a bracket (`{`, `}`, `(`, `)`, `[`, `]`) immediately before it. So `{# greeting # hi}` and `{hi # tail #}` are both fine — the comment can sit flush against the surrounding brackets. The closing `#` follows the same rule on its right side.

### Query options summary

A query is a single space-free path token ending in `?`. The path is built from one or more **segments** separated by `.`. The segments are:

| Segment | Meaning | Example |
| --- | --- | --- |
| `name` | a starting name to look up | `person?` |
| `.name` | step into a named item | `people.a?` |
| `.N` | step into item at position `N` (1-based) | `people.2?` |
| `.~` | step into the last item | `numbers.~?` |
| `.N~M` | a slice from position `N` through `M` (inclusive) | `numbers.2~3?` |
| `.~M` | a slice from the start through position `M` | `numbers.~4?` |
| `.N~` | a slice from position `N` through to the end | `numbers.7~?` |
| `.#` | the count of items at this point | `numbers.#?` |

Segments compose freely — `people.a.name.1?` mixes name and index steps; `people.2.location.5?` walks all the way down to a single character; `numbers.2~3.#?` would take a slice and then ask for its count.

> NOTE: queries always see the **content** of a ref, not the wrapper. A name-bound `location:{Sydney}` is a single-item template wrapping the word `Sydney` — but `location.5?` doesn't see "one item", it sees the content "Sydney" and the 5th character is `e`. The result is shown as `{e}` because Punk has no exposed primitives; everything that comes back from a query is displayed wrapped. The same rule applies to NamedThings — stepping into one transparently looks at its value.

The trailing `?` is what turns a name-with-dots into a query. Without it, the same sequence is just text — `people.a.name` on its own is the literal thing `people.a.name`, not a lookup.

> Q: What if i want to use a ? in my template as a normal question mark?
> A: Just escape it using \? so for example {What is you name\?} ;name will not be interpreted when you query this template.

> Q: What about the dots in a template? How do I use normal full stop/period?  
> A: They are only interpreted as part of a singular query expression so in normal use they don't do anything special. Escaping ? is enough to have normal text evaluated as text. Exclamation points ! do need to be escaped as well as : if used as normal text. See Appendix for full list

## Punk Data Notation (PDN)

Everything you've seen so far is also a data format. A Punk program *is* its own data — there is no separate syntax for "writing down a value" vs "writing code that produces a value". The same characters that bind names, group things, and attach names to values in source are how data is serialised, sent over the wire, written to disk, or pasted into a config file.

This is what is meant by **PDN — Punk Data Notation**: the readable surface of every Punk value, identical to the surface you'd write in source.

```punk
# a record-shaped value #
{name:{Jane Green} age:42 location:{Sydney}}

# a list of records #
{
  {name:{John Smith} age:39 location:{New York}}
  {name:{Jane Green} age:42 location:{Sydney}}
}

# a single number, a single thing, an empty list #
42
Sydney
{}
```

Everything in PDN is made from four ingredients:

1. **Things** — bare words and numbers (`Sydney`, `42`, `3.141`, `-5`).
2. **Templates** — space-separated things between `{` and `}` (`{a b c}`).
3. **Named things** — a name **attached** to a value with `:` and **no space** between them (`age:42`, `location:{Sydney}`).
4. **Regex literals** — text-shaped data between `"` quotes when you need spaces or escapes (`"hello world"`).

> NOTE: The space after `:` matters. `age:42` is one named thing — a key-value pair you can query as `.age?`. `age: 42` is two separate things (`age:` bound to nothing, then `42`). They look almost identical and they mean very different things. The same rule is what makes `{left:red right:blue}` a queryable record and `{left: red right: blue}` just four pieces of text. If the colon is meant as ordinary punctuation rather than a binder, escape it: `{John\: Smith}`.

PDN has no separate syntax for strings, dictionaries, arrays, or tuples — they all collapse into things, templates, and named things. A "string" with no spaces is just a thing (`Sydney`). A "string" with spaces is a list of things (`{Jane Green}`). A "dictionary" is a template of named things. An "array" is a template of un-named things. A "tuple" is the same template by another name. The display form `{...}` you see when the REPL prints a value is literal PDN — copy it, paste it back into source, and it's the same value again.

The flip side: any data file written in PDN is a valid Punk source file. Loading config, reading a record from disk, or accepting a request payload are all just `import!` or a `read!` followed by ordinary path queries — there's no parse step, because the data is already in the language's own grammar.

## Patterns

A pattern is a way of defining a data shape that can be compared with things. Where there is a match then decitions can be made in your Punk program. Patterns are defined using ( ) notation.

```punk
> (John) ⏎ # matches a template with the literal value {John} #
> (45) ⏎ # matches a template with the literal value {45} #
> (_) ⏎ # matches any template with a single thing inside it #
> (___) ⏎ # matches any template with zero or more things inside it #
```

> NOTE: An empty pattern `()` and an empty template `{}` are not the same thing. `{}` is a value — a template with no items in it. `()` is a *shape* — it matches only against an empty template. They look symmetrical but they live in different worlds.

### Matching by shape

Because the items inside a pattern are matched **positionally**, the *shape* of a pattern — how many slots it has and what's in each — is what decides whether a template matches.

```punk
> (_ _) ⏎ # exactly two things, any values #
> (_ _ _) ⏎ # exactly three things #
> () ⏎ # the empty pattern — matches only the empty template #
```

Literals and wildcards can be mixed in the same pattern. A literal slot matches only that exact value; a `_` slot matches anything in that position.

```punk
> (hello _) ⏎ # two things, the first must be {hello} #
> (_ 0) ⏎ # two things, the second must be {0} #
> (John _ Smith) ⏎ # three things, with the middle one free #
> (TRUE _ _) ⏎ # three things starting with {TRUE} #
```

The variadic wildcard `___` consumes any number of things — zero or more — and can be combined with fixed slots to match "this then anything", "anything then that", or "this surrounded by anything".

```punk
> (_ ___) ⏎ # one thing followed by any number of others #
> (___ _) ⏎ # any number of things followed by exactly one #
> (start ___ end) ⏎ # begins with {start}, ends with {end}, anything between #
> (___ TRUE ___) ⏎ # contains {TRUE} somewhere — anywhere #
```

> NOTE: Only one variadic `___` slot is allowed in a pattern, because two would make the split between them ambiguous.

Patterns nest. A slot in a pattern can itself be a pattern, which constrains the shape of the *thing* at that position.

```punk
> ((_ _) _) ⏎ # a pair followed by a single thing #
> ((John _) _) ⏎ # first item is a pair starting with {John}, then anything #
> point:(x:_ y:_) ⏎ # a named pair-shape #
> (point point) ⏎ # two points — uses point's shape as the slot constraint #
```

Slots can be both named and constrained at the same time. The name is just a local binding; the shape on the right of the `:` is what's matched.

```punk
> (head:_ tail:___) ⏎ # first thing bound to head; rest bound to tail #
> (first:_ middle:___ last:_) ⏎ # three names spanning a template of two or more #
> (name:John age:_) ⏎ # first must be {John}, second is bound to age #
```

### Regex slots

A pattern slot can also be a regex literal written inside double quotes `"..."`. It matches a single thing whose text satisfies the regex.

```punk
> ("^\d+$") ⏎ # one thing made entirely of digits #
> ("hello") ⏎ # one thing whose text contains hello #
> (_ "^\d+$") ⏎ # two things, the second made entirely of digits #
```

Like any slot, a regex slot can be named — the name binds to the matched thing for use in the attached template.

```punk
> tagger:(n:"^\d+$"){
    Number:n?
  } ⏎
> tagger!42 ⏎
{Number:42}
```

#### Capture groups

A regex with capture groups binds the named slot to a small structure rather than a bare thing: the full match at position 1, then each capture group in the order it appears.

```punk
> halve:(p:"^(\w+)-(\w+)$"){
    left:p.2? right:p.3?
  } ⏎
> halve!{red-blue} ⏎
{left:red right:blue}
```

`p.1?` is the whole match (`red-blue`), `p.2?` is the first group, `p.3?` is the second.

#### Named capture groups

Named groups `(?<name>...)` are bound the usual positional way **and** are also reachable by their name on the slot.

```punk
> parseDate:(s:"^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$"){
    s.y? s.m? s.d?
  } ⏎
> parseDate!2024-01-15 ⏎
{2024 01 15}
```

#### Unmatched groups

A group that didn't participate in the match (for example, an alternative branch that wasn't taken, or an optional `(...)?`) is bound as `NULL` rather than missing or causing a failure.

```punk
> classify:(p:"^(?<sign>[+-])?(?<n>\d+)$"){
    p.sign??{
      (NULL){unsigned p.n?}
      (_){signed p.n?}
    }
  } ⏎
> classify!42 ⏎
{unsigned 42}
> classify!-7 ⏎
{signed 7}
```

The slot itself only binds at all when the whole regex matches; if the regex doesn't match the input, the *pattern* doesn't match and the next pattern in a dispatch is tried. `NULL` is reserved for groups that didn't capture — it's a value the function can inspect and handle, not a failure mode.

Patterns can also be named.

```punk
> isFive:(5) ⏎
```

### Using Patterns

A pattern can be applied as a condition to any query.

```punk
> number:5 # named thing # ⏎
> number?(6) ⏎
FALSE  
```

In this case the 5 does not match 6 so the pattern returns FALSE

### Using Patterns for conditions

Rather than just return true or false, a pattern can have a template attached to use in the case of a match.

```punk
> number:5 # named thing # ⏎
> number?(5){Found five.} ⏎
```

This gives us the same functionality as an if statement in other languages.

> Q: What about else-if or else?
> A: `??` is the same kind of conditional query as `?(pattern){...}`, just one that accepts a list of conditions instead of one. Each condition is a pattern/template pair and Punk picks the first whose pattern matches.

```punk
> tim?(tim){yes} ⏎              # single condition #
{yes}
> tim??{(tim){yes} (bob){no}} ⏎ # list of conditions #
{yes}
```

```punk
> number:5 # named thing # ⏎
> number??{
    (5){Found five.}
    (7){Found seven.}
    (_){Found something else.}
  } ⏎
```

Punk will find the first matching pattern and then query that template.

> NOTE: Results of conditional queries:
> - `value?(pattern)` — bare predicate. Returns `TRUE` if the pattern matches, `FALSE` if not.
> - `value?(pattern){template}` — if-then. Returns the template result on match, `NULL` on miss.
> - `value??{ ... }` — multi-branch. First match wins. With no matching branch it's a **runtime error**. To make a `??` total, give it a final catch-all branch — `(_){...}` for a single thing, `(___){...}` for any shape at all.

### Truthiness

Anywhere Punk needs a yes/no answer — most commonly inside `??` branches that check a condition — the rule is simple:

| Value | Counts as |
| --- | --- |
| `FALSE` | false |
| `NULL` | false |
| anything else (including `0`, `{}`, `()`) | true |

So a `value??{(TRUE){...}(FALSE){...}}` block covers the explicit boolean cases, and a `(_)` catch-all picks up everything else as "truthy".

### Naming patter segments

You can give the shapes in your patterns names that can then be referenced in their attached templates.

```punk
> number:5 # named thing # ⏎
> number??{
    (n:5){Found n? which is five.}
    (n:7){Found n? which is seven.}
    (x:_){Found x? which is something else.}
  } ⏎
```

> NOTE: The names do not impact on matching which is done on pure shape and order. The names are a way of mapping the shape elements to values just for use in the template attached to that pattern. A name introduced by a pattern is only visible inside that pattern's template — it is a local binding for the duration of that one match, not a name in any enclosing scope.

## Functions

You have already seen functions because in Punk a function is just a pattern connected to a template so this is a function from above.

```punk
> (n:5){Found n? which is five.}
```

It's not that useful outside of matching in a condition so here is a more useful function. Here is a independent and named function that takes one parameter, name, and returns a personalised welcome message.

```punk
> welcome:(name:_){Hello name?}
```

> NOTE: The pattern `(...)` and the template `{...}` must be **attached** — no whitespace between the closing `)` and the opening `{`. The moment you write `(name:_) {Hello name?}` with a space in there it is no longer one thing; it is a pattern followed by an unrelated template, not a function. Whitespace *inside* the pattern or *inside* the template is free — you can use it to align code — but the bridge between them is sacred.

To use the function we apply it using ! which is the notation in punk for executing something as code.

```punk
> welcome!{Tim}
{Hello Tim}
```

> Q: What is the differnce between querying a template using ? and executing a template using ! ?
> A: a query will not execute anything only resolve queries defined by nested ? usage. Execution using ! will first evaluate just as ? does and then also cascades down to execute any functions nested within that template. 

### Functions used within functions

Any Template can have nested functions just like they have nested queries and because functons include a template then functions can use other functions. There are a lot of built in functions in punk such as doing arithmatic manipulating all sorts of things.

An example function that calculates curcumference using the * multiply built in function which multiplies any two numbers. In this case we multiply PI x radius then multiply that answer by 2.

```punk
> circumference:(radius:_){
    *!{
      *!{
        3.141
        radius?
      }
      2
    }
  }
```

### Function Return values

For functions that work like data templates then getting the whole resulting temnplate back is useful but for templates that contain a numebr of functions then it's often just the last item that is useful. Here is an example that also uses the less than < built in fucntion.

```punk
> sizer:(radius:_){

    circumference:*!{
      *!{
        3.141
        radius?
      }
      2
    }

    <!{circumference? 30}??{
      (TRUE){Small Circle}
      (FALSE){Large Circle}
    }

  }  
```

We can execute this fultion as follows with the shown result..

```punk
> sizer!7 # which is the same as saying sizer!{7} #
{circumference:43.974 {Large Circle}}
```

This is because the template is calculating a circumference and storing it in a name. Then evaluating if the value consitictes a large circle or not. The ideal result from this function is to just show the final result and not expose our inner workings. We can use the range notation as part of our function definition to specify which part of the template should be included in the response. Here is the function again with a simple ~ on the end. i.e. just the last item please.

```punk
> sizer:(radius:_){

    # caclulate the circumference #
    circumference:*!{
      *!{
        3.141
        radius?
      }
      2
    }

    # check if circumference is less than 30 #
    <!{circumference? 30}??{
      (TRUE){Small Circle}
      (FALSE){Large Circle}
    }

  }~  
```

> NOTE: Comments in Punk use a # at the beginning and again at then end of the comment. 

### When things actually run

Templates are inert until something asks for their contents. A template just sitting in source — or held in a name — does no work. Evaluation is triggered, directly or indirectly, by `?` or `!`:

- `?` resolves queries inside a template — including any nested queries reached through the result.
- `!` does everything `?` does, and additionally invokes any functions reached.

The `~` constraint on a function (`{…}~`) is part of the *shape* of the result, not a trigger — slicing only happens once the function is actually called.

### Recursion

Once a name is bound, it's bound — including for the body of the function being defined. A function can refer to itself by name, so straightforward recursion works without any special form:

```punk
> factorial:(n:_){
    <=!{n? 1}??{
      (TRUE){1}
      (FALSE){*!{n? factorial!{-!{n? 1}}}}
    }
  }~
> factorial!5
{120}
```

### Closures

A function carries the scope it was defined in. Names that were visible at the point of definition stay visible to its body, no matter where the function is later called from. This is what makes module functions, pipeline composition, and partial application all behave the way they read on the page — the captured names travel with the function as part of its value.

```punk
> make-adder:(n:_){
    (x:_){+!{x? n?}}
  }~
> add10:make-adder!10
> add10!5
{15}
```

`add10` is the inner function, still carrying `n:10` from the outer call.

## Pipelines

Punk supports a pipeline operator `->` for chaining values through functions. The rule is simple: `->` must be written with **no whitespace around it**, joining its two sides into a single token (much like `.` inside a path). The meaning depends on whether the chain is executed.

### Executing a pipeline

When the chain ends with `!`, it runs: the thing on the left flows through each function in order, with the output of each stage becoming the input of the next.

```punk
> hello->log! ⏎ # log receives {hello} #
> Hello->upper->log! ⏎ # upper makes {HELLO}, then log receives it #
```

Each stage on the right of an `->` is expected to be a function. The input becomes that function's argument, so each stage must be able to accept one thing.

### Composing a pipeline

Without `!`, a chain is a **value** — a new function formed from the composition of the stages. Nothing runs yet.

```punk
> upperLogger:upper->log ⏎ # binds a function: upper then log #
> upperLogger!hello ⏎ # now it runs: {hello} → {HELLO} → log prints HELLO #
```

This is the same distinction that `?` and `!` already make: writing a pipeline without `!` leaves it as a thing that can be named, passed around, or executed later. Adding `!` is what causes it to run.

### Pipelines as ordinary things

Because a composed pipeline is just another function, it can sit anywhere a function does — including as a stage of another pipeline:

```punk
> shout:upper->trim # composed function #
> {Hello World}->shout->log! ⏎ # prints HELLO WORLD #
```

> NOTE: A pipeline stage receives exactly one thing. A function that takes multiple arguments needs to be wrapped or partially applied before it can sit on the right of an `->`. The unary case is the natural fit.

## Partial Functions

A function can be **partially applied** by writing `'` in place of `!`. Where `!` runs the function, `'` pre-fills its leftmost parameters with the arguments you give and returns a new function that expects the rest.

```punk
> add:(a:_ b:_){+!{a? b?}} ⏎
> add5:add'5 ⏎ # pre-fills a as 5, leaves b open #
> add5!3 ⏎
{8}
```

Arguments are consumed **left to right** against the function's pattern. Anything not filled remains as a parameter of the new function. Filling every parameter with `'` produces a zero-argument function — calling it with `!` then runs the body.

```punk
> add37:add'{3 7} ⏎ # both parameters filled #
> add37! ⏎ # nothing left to provide #
{10}
```

### Preparing a function for a pipeline

This is the natural way to make a multi-parameter function fit into a pipeline, where each stage receives exactly one thing (see *Pipelines* above). Pre-fill every parameter except the one that should receive the piped value.

```punk
> times:(a:_ b:_){*!{a? b?}} ⏎
> double:times'2 ⏎ # first param locked to 2, second one open #
> 5->double->log! ⏎ # pipes 5 in as the remaining param, then logs #
{10}
```

The same applies to built-in binary functions like `+!`, `-!`, `<!` and friends — they're just functions, so `'` works on them too.

```punk
> under10:>'10 ⏎ # >'10 pre-fills the first param of >! as 10 #
> 7->under10->log! ⏎ # asks: is 10 > 7? — logs TRUE #
{TRUE}
```

> NOTE: `'` looks like half of the `!` character so this is why it was chosen as the partial function notation. Because `'` mirrors `!` exactly — same call form, same left-to-right pattern fill — there is nothing new to learn about how arguments line up. The only difference is whether the function runs (`!`) or returns a new function with fewer parameters (`'`).

## Boxes

Everything else in Punk is immutable. A **box** is the one and only exception — a mutable cell that lives outside the normal naming system. Boxes are not named in the usual sense; the square brackets *are* the box. Writing `[name]` doesn't look up a binding the way `name` does — it refers to the box itself, wherever it happens to be reached.

```punk
> 0->[currentAge]! ⏎ # writing into [currentAge] is enough to bring it into existence #
```

A box is not the same as its contents — it's a container. The only way to read what's inside, and the only way to put something new inside, is through a pipeline that has `[name]` on one side.

### Reading from a box

Put `[name]` on the **left** of `->`. The pipeline starts with the value currently inside the box.

```punk
> [currentAge]->log! ⏎ # reads the value out of the box, pipes it to log #
0
```

### Writing to a box

Put `[name]` on the **right** of `->`. Whatever flows into it replaces what was inside.

```punk
> 42->[currentAge]! ⏎ # the box now contains 42 #
> [currentAge]->log! ⏎
42
> 43->[currentAge]! ⏎ # replaces 42 with 43 #
> [currentAge]->log! ⏎
43
```

The `!` at the end of the pipeline is what causes the read or the write to actually happen — same rule as any other pipeline. Without the `!` you'd just have a deferred chain.

### Read, transform, write

Because `[name]` can appear on either side of `->`, the same box can show up twice in one chain: read from on the left, written to on the right. This is how counters and other simple state updates are expressed.

```punk
> 0->[counter]! ⏎
> [counter]->+'1->[counter]! ⏎ # reads 0, adds 1, writes 1 back #
> [counter]->log! ⏎
1
> [counter]->+'1->[counter]! ⏎ # reads 1, adds 1, writes 2 back #
> [counter]->log! ⏎
2
```

Here `+'1` is a partially-applied `+!` with its first parameter already locked to `1`, so it accepts the piped value as its second argument. The pipeline reads the box, runs the increment, then writes the result back into the same box.

> NOTE: Boxes sit outside Punk's normal namespace. They aren't bound with `:` and they don't shadow or interact with ordinary names. The brackets are the box — and the only door in or out is the pipeline form: `[name]->` to read, `->[name]!` to write.

## Polymorphism a la carte

Punk doesn't bake in a single polymorphism mechanism — no classes, no `defmulti`, no interfaces. Patterns, `??`, queries and boxes already cover the use cases between them, so you compose the flavour you want from what's already in the language. The sections below show the same kinds of dispatch you'd reach for in other functional languages, expressed in Punk.

### By arity — dispatch on how many things were passed

`??` matches against any shape, so a function can fan out on the shape of its own argument list. This is how you write the equivalent of an arity-overloaded `defn`.

```punk
> greet:(args:___){
    args??{
      (n:_    ){Hello n?   }
      (n:_ t:_){Hello t? n?}
    }
  }~
> greet!Tim
{Hello Tim}
> greet!{Tim Dr.}
{Hello Dr. Tim}
```

### By shape — dispatch on structure

Because pattern slots are structural, the same `??` block dispatches on tag-style shapes just as easily. This is the spot in your code where another language would reach for `cond`, `instanceof`, or a `defmulti` dispatched on a discriminator.

```punk
> area:(shape:_){
    shape??{
      (circle r:_   ){*!{*!{3.141 r?} r?} }
      (rect w:_ h:_ ){*!{w? h?}           }
      (tri b:_ h:_  ){/!{*!{b? h?} 2}     }
    }
  }~
> area!{circle r:5}
78.525
> area!{rect w:4 h:3}
12
```

The "tag" (`circle`, `rect`, `tri`) is just the bareword in the first slot — there's no special tag machinery, only pattern matching.

### By value — dispatch on a specific value

Slots can be literal values, so dispatch by exact value falls out of the same mechanism. This is how routing works in the server example.

```punk
> route:(req:_){
    req??{
      (method:GET  path:/      ___){index!req?    }
      (method:GET  path:/about ___){about!req?    }
      (method:POST path:/login ___){login!req?    }
      (___                        ){notFound!req? }
    }
  }~
```

### By regex — dispatch on textual shape

Regex slots dispatch on the *kind* of text, which covers the cases another language might handle with type predicates on strings.

```punk
> classify:(s:_){
    s??{
      (n:"^\d+$"         ){integer}
      (h:"^#[0-9a-f]{6}$"){color  }
      (_                 ){other  }
    }
  }~
```

### Open dispatch — extending a function after the fact

Everything above is *closed*: the branches of a `??` are fixed once you write them. Clojure's `defmulti`/`defmethod` is *open* — any file can attach a new method to an existing multimethod. Punk gets the same property by putting the handler table in a box.

```punk
> {}->[greeters]!

> register-greeter:(lang:_ msg:_){
    {[greeters]? lang:msg?}->[greeters]!
  }~

> register-greeter!{en Hello}
> register-greeter!{fr Bonjour}

> greet:(lang:_ name:_){
    [greeters]?.lang? name?
  }~

> greet!{en Tim}
{Hello Tim}
> greet!{fr Tim}
{Bonjour Tim}
```

The box `[greeters]` is the open registry; `register-greeter` is the "define a new method" call; `greet` is the dispatcher. Any other file in the program can call `register-greeter` to plug in another language without touching `greet` — that's the openness `defmulti` gives you in Clojure, with no extra language construct.

### Method-style dispatch — objects as namespaces

Because a name-path query (`http.serve!…`, `db.read!…`) is just navigation into a template, swapping the *object* swaps the implementation. The same call site works against any template that carries the right names — the Punk version of structural typing or duck-typed protocols.

```punk
> printer:{
    print:(msg:_){msg?->log!}~
  }

> silent-printer:{
    print:(msg:_){}~
  }

> log-it:(p:_ m:_){ p?.print!m? }~

> log-it!{printer hello}
hello
> log-it!{silent-printer hello}
```

### Comparison with Clojure

| Clojure mechanism | Punk equivalent |
| --- | --- |
| `if` | a single-pattern `?` |
| `cond` / `case` | `??` dispatch on value |
| Predicate `cond` clauses | any pattern is itself a predicate — use `??` |
| Arity-overloaded `defn` | `??` over `args:___` |
| `defmulti` + `defmethod` (closed set) | `??` with literal-value or shape patterns |
| `defmulti` + `defmethod` (open) | a box holding a handler template, plus a `register` function and a dispatcher |
| `defprotocol` + `extend-type` | objects-as-namespaces: a template carrying named functions, called via name-path query |
| `instance?` checks | shape patterns and regex slots |
| `defrecord` / map with key checks | named slots in a pattern: `(name:_ age:_)` |

The trade-off is honest: Punk doesn't give you Clojure's *named* multimethods with global registry tooling out of the box. What it gives you is the same expressive power assembled from four primitives — patterns, `??`, name-path queries, and boxes — none of which exist solely for polymorphism.

## Built-in Functions

Punk ships with a set of built-in functions. They all follow the same form: `name!{arguments}`. Because everything is a template, a single un-braced argument is shorthand for a one-item template — `not!TRUE` and `not!{TRUE}` are the same call.

Anything that's already expressible through queries is **not** a built-in. There is no `slice`, `index`, `head`, `tail`, `first`, `last`, `take`, `drop`, `concat`, `prep`, `append`, or `len` — those are all covered by path-and-range queries (`.1?`, `.~?`, `.2~5?`, `.3~?`, `.#?`) and by template composition (`{a? b?}` splices, because queries return contents).

### Arithmetic

| Call | Result |
| --- | --- |
| `+!{a b ...}` | sum of all items (variadic) |
| `*!{a b ...}` | product of all items (variadic) |
| `-!{a b}` | `a` minus `b` |
| `/!{a b}` | `a` divided by `b` |
| `^!{a b}` | `a` raised to the power `b` |
| `%!{a b}` | remainder of `a` divided by `b` |
| `min!{a b ...}` | smallest item (variadic) |
| `max!{a b ...}` | largest item (variadic) |
| `abs!n` | absolute value of `n` |
| `neg!n` | `n` with its sign flipped |
| `floor!n` | round `n` down to the nearest integer |
| `ceil!n` | round `n` up to the nearest integer |
| `round!n` | round `n` to the nearest integer |
| `sqrt!n` | square root of `n` |

```punk
> +!{1 2 3 4} ⏎
{10}
> *!{2 3 4} ⏎
{24}
> -!{10 3} ⏎
{7}
> min!{4 2 9 5} ⏎
{2}
> round!3.7 ⏎
{4}
```

### Comparison

All comparison built-ins return `TRUE` or `FALSE`.

| Call | Result |
| --- | --- |
| `=!{a b}` | `TRUE` if `a` equals `b` (exact equality — `a` and `b` must serialise identically) |
| `<>!{a b}` | `TRUE` if `a` does not equal `b` |
| `<!{a b}` | `TRUE` if `a` is less than `b` |
| `>!{a b}` | `TRUE` if `a` is greater than `b` |
| `<=!{a b}` | `TRUE` if `a` is less than or equal to `b` |
| `>=!{a b}` | `TRUE` if `a` is greater than or equal to `b` |

```punk
> =!{5 5} ⏎
{TRUE}
> <!{3 10} ⏎
{TRUE}
> <>!{cat dog} ⏎
{TRUE}
```

### Boolean Logic

| Call | Result |
| --- | --- |
| `and!{a b ...}` | `TRUE` if every item is `TRUE` (variadic) |
| `or!{a b ...}` | `TRUE` if any item is `TRUE` (variadic) |
| `not!a` | inverts a single boolean |
| `xor!{a b}` | `TRUE` if exactly one of `a` or `b` is `TRUE` |

```punk
> and!{TRUE TRUE FALSE} ⏎
{FALSE}
> or!{FALSE TRUE FALSE} ⏎
{TRUE}
> not!FALSE ⏎
{TRUE}
```

### Collections

The collection built-ins operate on a template as a sequence of things. They never slice or index — that's the query system's job — they only do work that can't be expressed by navigating into structure.

> NOTE: Higher-order builtins take the **function first** and the **collection last**. That way the collection is the most-varying argument, so `'`-partial application produces a useful unary function:
> - `double:map'doubleFn` is a list transformer — `double!{1 2 3}` → `{2 4 6}`
> - `sum:reduce'(+. 0)` is a list summer — `sum!{1 2 3}` → `{6}`

> NOTE: Callback signature for collection HOFs is `(value index key)`:
> - `value` — the item itself, unwrapped if it's a NamedThing
> - `index` — its 1-based position in the source
> - `key`   — the binding name if the item was a NamedThing, otherwise `NULL`
>
> Most callbacks only need `value`, so writing the pattern as `(v:_)` is fine — the unused tail (`index`, `key`) is dropped by the pattern.

| Call | Result |
| --- | --- |
| `map!{fn t}` | new template with `fn` applied to each item of `t` |
| `filter!{fn t}` | new template containing only items where `fn` returns `TRUE` |
| `reduce!{fn seed t}` | folds `t` left-to-right starting from `seed` |
| `find!{fn t}` | first item of `t` for which `fn` returns `TRUE`, or `NULL` |
| `each!{fn t}` | calls `fn` for every item of `t`, returns nothing (for side effects) |
| `count!{fn t}` | number of items in `t` for which `fn` returns `TRUE` |
| `sort!t` | items of `t` in ascending order |
| `sort!{fn t}` | items of `t` ordered by the comparator `fn` |
| `rev!t` | items of `t` in reverse order |
| `unique!t` | items of `t` with duplicates removed (first occurrence kept) |
| `contains!{item t}` | `TRUE` if `item` appears in `t` |

```punk
> map!{(n:_){*!{n? 10}} {1 2 3}} ⏎
{10 20 30}
> filter!{(n:_){>!{n? 2}} {1 2 3 4 5}} ⏎
{3 4 5}
> reduce!{(a:_ b:_){+!{a? b?}} 0 {1 2 3 4}} ⏎
{10}
> sort!{3 1 4 1 5 9 2 6} ⏎
{1 1 2 3 4 5 6 9}
> contains!{b {a b c}} ⏎
{TRUE}
```

> NOTE: Because a query splices its contents into the surrounding template, collection plumbing you'd expect to find as functions in other languages — prepend, append, concat, slice — is already covered by template composition. For example `{x? xs?}` prepends `x` to `xs`, and `xs.2~?` is the tail. Only operations that *compute* (transform, search, summarise) live here.

### Text

Text in Punk is a single thing whose internal structure is its characters. These built-ins return new templates.

| Call | Result |
| --- | --- |
| `split!{sep t}` | splits text `t` into a template of pieces using `sep` as the separator |
| `join!{sep t}` | joins the items of `t` into one text using `sep` between them |
| `upper!t` | `t` with every letter uppercased |
| `lower!t` | `t` with every letter lowercased |
| `trim!t` | `t` with leading and trailing whitespace removed |
| `replace!{old new t}` | `t` with each occurrence of `old` replaced by `new` |
| `chars!t` | the characters of `t` as a template of one-character things |

```punk
> split!{- foo-bar-baz} ⏎
{foo bar baz}
> join!{- {red green blue}} ⏎
{red-green-blue}
> upper!Hello ⏎
{HELLO}
> trim!input? ⏎ # input came from a file/stdin/socket #
{Hi}
> replace!{- _ foo-bar-baz} ⏎
{foo_bar_baz}
```

> NOTE: Args are ordered "**how** then **what**" — the modifier first, the data last. So `dash-split:split!'-` partials to a unary `(text) → pieces` function. This rule applies across all builtins that take a behaviour argument (fn, predicate, separator, seed, comparator) alongside the data they act on.

> NOTE: A single thing can't contain a space — items inside a template are space-delimited, and that's all space means in Punk source. If you want "text with a space in it", you write a list: `{Hello World}` is two things, and when a list is displayed (or printed via `log!`) the items come out space-separated naturally. Text values that *do* contain spaces only come from outside the source — file reads, network input, regex matches — and `split!` / `trim!` / `replace!` work fine on those.

### Type Checks

Each returns `TRUE` or `FALSE`.

| Call | Result |
| --- | --- |
| `isnum!t` | `TRUE` if `t` is a number |
| `istext!t` | `TRUE` if `t` is text |
| `islist!t` | `TRUE` if `t` is a template with more than one item, or zero items |
| `isfn!t` | `TRUE` if `t` is a function (a pattern with an attached template) |
| `isempty!t` | `TRUE` if `t` has no items |

### Conversion

| Call | Result |
| --- | --- |
| `num!t` | parse `t` as a number; fails if `t` is not numeric text |
| `text!t` | render `t` as text |

### Input and Output

I/O functions are effectful — they're the reason to use `!` instead of `?`.

| Call | Result |
| --- | --- |
| `print!t` | write the contents of `t` to standard output, followed by a newline |
| `read!path` | read the file at `path`, returning a template of its lines |
| `write!{path t}` | overwrite the file at `path` with the contents of `t` |
| `append!{path t}` | append the contents of `t` to the file at `path` |
| `exists!path` | `TRUE` if a file exists at `path` |

```punk
> print!{Hello world} ⏎
Hello world
```

### Testing

| Call | Result |
| --- | --- |
| `assert!{expected actual}` | passes silently if `actual` equals `expected`; raises a runtime error otherwise |
| `assert!cond` | passes silently if `cond` is truthy; raises a runtime error otherwise |

`assert!` is the one built-in that exists purely for tests. The two-argument form is the common case — expected first (so it partials into a reusable matcher: `is-three:assert!'3`), actual last:

```punk
> assert!{3 +!{1 2}} ⏎      # passes #
> assert!{HELLO upper!hello} ⏎   # passes #
> assert!{4 +!{1 2}} ⏎      # runtime error: expected 4, got 3 #
```

A test file is just an ordinary `.punk` file full of `assert!` calls; running it executes each assertion in order, and the first failure stops the file. There is no special test framework — a function under test is exercised by calling it from a template, and the `assert!` lines describe its expected behaviour.

```punk
# tests/circle.punk #
{
  assert!{6.282 circumference!1}
  assert!{0 circumference!0}
  assert!{{Large Circle} sizer!7}
}
```

Because the file is just a template, it can be queried for the count of asserts, imported by another test runner, or executed directly.

### Modules

| Call | Result |
| --- | --- |
| `import!path` | load a Punk module by dotted path, return its template (see *Modules*) |
| `importJS!name` | load a JavaScript module by host-style name, return it as a namespace |

## Modules

Punk programs are organised into files, each of which is itself a template. A `.punk` file becomes a value the moment it's imported, and the consumer chooses the namespace name it lives under.

### Writing a module

By convention, a module file wraps everything it wants to expose in a single un-named template — a code block — and lets the consumer bind that block to a name. Anything defined inside the block is part of the module's public surface; anything outside it is private to the file.

```punk
# http.punk #
{
  serve:(port:_ handler:_){ ... }
  serveStatic:(root:_){ ... }
  parsePost:(body:_){ ... }
}
```

The block has no name of its own. The convention is that the *filename* (`http.punk`) hints at the namespace the consumer will probably pick (`http`), but that's just convention — every consumer is free to import the same module under any name.

### Importing a Punk module

Use the built-in `import!`. It takes a module path and returns the template the file defines; bind it to a name to give it a namespace.

```punk
> http:import!punk.http ⏎
> html:import!punk.html ⏎
> keystore:import!punk.keystore ⏎
```

Once imported, the module's bindings are reachable through the regular name-path query — the dots between `http` and `serve` are just navigation into the module's template.

```punk
> http.serve!{8080 dispatch} ⏎
> html.render!doc ⏎
> keystore.open!todo ⏎
```

The argument to `import!` is just text that names the module:

| Form | Means |
| --- | --- |
| `punk.http` | a stdlib module shipped with the Punk runtime |
| `./helpers` | a path relative to the importing file (no `.punk` extension) |
| `mypkg.utils` | a module from a third-party package on the module path |

The `.` inside the import argument is not a path-query — it's just part of the text being passed in. The query rule only applies inside a path token that itself ends in `?` or `!`.

### JavaScript interop

Punk can pull in modules from the JavaScript host. `importJS!` takes a Node-style module name and returns the imported module bound as a namespace, exactly like a Punk import.

```punk
> node:importJS!http ⏎ # Node's built-in http module #
> fs:importJS!fs ⏎ # filesystem #
> got:importJS!got ⏎ # an npm package #
```

The returned namespace exposes whatever the JavaScript module exports. Function and method calls follow the same `name.method!{args}` form as Punk namespaces.

```punk
> server:node.createServer!handler ⏎
> server.listen!8080 ⏎
> fs.readFileSync!{config.json utf8}->log! ⏎
```

> NOTE: Values crossing the JavaScript boundary are converted as you'd expect — numbers become numbers, text becomes strings, templates of things become arrays, named slots become object properties. A function passed into a JavaScript callback parameter stays a callable Punk function on the other side, so handler-style APIs work naturally.

### Putting it together

A small server file shows the pieces working together. The consumer file imports a few Punk modules, defines its own handlers, then hands them to the imported `http.serve`.

```punk
# server.punk #
http:import!punk.http
html:import!punk.html
keystore:import!punk.keystore

keystore.open!todo->[db]!

dispatch:(req:_){
  req??{
    (method:GET  path:/      ___){index!req?     }
    (method:POST path:/todo  ___){createTodo!req? }
    (___                        ){notFound!req?  }
  }
}

http.serve!{8080 dispatch}
{listening on port 8080}->log!
```

Nothing about the call site is special: `http.serve` is the same kind of name-path query you'd use on any data structure, and `!{8080 dispatch}` is the same kind of execute-with-arguments form used everywhere else.

## Appendix

### Special Characters

These characters carry meaning in Punk source. Anywhere they're meant as ordinary text inside a template, escape them with a leading `\` (see the next table).

| Character | Role | Where it's special |
| --- | --- | --- |
| `{` `}` | Template delimiters | Anywhere outside an escape |
| `(` `)` | Pattern delimiters | Anywhere outside an escape |
| `[` `]` | Box delimiters — `[name]` refers to a box; the brackets *are* the box. Boxes come into existence on first write: `value->[name]!` | Anywhere outside an escape |
| `:` | Names a thing — `name:value` | Anywhere outside an escape |
| `?` | Query — resolves nested queries in a template | Suffix of a path token; `?(pattern){...}` is the single-condition form; `??{(p1){...}(p2){...}}` is the multi-condition form |
| `!` | Execute — runs a function or evaluates a template directly or ny name. | Also invokes any embeded calls like `+!` |
| `'` | Partial application — like `!` but returns a new function with the leftmost parameters pre-filled | Suffix of a function name where `!` would otherwise execute it |
| `.` | Path segment separator | Only inside a path token that ends in `?` or `!` |
| `~` | Range / last-item | Inside paths (`.~`, `.N~M`), as a value constructor (`5~15`), and as a function-return constraint (`{…}~`) |
| `#` | Comment delimiter / length-of segment | A `#` surrounded by whitespace opens/closes a block comment; inside a path token, `#` is the length segment |
| `->` | Pipeline operator | Joins two sides with no whitespace; left flows into right when the chain ends in `!`, otherwise the chain is a composed function |
| `"` `"` | Regex literal delimiters | Used as a pattern slot to match text against a regular expression |
| `_` | Single wildcard inside patterns | Accessor the full function parameters from inside a function body template.
| `___` | Variadic wildcard (zero or more) | Only inside patterns |
| `\` | Escape character — makes the next character literal | Anywhere a special character needs to appear as text |
| space | Item separator inside a template or inside a pattern | Between things inside `{ ... }` and `( ... )` |

### Escapes inside text

A `\` followed by another character produces literal text. The first three rows are the everyday escapes; the rest cover special whitespace that would otherwise be invisible or act as a separator.

| Escape | Produces |
| --- | --- |
| `\?` | a literal `?` |
| `\!` | a literal `!` |
| `\'` | a literal `'` |
| `\:` | a literal `:` |
| `\{` `\}` | a literal `{` or `}` |
| `\(` `\)` | a literal `(` or `)` |
| `\[` `\]` | a literal `[` or `]` |
| `\~` | a literal `~` |
| `\#` | a literal `#` |
| `\-` | a literal `-` (only needed if it would otherwise pair with `>` to form `->`) |
| `\"` | a literal `"` |
| `\\` | a literal `\` |
| `\n` | a newline character (only way to get one inside a single thing) |
| `\t` | a tab character (only way to get one inside a single thing) |
| `\X` | a literal `X` for any other character (escape is a no-op on non-special characters — including `\s`, which is just an `s`) |

### What does **not** need escaping

| Character | Why it's safe as text |
| --- | --- |
| `.` | Only special inside a path token that ends in `?` or `!`. In any other context (including standalone text and decimal-looking numbers like `3.141`) it's just a character. |
| `_` `___` | Only special inside a pattern; in templates they're ordinary text. |
| Letters, digits, `+ - * / ^ % = < >`, `@`, etc. | Ordinary thing characters. Symbol-named built-ins like `+!`, `<!`, `<>!` are simply names whose text happens to be punctuation, followed by `!` to execute. |

### Reserved templates

A small number of bare names always resolve to fixed values.

| Name | Meaning |
| --- | --- |
| `TRUE` | the boolean true |
| `FALSE` | the boolean false |
| `NULL` | the absence of a value — used for regex groups that didn't capture |

