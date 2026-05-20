# Punk

Punk is an interpreted functional programming language that runs on any JavaScript implementation. It focuses on the idea that any language is made up of words, numbers and structure, so its primary utility is to manipulate words, numbers and structure.

Throughout this document, code blocks marked `punk` follow REPL conventions:

| Mark | Meaning |
| --- | --- |
| `>` | a line of input typed into the Punk REPL |
| `⏎` | the end of an input line (where you'd press Enter) |
| `...` | represents your own content that can be inserted |
| <placeholder> | A placeholder for some value, name or data element |
| anything else | the REPL's response on the next line |
| `# ... #` | a comment — comments are bracketed by `#` on both ends |

## Types of things

Punk doesn't have data *types* in the usual sense — instead it has a small set of *things* that everything in a Punk program is made from:

| Thing | Form | Example |
| --- | --- | --- |
| Structured Template | `{ ... }` — items separated by whitespace | `{2024 2025 2026}` |
| Unstructured Template | `" ... "` — a run of characters, possibly with embedded `{...}` placeholders | `"Hello Robert"` |
| Word | any run of characters that contains no space | `Hello`, `red-green-blue`, `&` |
| Number | a Word that follows the numeric formatting rules | `42`, `0.5`, `-5`, `3.141` |
| Pattern | `( ... )` — a shape used for matching, binding and dispatching | `(name:_ age:_)` |
| Function | a Pattern attached directly to a Template | `(name:_){Hello name?}` or `(name:_)"Hello {name?}"` |
| Box | `[ name ]` — the one mutable cell in the language | `[counter]` |
| Regex literal | `/ ... /` — a regular expression usable as a pattern slot | `/^\d+$/` |

> NOTE: A "Word" in Punk is not an English word — it's just any group of characters delimited by whitespace (or by the surrounding `{`/`}`/`(`/`)`). `red-green-blue`, `3.141`, `&`, and `Hello` are all Words. Numbers are Words that happen to look numeric, so they can be used with arithmetic builtins.

## Named Things

Everything in Punk can be given a name. Names are needed to refer to things later, or in other contexts. To name something in Punk we use the form `name:thing`.

```punk
> message:"Hello world" ⏎ 
message:"Hello world"
```

We name things using `<name>:` attached directly to the thing we want to name (with no space between):

- Named Structured Template — `<name>:{...}`
- Named Unstructured Template — `<name>:"..."`
- Named Pattern — `<name>:(...)`
- Named Function — `<name>:(...){...}` or `<name>:(...)"..."`

### Name rules

Punk names follow JavaScript identifier rules with one addition (`-`):

- Must **not** start with a digit.
- Allowed characters: letters (case-sensitive), digits, `_`, `-`, `$`.
- `$` is allowed mainly for JavaScript interop — most punk code won't use it.

Examples: `name`, `first-name`, `snake_name`, `x1`, `$jsThing`, `Foo` and `foo` are different names. `1foo` is **not** a valid name.

Names are **immutable** once bound in a scope: rebinding `x:1` in a scope where `x` is already bound is a syntax error. A dangling `name:` (with nothing to the right of the `:`, or with whitespace before the value) is also a syntax error — Punk does not implicitly bind names to `NULL`. Querying a name that was never bound returns `NULL`.

#### Reserved words

A few words have special meaning **in specific positions**:

- `_` — inside a `()` pattern, an unnamed single-item wildcard slot. Anywhere else (template, name binding, function body), `_` is just an ordinary word — it can be a name, appear as literal text, or be used however you'd use any other word.
- `*` — inside a `()` pattern, an unnamed variadic wildcard slot (zero or more items). Inside a function body, `*?` queries **the whole argument template** that the function was called with. Anywhere else `*` is just an ordinary word (the same way `+`, `-`, `=` are just words outside an Exec).
- `TRUE`, `FALSE`, `NULL` — the three reserved values. Always reserved, in every position.

`_`, `*`, `-`, and `X` need no escaping — their special meaning is purely positional:

- `_` and `*` are only wildcards inside patterns.
- `-` is only special when glued to form `-!` (subtract) or `->` (pipeline arrow). A bare `-`, or one inside a word like `hello-world` or `X-ray`, is plain text.
- `X` is only special when glued to form `X!` (multiply). A bare `X`, or one inside a word like `Xenon`, is plain text. If you ever need a literal `X!`, escape the bang: `X\!`.

`TRUE`/`FALSE`/`NULL` are the only words that must be escaped (`\T\R\U\E`, etc.) to be used as literal text.

### Bare-value bindings auto-wrap

Bare Words and Numbers have no inherent delimiter, so when they appear on the value side of a binding they are wrapped in a singleton structured template:

```punk
> age:42 ⏎
age:{42}

> name:Tim ⏎
name:{Tim}
```

So `age:42` is shorthand for `age:{42}`, and `name:Tim` is shorthand for `name:{Tim}`. This means a queried single value is always reached through a 1-item template:

```punk
> age:42  age?    ⏎    {42}
> age:42  age.1?  ⏎    {42}
> age:42  age.2?  ⏎    NULL
```

Everything that already has its own delimiters (templates, patterns, functions, texts, boxes, reserved values like `TRUE`/`FALSE`/`NULL`) binds bare — no extra wrapping.

## Templates

All structured data, unstructured data, code and text is contained within templates. Punk can use code structures to define data, and data structures to define code.

### Structured Templates

Structured templates are good for manipulating data and code. For example, if I query the length of a structured template I get the number of items in the structure.

Example of a Structured Template:

```punk
> years:{2024 2025 2026} ⏎
years:{2024 2025 2026} 
```

This is a named template containing three things. Querying the length of this template named `years` returns 3, because there are three items.

### Unstructured Templates

An unstructured template is a run of characters between double quotes. It's good at manipulating unstructured data such as messages, file contents and network input.

```punk
> message:"Hello world" ⏎  
message:"Hello world"
```

If you queried the length of this unstructured template named `message` you would get 11 — the number of characters in it.

Which type of template you use depends on what you need your program to do.

### Numbers

Numbers are just Words that follow a few formatting rules. The rules keep them unambiguous against ordinary text so the arithmetic and comparison builtins can operate on them:

| Form | Notes |
| --- | --- |
| `42` | a whole number |
| `0.5` | a decimal — a leading `0` is required (`.5` would look like a path segment) |
| `-5` | a negative number — the `-` is part of the number |
| `3.141` | the `.` inside a number is just text |
| `5~15` | a **range** of whole numbers from 5 through 15 inclusive — produces the sequence `{5 6 7 8 9 10 11 12 13 14 15}` when it appears as a value in a template. Both bounds must be present; `~15` and `5~` on their own (no surrounding path) have no implicit endpoint and are evaluation errors. |

You **cannot** query a Number or Word literal directly — `3.141.1?` and `hello.1?` are syntax errors because the dot in a literal is ambiguous with a path segment. Wrap the literal in a template or give it a name first; once a value is bound to a name, queries treat it as if implicitly wrapped:

```punk
> {3.141}.3? ⏎
{.}
> n:3.141   n.3? ⏎
{.}
> n:hello   n.1? ⏎
{h}
> hello.1? ⏎
SYNTAX ERROR
```

### Reserved values

Three bare names always resolve to fixed values. They behave like ordinary Words for the most part — they can be queried, passed around, named, matched in patterns — but they are reserved so the language and its builtins have a shared vocabulary for "true", "false", and "no value". Unlike other Words, they do **not** auto-wrap when they are the final value at the REPL: they print bare (`TRUE`, `FALSE`, `NULL`).

| Name | Meaning |
| --- | --- |
| `TRUE` | the boolean true |
| `FALSE` | the boolean false |
| `NULL` | the absence of a value |

`TRUE` and `FALSE` are what every comparison and boolean builtin returns (`=!`, `<!`, `and!`, `not!`, …) and what `??` dispatches on when you branch with `(TRUE){...} (FALSE){...}`.

`NULL` appears wherever Punk has nothing meaningful to return:

- a query whose path doesn't resolve — `people.99.fullname?` → `NULL`
- the name segment of an unnamed thing — `{a b c}.1.:?` → `NULL`
- the pattern segment of a non-function — `42.()?` → `NULL`
- a regex capture group that didn't match — see [Unmatched groups](#unmatched-groups)
- a function that produces no value via its return range

`NULL` is itself a value: you can name it (`absent:NULL`), pass it as an argument, compare against it (`=!{x? NULL}`), and match it in a pattern (`(NULL){...}`). It is **not** truthy — see [Truthiness](#truthiness).

```punk
> people.99? ⏎
NULL
> =!{NULL people.99?} ⏎
TRUE
> people.99??{ (NULL){"nobody home"} (_){"found someone"} } ⏎
"nobody home"
```

### Nested Templates

Templates can contain other templates. In fact structured templates can contain unstructured templates and unstructured templates can even contain structured templates.

```punk
> people:{
    {fullname:"John Smith"   age:42  hair:black  birthday:"Sunday {11}-{March}-{1984}" }
    {fullname:"Sally Green"  age:51  hair:brown  birthday:"Monday {19}-{May}-{1975}"   }
    {fullname:"Ben Jones"    age:9   hair:blue   birthday:"Monday {22}-{Dec}-{2017"    }
  } ⏎  
```

> NOTE: Spaces are important. In structured templates any amount of whitespace between things is how they are delimited. Whitespace between the opening `{` and the first inner thing, and between the last thing and the closing `}`, is just separator. Even newlines next to spaces and tabs all count as space between things. Inside unstructured templates, spaces are treated as literal characters and they are not collapsed.

### Querying Templates

The way to query a thing by its name is to use the `?` query notation.

```punk
> message? ⏎ 
"Hello world"
```

> Q: What does a single word do on its own if there is no `:` to assign it as a name and no `?` to query a value?
> A: A bare word evaluated by Punk is just a Word. When a Word appears at the top level, the REPL wraps it in a single-item structured template for display (`Sydney` → `{Sydney}`).

> Q: Can I leave a space between the `:` and the thing I'm naming?
> A: No — you are literally attaching the name to a thing, so they must be connected. With a space in between it will look, feel, and be interpreted as two separate things.
>
> A name on its own is naming nothing, and if resolved would return `NULL`. Since Punk is a functional language where names are immutable, that isn't very practical.

Punk also lets you query information contained deep within a template.

```punk
> people.1.fullname? ⏎  
"John Smith"
```

What happens is when Punk reads a `?` it looks at the full path and resolves the reference starting from the named thing.

In this case
- `people.` refers to the full people template
- `1.` then indicates that we want the 1st item in the list, like an index in arrays
- `fullname?` refers to the thing named `fullname` AND terminates with the `?`, which is the instruction to Punk to perform the query and return the value.

> NOTE: Without a `?` on the end, a query is just text and doesn't do anything. Indexes in many languages start at 0 to get the first item, but in Punk indexes start at 1. It's a punk after all.

```punk
> people.1.fullname # Just a value #⏎  
{people.1.fullname}
```

> Words and Numbers can't appear on their own at the REPL — they are bare characters with no inherent delimiter, so the REPL wraps them in a structured template (`{Sydney}`, `{42}`) just to show *what kind of thing* was printed. The wrapping is display only; operations always work on the content, not the wrapping. Every other kind of thing already carries its own delimiters (`{}`, `""`, `()`, `(){}`) so it prints as-is. The reserved values `TRUE`/`FALSE`/`NULL` are their own symbols and also print bare. Queries that have an invalid path return `NULL`.

Using the same example...

```punk
> people:{
    {fullname:"John Smith"   age:42  hair:black  birthday:"Sunday {11}-{March}-{1984}" }
    {fullname:"Sally Green"  age:51  hair:brown  birthday:"Monday {19}-{May}-{1975}"   }
    {fullname:"Ben Jones"    age:9   hair:blue   birthday:"Monday {22}-{Dec}-{2017"    }
  } ⏎  
```

Here are some other ways of querying:

| Example | Result | Symbols | Description |
| --- | --- | --- | --- |
| `people.#?` | `3` | `#` | Length: number of items in the referenced segment, or the number of characters in an unstructured template. |
| `people.1.2?` | `42` | `n` | Index: the item at position `n` in the referenced segment. |
| `people.2.3~?` | `{brown "Monday {19}-{May}-{1975}"}` | `n~` | Range: from the item at position `n` to the end. |
| `people.3.fullname.~5?` | `"Ben J"` | `~n` | Range: from the beginning up to the item at position `n`. Works on characters of an unstructured template too. |
| `people.1.2~3?` | `{42 black}` | `n~n` | Range: items from position `n` through position `m` inclusive. |
| `people.1.fullname.:?` | `{fullname}` | `:` | Name: the name of the referenced thing as a Word, or `NULL` if it has no name. |
| `add.()?` | `(a:_ b:_)` | `()` | Pattern: the pattern of a function, or `NULL` if the referenced thing is not a function. |

> NOTE: Querying a built-in function name with `?` gives you the function itself (e.g. `+?` is the `+!` function as a value). This is how you alias a built-in under a new name: `add:+?` — bare `+` on its own would be the literal Word `+`, but `+?` looks it up and returns the function.

> NOTE: Querying templates is safe. Punk does not evaluate anything when querying. It simply resolves the information as it is currently contained within the structure of a template.

> NOTE: The terminal segments `.#`, `.:` and `.()` only make sense at the **end** of a path — they each return a value that isn't further structured by the same path. So `xs.#.1?` (length, then first item of it) is not a valid path; if you need to use a length or name in further work, get it out with one query and use it in the next.

### Templates can contain queries

Here is an example of a template that contains a query that can be used to inject information from one template into another.

```punk
> name:{Bob} ⏎ 
> "Hello {name?}"
"Hello {name?}" 
```

If I write a template without an `!` on the end, I just get the template itself back — the embedded `{name?}` is not resolved. To run a template, evaluate it with `!`:

```punk
> "Hello {name?}"! 
"Hello Bob"
```

When an unstructured template is evaluated, Punk looks at each placeholder defined by a structured template segment — in this case `{name?}` — and executes it. Punk isn't interested in the `{` `}` themselves; they're just placeholders. It looks at the contents, here evaluating the `name?` query to produce `Bob`, and substitutes the result into the position the placeholder occupied. This is why these are called templates: they define a shape with slots that can be filled in.

> NOTE: When the placeholder evaluates to a structured template, its items are joined with a single space before being substituted in — the same implicit coercion the text built-ins use. So `t:{a b c}  "{t?}"` renders as `"a b c"`.

> Q: What if I want to use a `?` in my template as a normal question mark?
> A: Just escape it using `\?` — for example `{What is your name\?}`. The `name` will not be interpreted as a query when you evaluate this template.

> Q: What about the dots in a template? How do I use a normal full-stop/period?
> A: A `.` is only interpreted as a path separator inside a token that ends in `?` or `!`. In normal text it's just a character. Exclamation points `!` and colons `:` do need to be escaped if used as plain text. See the Appendix for the full list.

### Templates can contain code

In the same way templates can contain queries, they can also contain functions. A function is a value (introduced fully in the *Functions* section) and like any value it can sit inside a template — as a top-level item, as a placeholder inside an unstructured template, or named with `:`.

```punk
> shout:(s:_){upper!s?}
> "I said {shout!hi}"!
"I said HI"
```

The function `shout` is just sitting in source; it does no work until the surrounding template is evaluated with `!`. At that point Punk walks through the template, resolves the `{shout!hi}` placeholder by calling the function, and substitutes the result.

The same applies to structured templates: a function placed inside `{ ... }` is inert until the containing template is run.

### When things actually run

Templates are inert until something asks Punk to run them. A template just sitting in source — or held in a name — does no work. The two triggers are `?` and `!`, and they do different things:

- `?` is a **query** and it resolves only the single path it is attached to. It does not cascade. If the resolved value contains other queries or functions, they are left alone.
- `!` is **execute** and it evaluates the whole template it is attached to: every embedded query is resolved, every function reached inside it is run, and the substitutions cascade through any nested templates that result.

```punk
> greeting:"Hello {name?}"
> name:Bob

> greeting?    ⏎ # resolves the name 'greeting' only; the {name?} inside is not touched #
"Hello {name?}"

> greeting!    ⏎ # evaluates the template; resolves {name?} and substitutes #
"Hello Bob"
```

The `~` constraint on a function (`{…}~`, covered later) is part of the *shape* of the result, not a trigger — slicing only happens once the function is actually called with `!`.

### How values splice into their surroundings

When a cascade resolves a value and slots it back into the surrounding form, the splicing rule depends on what that surrounding form is:

- **Into a template** the resolved value's items are *spread* into the parent. This is composition. A template that resolves to `{Tim Jones}` adds both `Tim` and `Jones` to the parent — not a nested `{Tim Jones}`.
- **Into a string** the resolved value is *stringified*: its items are joined into the surrounding text as plain characters (multi-item templates are joined by a single space). The structure flattens away because a string is just characters.

```punk
> name:{Tim Jones}

> {name is name?}!     ⏎ # composition — items spread into the parent template #
{name is Tim Jones}

> "name is {name?}"!   ⏎ # stringification — items become text inside the string #
"name is Tim Jones"
```

The same rule applies when the bound value is a single word — `name:Bob` auto-wraps to `{Bob}`, so `{hi name?}!` is `{hi Bob}` and `"Hello {name?}"!` is `"Hello Bob"`. The auto-wrap and the splice rule together make the single-value case look the way you'd expect, but the underlying rule is the same: templates spread, strings stringify.

## Punk Data Notation (PDN)

Everything you've seen so far is also a data format. A Punk program *is* its own data — there is no separate syntax for "writing down a value" vs "writing code that produces a value". The same characters that bind names, group things, and attach names to values in source are how data is serialised, sent over the wire, written to disk, or pasted into a config file.

This is what is meant by **PDN — Punk Data Notation**: the readable surface of every Punk value, identical to the surface you'd write in source.

```punk
# a record-shaped value #
{name:"Jane Green" age:42 location:Sydney}

# a list of records #
{
  {name:"John Smith" age:39 location:"New York"}
  {name:"Jane Green" age:42 location:Sydney}
}

# a single number, a single thing, an empty list #
42
Sydney
{}
```

Everything in PDN is made from four ingredients:

1. **Things** — bare characters, words and numbers (`&`, `Sydney`, `42`, `3.141`, `-5`).
2. **Structured Templates** — space-separated things between `{` and `}` (`{a b c}`).
3. **Unstructured Templates** — runs of characters between double quotes (`"abcdefg"`).
4. **Named things** — a name **attached** to a value with `:` and **no space** between them (`age:42`, `name:"John Smith"`).

> NOTE: The space after `:` matters. `age:42` is one named thing — a key-value pair you can query as `.age?`. `age: 42` is two separate things (`age:` bound to nothing, then `42`). They look almost identical and they mean very different things. The same rule is what makes `{left:red right:blue}` a queryable record and `{left: red right: blue}` just four pieces of text. If you are constructing a specific string rather than structured data or code, use an unstructured template with `"..."` such as `"Your age: 42"`.

PDN has no separate syntax for dictionaries, arrays, or tuples — they all collapse into templates and named things. A "dictionary" is a template of named things. An "array" is a template of un-named things, which retains order and can be indexed, mapped, reduced, etc. A "tuple" is the same template under another name. The display form `{...}` you see when the REPL prints a value is literal PDN — copy it, paste it back into source, and it's the same value again.

The flip side: any data file written in PDN is a valid Punk source file. Loading config, reading a record from disk, or accepting a request payload are all just `import!` or a `read!` followed by ordinary path queries — there's no parse step, because the data is already in the language's own grammar.

### Function literals as data

A pattern attached to a template is a function (covered fully under *Functions*), but the literal form `(...){...}` or `(...)"..."` is also just PDN — it's a value you can write down, read back, and treat as data. Nothing runs unless something later calls it with `!`.

That's what makes Punk a natural fit for element-tree data such as HTML or XML, where every node is "a tag with some attributes and some children". The PDN shape is `tag:(attrs)body`:

```punk
page:{
  div:(class:"panel"){
    h1:(id:"x27" style:"font-size: 14px;")"Introduction"
    p:()"Welcome to Punk"
  }
}
```

- The **binding name** (`div`, `h1`, `p`) is the element tag.
- The **pattern** `(class:panel)`, `(id:x27)`, `()` carries the attributes — named slots for attributes that have values, an empty pattern for elements with none.
- The **body** is the content: a structured template `{...}` of nested children, or an unstructured template `"..."` of text. Children can themselves be element-shaped values, so trees nest naturally.

Because element trees are PDN, the same path-query machinery used on records and lists works on documents — `page.div.class?` reads the attribute, `page.div.2?` gets the second child — and a rendering function is just a function that walks the tree.

## Patterns

A pattern is a way of defining a data shape that can be compared with things. When there's a match, decisions can be made in your Punk program. Patterns are defined using `( ... )` notation.

```punk
> (John) ⏎ # matches a template with the literal value {John} #
> (45) ⏎ # matches a template with the literal value {45} #
> (_) ⏎ # matches any template with a single thing inside it #
> (*) ⏎ # matches any template with zero or more things inside it #
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

The variadic wildcard `*` consumes any number of things — zero or more — and can be combined with fixed slots to match "this then anything", "anything then that", or "this surrounded by anything".

```punk
> (_ *) ⏎ # one thing followed by any number of others #
> (* _) ⏎ # any number of things followed by exactly one #
> (start * end) ⏎ # begins with {start}, ends with {end}, anything between #
> (* TRUE *) ⏎ # contains {TRUE} somewhere — anywhere #
```

> NOTE: Only one variadic `*` slot is allowed in a pattern, because two would make the split between them ambiguous.

Patterns nest. A slot in a pattern can itself be a pattern, which constrains the shape of the *thing* at that position.

```punk
> ((_ _) _) ⏎ # a pair followed by a single thing #
> ((John _) _) ⏎ # first item is a pair starting with {John}, then anything #
> point:(x:_ y:_) ⏎ # a named pair-shape #
> (point point) ⏎ # two points — uses point's shape as the slot constraint #
```

### Naming pattern segments

You can give the slots in a pattern names. The name is just a local binding — it doesn't affect what gets matched, but it lets the template attached to that pattern refer to the matched value.

```punk
> (head:_ tail:*) ⏎ # first thing bound to head; rest bound to tail #
> (first:_ middle:* last:_) ⏎ # three names spanning a template of two or more #
> (name:John age:_) ⏎ # first must be {John}, second is bound to age #
```

A slot can be both named and shape-constrained — the name goes on the left of the `:`, the shape on the right is what's actually matched.

> NOTE: Names do not impact matching — matching is done purely on shape and order. A name introduced by a pattern is only visible inside that pattern's template — it is a local binding for the duration of that one match, not a name in any enclosing scope.

### Regex slots

A pattern slot can also be a regex literal written between forward slashes `/.../`. It matches a single thing whose text satisfies the regex.

```punk
> (/^\d+$/) ⏎ # one thing made entirely of digits #
> (/hello/) ⏎ # one thing whose text contains hello #
> (_ /^\d+$/) ⏎ # two things, the second made entirely of digits #
```

Like any slot, a regex slot can be named — the name binds to the matched thing for use in the attached template.

```punk
> tagger:(n:/^\d+$/){
    Number:n?
  } ⏎
> tagger!42 ⏎
{Number:42}
```

#### Capture groups

A regex with capture groups binds the named slot to a small structure rather than a bare thing: the full match at position 1, then each capture group in the order it appears.

```punk
> halve:(p:/^(\w+)-(\w+)$/){
    left:p.2? right:p.3?
  } ⏎
> halve!{red-blue} ⏎
{left:red right:blue}
```

`p.1?` is the whole match (`red-blue`), `p.2?` is the first group, `p.3?` is the second.

#### Named capture groups

Named groups `(?<name>...)` are bound the usual positional way **and** are also reachable by their name on the slot.

```punk
> parseDate:(s:/^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/){
    s.y? s.m? s.d?
  } ⏎
> parseDate!2024-01-15 ⏎
{2024 01 15}
```

#### Unmatched groups

A group that didn't participate in the match (for example, an alternative branch that wasn't taken, or an optional `(...)?`) is bound as `NULL` rather than missing or causing a failure.

```punk
> classify:(p:/^(?<sign>[+-])?(?<n>\d+)$/){
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
> - `value??{ ... }` — multi-branch. First match wins. With no matching branch it's a **runtime error**. To make a `??` total, give it a final catch-all branch — `(_){...}` for a single thing, `(*){...}` for any shape at all.

### Truthiness

Anywhere Punk needs a yes/no answer — most commonly inside `??` branches that check a condition — the rule is simple:

| Value | Counts as |
| --- | --- |
| `FALSE` | false |
| `NULL` | false |
| anything else (including `0`, `{}`, `()`) | true |

So a `value??{(TRUE){...}(FALSE){...}}` block covers the explicit boolean cases, and a `(_)` catch-all picks up everything else as "truthy".

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

> SHORTCUT: When the body is a single expression, the outer `{ }` are optional. So `mylogger:(m:_)log!{m?}` is the same as `mylogger:(m:_){log!{m?}}`. This matches the existing `(p)"..."` form where the body is a single unstructured template.

> SHORTCUT: When a call or partial application passes exactly one thing and that thing is a single name or a single integer, you can drop the `{ }` and write the argument directly against the `!`/`'`. So `sizer!7` is the same as `sizer!{7}`, `times'2` is the same as `times'{2}`, and `+'1` is the same as `+'{1}`. Only a bare name or a bare integer is accepted on the right of mid-call `!`/`'`: anything else (decimals like `1.2`, paths like `foo.bar`, templates) must use the full `f!{...}` form.

To use the function we apply it using ! which is the notation in punk for executing something as code.

```punk
> welcome!{Tim}
{Hello Tim}
```

> Q: What is the differnce between querying a template using ? and executing a template using ! ?
> A: a query will not execute anything only resolve queries defined by nested ? usage. Execution using ! will first evaluate just as ? does and then also cascades down to execute any functions nested within that template. 

### Functions used within functions

Any template can have nested functions just like it can have nested queries, and because functions include a template, functions can use other functions. There are many built-in functions in Punk for doing arithmetic, manipulating text, and working with collections.

An example function that calculates circumference using the `X` multiply built-in (which multiplies its numeric arguments). Here we multiply PI by radius, then multiply that answer by 2.

```punk
> circumference:(radius:_){
    X!{
      X!{
        3.141
        radius?
      }
      2
    }
  }
```

### Function Return values

A function's body is a template. What comes back when you call it follows the same rule as anything else in Punk — you get the content, not extra wrapping:

- If the body has **one top-level item**, the function returns *that item directly*. A function whose body is a single function literal returns the function itself; a body that is a single arithmetic call returns the number; a body that is a single dispatch (`x??{...}`) returns whatever branch matched.
- If the body has **multiple top-level items**, the function returns the whole template containing them in order.
- A return-range constraint (`}~`) on the function lets you slice the body before it goes back to the caller — useful when intermediate steps live in the body but you only want the final answer to escape.

Inside a function body, `*?` queries the whole template of arguments that the function was called with — useful when you want to forward, inspect, or fall back to the raw input regardless of what your pattern bound.

```punk
> echo:(_ *){*?}  echo!{a b c} ⏎
{a b c}
```


For functions that work like data templates, getting the whole resulting template back is useful. But for templates that contain a number of intermediate steps, it's often just the last item that matters. Here is an example that also uses the `<` less-than built-in function.

```punk
> sizer:(radius:_){

    circumference:X!{
      X!{
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

We can execute this function as follows with the result shown.

```punk
> sizer!7 # which is the same as saying sizer!{7} #
{circumference:43.974 {Large Circle}}
```

This is because the template is calculating a circumference and storing it in a name, then evaluating whether the value constitutes a large circle or not. The ideal result of this function is to just show the final answer and not expose our inner workings. We can use the range notation as part of our function definition to specify which part of the template should be included in the response. Here is the function again with a simple `~` on the end — i.e. just the last item, please.

```punk
> sizer:(radius:_){

    # caclulate the circumference #
    circumference:X!{
      X!{
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

> NOTE: This is not the same as a query where the value is returns and we are then querying the last item. This is actually part of the function definition where the function provider chooses what is returned. The caller gets what the provider specifies with the final range directive.

The return-range follows the same shape as a range path segment, written directly against the closing `}` of the body (no space):

| Form | Means |
| --- | --- |
| `}~` | only the **last** top-level item of the produced template |
| `}~n` | the **first n** items |
| `}n~` | items from position **n** to the end |
| `}n~m` | items from position **n** through **m** inclusive |

If you want the whole template back, leave the return-range off — that's the default.

### Recursion

Once a name is bound, it's bound — including for the body of the function being defined. A function can refer to itself by name, so straightforward recursion works without any special form:

```punk
> factorial:(n:_){
    <=!{n? 1}??{
      (TRUE){1}
      (FALSE){X!{n? factorial!{-!{n? 1}}}}
    }
  }
> factorial!5
{120}
```

### Closures

A function carries the scope it was defined in. Names that were visible at the point of definition stay visible to its body, no matter where the function is later called from. This is what makes module functions, pipeline composition, and partial application all behave the way they read on the page — the captured names travel with the function as part of its value.

```punk
> make-adder:(n:_){
    (x:_){+!{x? n?}}
  }
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

> NOTE: A composed pipeline is always a **one-argument** function. Calling it with `!arg` feeds `arg` in as the seed of the chain, so `clean!Hello` and `Hello->clean!` mean the same thing.

This is the same distinction that `?` and `!` already make: writing a pipeline without `!` leaves it as a thing that can be named, passed around, or executed later. Adding `!` is what causes it to run.

> PRECEDENCE: A `:` binding always extends over the **whole** pipeline that follows it, not just the first stage. `upperLogger:upper->log` binds `upperLogger` to the composed pipeline `upper->log`, not `(upperLogger:upper)->log`. The same is true when executing: `result:5->double->log!` binds `result` to the value the executed pipeline produces.

> NOTE: A *bare* `!` — one that isn't glued to a name as part of a normal call like `f!` — is only meaningful as the trailing trigger of a `->` chain (as in `0->[counter]!`, where the `!` runs the whole pipeline). Reading or writing a box outside a pipeline (`[counter]!` on its own) is a syntax error; boxes only participate in `->` chains.

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
> times:(a:_ b:_){X!{a? b?}} ⏎
> double:times'2 ⏎ # first param locked to 2, second one open #
> 5->double->log! ⏎ # pipes 5 in as the remaining param, then logs #
{10}
```

The same applies to built-in binary functions like `+!`, `-!`, `<!` and friends — they're just functions, so `'` works on them too.

```punk
> under10:>'10 ⏎ # >'10 pre-fills the first param of >! as 10 #
> 7->under10->log! ⏎ # asks: is 10 > 7? — logs TRUE #
TRUE
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

> NOTE: A box only exists once something has been written into it. Reading from a box that has never been written to is a runtime error.

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

## Polymorphism

Punk doesn't bake in a single polymorphism mechanism — no classes, no multimethods, no interfaces. Patterns, `??`, queries and boxes already cover the use cases between them, so you compose the flavour you want from what's already in the language. The sections below show the same kinds of dispatch you'd reach for in other languages, expressed in Punk.

### By arity — dispatch on how many things were passed

`??` matches against any shape, so a function can fan out on the shape of its own argument list. This is how you write the equivalent of arity overloading.

```punk
> greet:(args:*){
    args??{
      (n:_    ){Hello n?   }
      (n:_ t:_){Hello t? n?}
    }
  }
> greet!Tim
{Hello Tim}
> greet!{Tim Dr.}
{Hello Dr. Tim}
```

### By shape — dispatch on structure

Because pattern slots are structural, the same `??` block dispatches on tag-style shapes just as easily. This is the spot in your code where another language would reach for a `cond`, an `instanceof` check, or a multimethod dispatched on a discriminator.

```punk
> area:(shape:_){
    shape??{
      (circle r:_   ){X!{X!{3.141 r?} r?} }
      (rect w:_ h:_ ){X!{w? h?}           }
      (tri b:_ h:_  ){/!{X!{b? h?} 2}     }
    }
  }
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
      (method:GET  path:/      *){index!req?    }
      (method:GET  path:/about *){about!req?    }
      (method:POST path:/login *){login!req?    }
      (*                        ){notFound!req? }
    }
  }
```

### By regex — dispatch on textual shape

Regex slots dispatch on the *kind* of text, which covers the cases another language might handle with type predicates on strings.

```punk
> classify:(s:_){
    s??{
      (n:/^\d+$/         ){integer}
      (h:/^#[0-9a-f]{6}$/){color  }
      (_                 ){other  }
    }
  }
```

### Open dispatch — extending a function after the fact

So far every choice your program makes has been written down up front. The set of options is fixed at the moment you write the code.

Sometimes that isn't what you want.

Imagine you're writing something that greets people. You start with English and French. Later somebody wants to add Japanese, and later still somebody else wants to add Spanish — and the people adding new languages aren't the same person who wrote the original greeter, and they shouldn't have to find the original greeter and edit it just to add a language.

What you actually want is: one place that knows how to greet, and a way for anyone to walk up and say "here's another language — use this phrase". The greeter doesn't change. The list of known languages can grows at runtime.

This is the shape Punk reaches for with a box. A box lets us append things to a common reference point where normal Punk variables are imutable.

```punk
  # put an inital empty list into the greeters box. #
  {}->[greeters]! 

  # get the current list of greeters, 
    add a new greeter 
    and put that new combined list as the new contents of the box #
  register-greeter:(lang:_ msg:_){
    [greeters]->(g:_){g? {lang:lang? msg:msg?}}->[greeters]! 
  }

  register-greeter!{en Hello}
  register-greeter!{fr Bonjour}

  greet:(lang:_ name:_){
    [greeters]->(g:_)"{find!{(i:_ *)=!{i.lang? lang?} g?}.msg?} {name?}"!
  }
```

To call use the greeters...

```punk
> greet!{en Tim}
{Hello Tim}
> greet!{fr Tim}
{Bonjour Tim}
```

### Method-style dispatch — objects as namespaces

Because a name-path query (`http.serve!…`, `db.read!…`) is just navigation into a template, swapping the *object* swaps the implementation. The same call site works against any template that carries the right names — the Punk version of structural typing or duck-typed protocols.

```punk
> printer:{
    print:(msg:_){msg?->log!}
  }

> silent-printer:{
    print:(msg:_){}
  }

> log-it:(p:_ m:_){ p.print!m? }

> log-it!{printer hello}
hello
> log-it!{silent-printer hello}
```

### Summary

| Pattern | Punk mechanism |
| --- | --- |
| `if` | a single-pattern `?` |
| `cond` / `case` | `??` dispatch on value |
| Predicate `cond` clauses | any pattern is itself a predicate — use `??` |
| Arity overloading | `??` over `args:*` |
| Closed multimethod / dispatch table | `??` with literal-value or shape patterns |
| Open multimethod / extensible dispatch | a box holding a handler template, plus a `register` function and a dispatcher |
| Protocols / interfaces | objects-as-namespaces: a template carrying named functions, called via name-path query |
| `instanceof` / type tag checks | shape patterns and regex slots |
| Records / structs with required fields | named slots in a pattern: `(name:_ age:_)` |

All of these are assembled from four primitives — patterns, `??`, name-path queries, and boxes — none of which exist solely for polymorphism.

## Built-in Functions

Punk ships with a set of built-in functions. They all follow the same form: `name!{arguments}`. Because everything is a template, a single un-braced argument is shorthand for a one-item template — `not!TRUE` and `not!{TRUE}` are the same call.

Anything that's already expressible through queries is **not** a built-in. There is no `slice`, `index`, `head`, `tail`, `first`, `last`, `take`, `drop`, `concat`, `prep`, `append`, or `len` — those are all covered by path-and-range queries (`.1?`, `.~?`, `.2~5?`, `.3~?`, `.#?`) and by template composition (`{a? b?}` splices, because queries return contents).

### Arithmetic

| Call | Result |
| --- | --- |
| `+!{a b ...}` | sum of all items (variadic) |
| `-!{a b}` | `a` minus `b` |
| `X!{a b ...}` | product of all items (variadic) |
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
| `rand!` | random float in `[0, 1]` inclusive (no args) |

```punk
> +!{1 2 3 4} ⏎
{10}
> X!{2 3 4} ⏎
{24}
> -!{10 3} ⏎
{7}
> min!{4 2 9 5} ⏎
{2}
> round!3.7 ⏎
{4}
> rand! ⏎
{0.5372819461923847}
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
TRUE
> <!{3 10} ⏎
TRUE
> <>!{cat dog} ⏎
TRUE
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
FALSE
> or!{FALSE TRUE FALSE} ⏎
TRUE
> not!FALSE ⏎
TRUE
```

### Collections

The collection built-ins operate on a template as a sequence of things. They never slice or index — that's the query system's job — they only do work that can't be expressed by navigating into structure.

> NOTE: Higher-order builtins take the **function first** and the **collection last**. That way the collection is the most-varying argument, so `'`-partial application produces a useful unary function:
> - `double:map'doubleFn` is a list transformer — `double!{1 2 3}` → `{2 4 6}`
> - `sum:reduce'{+! 0}` is a list summer — `sum!{1 2 3}` → `{6}`

> NOTE: Callback signature for collection HOFs is `(value index key)`:
> - `value` — the item itself, unwrapped if it's a NamedThing
> - `index` — its 1-based position in the source
> - `key`   — the binding name if the item was a NamedThing, otherwise `NULL`
>
> The callback is always called with three things, so its pattern must account for all three. When you only care about the value, swallow the rest with a variadic — `(v:_ *)` — or name the slots you want and use `_` placeholders for the rest: `(v:_ _ _)`. A bare `(v:_)` would fail the arity check.
>
> `reduce!` is the exception — its callback is a fold and receives `(acc value)`. Accumulator first so a partial like `step:reduce'fn` is meaningful with the seed and collection still open.

| Call | Result |
| --- | --- |
| `map!{fn t}` | new template with `fn` applied to each item of `t` |
| `filter!{fn t}` | new template containing only items where `fn` returns `TRUE` |
| `reduce!{fn seed t}` | folds `t` left-to-right starting from `seed` |
| `find!{fn t}` | first item of `t` for which `fn` returns `TRUE`, or `NULL` |
| `each!{fn t}` | calls `fn` for every item of `t`, returns nothing (for side effects) |
| `count!{fn t}` | number of items in `t` for which `fn` returns `TRUE` |
| `sort!t` | items of `t` in ascending order |
| `sort!{fn t}` | items of `t` ordered by the comparator `fn(a b)` — returns `TRUE` if `a` should come before `b` |
| `rev!t` | items of `t` in reverse order |
| `unique!t` | items of `t` with duplicates removed (first occurrence kept) |
| `contains!{item t}` | `TRUE` if `item` appears in `t` |

```punk
> map!{(n:_ *){X!{n? 10}} {1 2 3}} ⏎
{10 20 30}
> filter!{(n:_ *){>!{n? 2}} {1 2 3 4 5}} ⏎
{3 4 5}
> reduce!{(a:_ b:_){+!{a? b?}} 0 {1 2 3 4}} ⏎
{10}
> sort!{3 1 4 1 5 9 2 6} ⏎
{1 1 2 3 4 5 6 9}
> contains!{b {a b c}} ⏎
TRUE
```

> NOTE: Because a query splices its contents into the surrounding template, collection plumbing you'd expect to find as functions in other languages — prepend, append, concat, slice — is already covered by template composition. For example `{x? xs?}` prepends `x` to `xs`, and `xs.2~?` is the tail. Only operations that *compute* (transform, search, summarise) live here.

### Text

Text in Punk is an unstructured template — a single thing whose internal structure is its characters. Every text built-in below expects unstructured text as its data argument.

If you pass a **structured** template to a text built-in, Punk implicitly converts it by joining its items with a single space — equivalent to `join!{" " t}`. So `upper!{hello world}` is the same call as `upper!"hello world"`. The conversion only goes this direction; there is no implicit conversion from unstructured to structured.

| Call | Result |
| --- | --- |
| `split!{sep t}` | splits text `t` into a structured template of pieces using `sep` as the separator |
| `join!{sep t}` | joins the items of structured template `t` into one unstructured text with `sep` between them |
| `upper!t` | `t` with every letter uppercased |
| `lower!t` | `t` with every letter lowercased |
| `trim!t` | `t` with leading and trailing whitespace removed |
| `replace!{old new t}` | `t` with each occurrence of `old` replaced by `new` |
| `chars!t` | the characters of `t` as a structured template of one-character things |

```punk
> split!{- foo-bar-baz} ⏎
{foo bar baz}
> join!{- {red green blue}} ⏎
"red-green-blue"
> upper!"hello" ⏎
"HELLO"
> upper!{hello world} ⏎ # structured input is joined with a space first #
"HELLO WORLD"
> trim!input? ⏎ # input came from a file/stdin/socket #
"Hi"
> replace!{- _ "foo-bar-baz"} ⏎
"foo_bar_baz"
```

> NOTE: Args are ordered "**how** then **what**" — the modifier first, the data last. So `dash-split:split!'-` partials to a unary `(text) → pieces` function. This rule applies across all builtins that take a behaviour argument (fn, predicate, separator, seed, comparator) alongside the data they act on.

> NOTE: `split!` is how an unstructured template becomes a structured one. `join!` is the inverse — it takes a structured template of items and produces a single unstructured template with the separator between them. All other text builtins produce unstructured output (their input is unstructured, by implicit conversion if necessary).

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

> NOTE: There's no `text!` builtin — anything can be rendered as unstructured text by interpolating it into a `"..."` template, e.g. `"{thing?}"`.

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
    (method:GET  path:/      *){index!req?     }
    (method:POST path:/todo  *){createTodo!req? }
    (*                        ){notFound!req?  }
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
| `!` | Execute — runs a function or evaluates a template, by name or directly. Also invokes any embedded calls like `+!`. | Suffix of a path token, or of a function name |
| `'` | Partial application — like `!` but returns a new function with the leftmost parameters pre-filled | Suffix of a function name where `!` would otherwise execute it |
| `.` | Path segment separator | Only inside a path token that ends in `?` or `!` |
| `.:?` | Name segment — resolves to the name of the referenced thing, or `NULL` if it has no name | At the end of a path |
| `.()?` | Pattern segment — resolves to the pattern of a function, or `NULL` if the referenced thing is not a function | At the end of a path |
| `~` | Range / last-item | Inside paths (`.~`, `.N~M`), as a value constructor (`5~15`), and as a function-return constraint (`{…}~`) |
| `#` | Comment delimiter / length-of segment | `#` is a paired comment delimiter anywhere outside of escapes — `# ... #`. Comments vanish entirely (zero-width); unclosed `#` is a syntax error. The one exception is `.#?` at the end of a path, where `#` is the length-of segment. |
| `->` | Pipeline operator | Joins two sides with no whitespace; left flows into right when the chain ends in `!`, otherwise the chain is a composed function |
| `/` `/` | Regex literal delimiters | Used as a pattern slot to match text against a regular expression |
| `_` | Single wildcard | Only inside patterns |
| `*` | Variadic wildcard (zero or more) | Only inside patterns |
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
| `\"` | a literal `"` |
| `\\` | a literal `\` |
| `\/` | a literal `/` |
| `\n` | a newline character (only way to get one inside a single thing) |
| `\t` | a tab character (only way to get one inside a single thing) |
| `\c` | for any other character `c`, a literal `c` (escape is a no-op on non-special characters — `\s` is just an `s`, `\-` is just a `-`, `\+` is just a `+`) |

### What does **not** need escaping

| Character | Why it's safe as text |
| --- | --- |
| `.` | Only special inside a path token that ends in `?` or `!`. In any other context (including standalone text and decimal-looking numbers like `3.141`) it's just a character. |
| `_` `*` | Only special inside a pattern; in templates they're ordinary text. |
| Letters, digits, `+ - * / ^ % = < >`, `@`, etc. | Ordinary thing characters. Symbol-named built-ins like `+!`, `<!`, `<>!` are simply names whose text happens to be punctuation, followed by `!` to execute. |

### Whitespace and adjacency

Spaces, tabs and newlines between things in a template or a pattern are item separators — they keep neighbouring things from fusing into one construct. A handful of forms in Punk *require* zero whitespace between their parts; writing them with a space turns them into two unrelated things instead of one:

| Glued form | What the glue means |
| --- | --- |
| `name:value` | The binding only attaches when `:` is directly followed by its value. `name: value` is two separate items (and a dangling `name:` is a syntax error). |
| `(pattern){body}` | The pattern and body fuse into a function. `(p) {b}` is a pattern next to an unrelated template. |
| `add!{1 2}` | The arguments only attach when the `{...}` is directly after `!` or `'`. `add! {1 2}` is a bare call followed by a separate template. |
| `}~`, `}~n`, `}n~m` | A return-range only attaches to a function body when written directly against the closing `}` of the body. With a space in between, the `~` is a standalone range value. |
| `a->b->c` | The pipeline operator itself requires no whitespace around it — `a -> b` is a syntax error (the `->` is not recognised). |
| `xs.fullname?` | The whole path is one token — `xs. fullname?` is two tokens and not a query at all. |

The same rule, restated: where two pieces of source need to *be* a single thing, write them as a single thing.

### How `:` and `.` split words at the token level

Two punctuation rules in particular shape how a run of characters is split into tokens before any structural parsing happens, and it's useful to know them when reading source closely:

- `:` ends the current word as soon as the previous character was a name character (letter, digit, `_`, `-`, `$`). So `foo:bar` becomes the two tokens `foo:` and `bar`, but `xs.:?` stays one token (the `:` follows a `.`, not a name char). This is what makes `foo:a->b` bind `foo` to the pipeline `a->b` instead of `(foo:a)->b`.
- `.` is only a path separator *inside* a token that ends in `?` or `!`. In any other context — running text, decimal numbers — it's just a character.

### Reserved templates

See [Reserved values](#reserved-values) under Templates for full coverage of `TRUE`, `FALSE`, and `NULL`.

