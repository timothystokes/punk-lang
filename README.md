```
╭───╮ ╭╮  ╭─╮ ╭╮ ╭╮ ╭╮╭─╮      
│╭╮ │ ││  │ │ │╰╮││ │╰╯╭╯         
│╰╯ │ ││  │╭╯ │ ╰╯│ │╭╮│         
│╭──╯ ││  ││ ╭╯╭╮ │ │││╰╮            
│╰╮   │╰──╯│ │ │╰╮│ │││ ╰╮      
╰─╯   ╰────╯ ╰─╯ ╰╯ ╰╯╰──╯ 
```

# Punk

Punk is a functional immutable interpreted loosely-typed programming language. It has unique concepts and syntax. It's named after it's creator who is a self-confessed punk! This implementation uses JavaScript as it's runtime.

## Getting Started

To run Punk in interactive mode.

```bash
npm start
```

To run a punk program.

```bash
npm start myApp.punk
```

## The Punk Language

Here are the key concepts used in the Punk language.

### Things

Punk is not a strongly typed language but it does have specific constructs including Word & Number kinds of things, Templates, Patterns, and of cause Functions.

### Numbers

Most software languages understand numbers implicitly and Punk is no exception. 

```punk
> 42 ⏎
{42} 
```

### Words

Where other languages usually don't accept words as data outside of strings, Punk is fine with it. 

```punk
> Paul ⏎
{Paul}
```

In fact Punk doesn't differentiate between 42 and Paul until you do things with them later. They are just data values until then. All things are only delimited by space.

```punk
> 42 Paul ⏎
{42 Paul}
```

42 and Paul are two things so the { } wrapper is indicating to you that they have been interpreted as two things next to each other using { } notation. Punk calls things with parenthesis Templates.

### Templates

To explicitly define a Template of two things then you can code the template { } directly.

```punk
> {Hello world} ⏎
{Hello world}
```

### Named Things

In Punk most things can be given a name so they can queried them in a later part of your code. Names are simply attached directly to the start of a thing being named using colon : . Spaces are not allowed because then Punk would see two things not one named thing. Event the template that holds things is a thing that can be named.

In this example we have one named template which itself contains two things.

```punk
> message:{Hello world} ⏎
{message:{Hello world}}
```

> NOTE: Punk treats names as immutable. Once you have attached a name to a thing then it sticks. You can't remove the name or attached that name to another thing (within the same namespace).

### Querying Named Things

You can retrieve a thing from it's name using a ? query.

```punk
> message? ⏎
{Hello world}
```

> NOTE: Without the : or ? on the end, the word 'message' is just a normal word and Punk would treat it as data. It's the : that lets Punk know that you want to use that word as the name of a thing or ? to use that word to look up the value of a named thing.

### Nested Templates

Templates can contain other templates including other named templates and named things.

```punk
> person:{name:{Paul Jones} age:42} ⏎
{person:{name:{Paul Jones} age:42}}
```

### Deeper Queries

The whole idea of Template and Data in Punk is that there is structure that can be determined and use in your programs. Because it's clear to Punk that message holds a list of two things then we can chain that context in our query. The dot . notation followed by a nested name or by index is used to specify the path segments to get to the deeper layers of the structure. Assuming the person definition above...

This query resolved the value attached to the nested 'age' name within the person template.

```punk
> person.age? ⏎
{42}
```

> NOTE: Any query that doesn't align with the names or structures of the thing being queries will result in a NULL response.

This query resolved the name within the person template then from there the 2nd item in the inner template.

```punk
> person.name.2? ⏎
{Jones} 
```

> NOTE: Many software languages index things in lists starting from 0 to represent the 1st item. In Punk 1 means 1st. 2 means 2nd etc..

### Template Placeholders

Using what we have learned we could name a value and then create a template that includes a query to that value.

```punk
> name:Paul ⏎
name:{Paul}
> message:{Hello name?} ⏎
message:{Hello name?}
```

> NOTE: `name:Paul` is the short form for `name:{Paul}` — a bare Word or Number on the right of `:` is treated as if you'd written it inside `{}`. Things that already have their own delimiters (templates, texts, patterns, function calls) bind as-is.

### Evaluating a template

To evaluate the template so that the name query is replaced with the name value then we use the ! syntax at the end of the reference. This means that we don't just want to get the information but we want to evalue the template and any queries or code in it.

```punk
> message! ⏎
{Hello {Paul}}
```

The inner `{Paul}` is there because `name:Paul` is short for `name:{Paul}` (above). The plain `?` query is structure-preserving — it returns the value as it was bound. To inline the items of the queried value into the surrounding template, a final . before the ? lets Punk know that you want the to expand the whole value into the placeholder not just embed it `.?`:

```punk
> message2:{Hello name.?} ⏎
> message2! ⏎
{Hello Paul}
```

> NOTE: We have learned of three Punk language features now. : is used to name things, ? is used to query the templates that always contain our things and ! is used to evaluate a template. 

### Patterns

Paterns are a way of defining the shape of a template so that they can be compared which provides a way to build conditions in out program. Patterns are defined by ( ) syntax where underscores _ are used to denote an item placement and * to denote any number of items.

```punk
> (_) # A pattern that describes a template shape that contains a single thing # ⏎
> (_ _) # A pattern that describes a template shape that contains two things # ⏎
> (*) # A pattern that describes a template that has any number of things including empty # ⏎
> (5 _ _) # A pattern that describes a template that contains three things where the first thing is a 5 # ⏎
```

### Conditional Queries

Patterns become useful when attached to a query where they can be used as to check for a match againt the results of a query.

```punk
> name:{Paul Jones} ⏎
> name?(_ _) # does have two things # ⏎
{TRUE}
> name?(_) # does not have just one thing # ⏎
{FALSE}
```

### Conditional Queries with attached Template

Sometimes we want to actually do something not just get a TRUE or FALSE. Conditional queries allow a final template to be attached on the end. If the match is TRUE then we can evaluate the template. Rather than jsut _ we can use labeled placeholders [] in the pattern and then those labels are available as named things in the template.

```punk
> name:{Paul Jones} ⏎
> name?([first] [last]){Hi first.? thanks for entering your full name including your last name last.?}! ⏎
{Hi Paul thanks for entering your full name including your last name Jones}
``` 

### Functions

In Punk a function is simply a pattern connected to a template (...){...} and in fact you have already seen one just above.

```punk
> ([first] [last]){Hi first.? thanks for entering your full name including your last name last.?} ⏎
```

### Named Functions

Like other things functions can also be named so they can be used later. Here is a simple function that greets people with any number of parts to their name as * matches all. * is also a special name available inside function templates that gets all parametere passed to the function.

```punk
> welcome:(*){Hello *.?} ⏎
```

### Evaluating a Function

We can provide the value for the function to operate on using a query as we have seen but we can also provide the parameters in a template after the eval ! symbol.

```punk
> welcome!{Sally-Ann Green} ⏎
{Hello Sally-Ann Green}
```

### Pipes

There is one more way to provide a value to a function. Using pipe notation -> suggestive of an arrow.

```punk
> {Sally}->welcome! ⏎
{Hello Sally}
```

> NOTE: Pipes can be chained together using an initial query or reference followed by any number of function names and then terminated with our evaluate symbol ! . 

### Unstructured Templates

We have seen how structured templates are core to how Punk references code and data almost interchangeably. Somethings we need to work with or produce unstructured data. Punk uses " " to define Unstructured Templates rather than { } which are used to define Structured Templates as we have already seen. Unstructured templates can be used in the same way as structured ones.

```punk
> name:"Sally Green" ⏎
"Sally Green"
```

> NOTE: You may be thinking that these are just strings but that's not quite right because they are templates also.

### Placeholders in Unstructured Templates

Just like structured templates unstructured ones can also nested structured template placeholders that can be used to insert information.

```punk
> welcome:"Hello {name?}" ⏎
```

To evaluate an unstructured template we use the same directive of ! which finds any embedded structural templates and evaluates them as data or code based on the directives they contain. In this case the {name?} template is found, resolved to "Sally Green" which is then inserted into the position of the placeholder.

```punk
> welcome! ⏎
{"Hello Sally Green"}
```

Querying into an unstructured template is possible but the only structure is a sequence of characters.

```punk
> name:"Sally Green" ⏎
> name.7? # Resolves to the 7th character of the name # ⏎
{"G"}
```

### Where next?

See: punk-by-example.md file for more examples and language features.

### Full Example...

Here is a more complete example so you can get a feel for what Punk code looks like. We have three developer teams and their 2025 token usage and pizza consumption per month:

```punk

# Per month: tokens = tokens used, pizzas = pizzas eaten. #
teams:{
  Phoenix:{
    Jan:{tokens:850 pizzas:6}  Feb:{tokens:870 pizzas:6}  Mar:{tokens:830 pizzas:7}  Apr:{tokens:860 pizzas:6}
    May:{tokens:880 pizzas:7}  Jun:{tokens:840 pizzas:6}  Jul:{tokens:870 pizzas:7}  Aug:{tokens:860 pizzas:6}
    Sep:{tokens:890 pizzas:8}  Oct:{tokens:855 pizzas:7}  Nov:{tokens:870 pizzas:7}  Dec:{tokens:880 pizzas:8}
  }
  Legends:{
    Jan:{tokens:400 pizzas:4}   Feb:{tokens:520 pizzas:5}   Mar:{tokens:680 pizzas:6}   Apr:{tokens:790 pizzas:7}
    May:{tokens:950 pizzas:8}   Jun:{tokens:1120 pizzas:9}  Jul:{tokens:1340 pizzas:10} Aug:{tokens:1520 pizzas:12}
    Sep:{tokens:1780 pizzas:13} Oct:{tokens:2050 pizzas:15} Nov:{tokens:2310 pizzas:16} Dec:{tokens:2640 pizzas:18}
  }
}

```

Now let's summarise each team's year — peak month, average, and totals — for both tokens and pizzas, then render a markdown report with rows per team and a totals line:

```punk

# --- helpers --- #

# sort items by a given attribute, highest first — so .1 is the peak #
sortByAttribute:(attribute:_ items:_){
  items?->sort'(a:_ b:_){
    >!{a.{attribute?}? b.{attribute?}?}
  }!
}

# sum the values of a given attribute across the data items #
sumByAttribute:(attribute:_ items:_){
  +!{items?->map'(item:_){item.{attribute?}?}!.?}
}

# --- per-team processing --- #

processTeam:(team:_){
  name:team.:?
  tokensPeakMonth:sortByAttribute!{tokens team?}.1.?
  tokensTotal:sumByAttribute!{tokens team?}
  tokensAverageMonth:/!{tokensTotal? team.#?}
  pizzasPeakMonth:sortByAttribute!{pizzas team?}.1.?
  pizzasTotal:sumByAttribute!{pizzas team?}
  pizzasAverageMonth:/!{pizzasTotal? team.#?}
  tokensPerPizza:/!{tokensTotal? pizzasTotal?}
}

# --- full data processing --- #

processTeams:(teams:_){
  teamSummary:teams?->map'(team:_){processTeam!team.?}!
  totalTokens:sumByAttribute!{tokensTotal teamSummary?}
  totalPizzas:sumByAttribute!{pizzasTotal teamSummary?}
  tokensPerPizza:/!{totalTokens? totalPizzas?}
}

# --- printing --- #

# one markdown table row for a team's processed summary #
renderRow:(t:_)"  | {t.name?} | {t.tokensTotal?} | {t.pizzasTotal?} | {round!{t.tokensPerPizza? 2}} | {t.tokensPeakMonth.:?} ({t.tokensPeakMonth.tokens?}) | {t.pizzasPeakMonth.:?} ({t.pizzasPeakMonth.pizzas?}) |"

# render a full report (rows + totals line) as a markdown table #
renderReport:(r:_)print!"
  | Team | Tokens | Pizzas | Tokens per Pizza | Peak Month for Tokens | Peak Month for Pizzas |
  |------|-------:|-------:|-----------------:|-----------------------|-----------------------|
  {join!{"\n" r.teamSummary?->map'(t:_){renderRow!t?}!}}
  | **Totals**  | {r.totalTokens?} | {r.totalPizzas?} | {round!{r.tokensPerPizza? 2}} | — | — |
"

renderReport!{processTeams!teams?}

```

Which produces:

| Team | Tokens | Pizzas | Tokens per Pizza | Peak Month for Tokens | Peak Month for Pizzas |
|------|-------:|-------:|-----------------:|-----------------------|-----------------------|
| Phoenix | 10355 | 81 | 127.84 | Sep (890) | Sep (8) |
| Legends | 16100 | 123 | 130.89 | Dec (2640) | Dec (18) |
| **Totals**  | 26455 | 204 | 129.68 | — | — |




