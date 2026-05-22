# Punk

Punk is a functional programming language designed for concise and expressive data processing. It features a unique syntax that emphasizes readability and composability, with a focus on functional programming patterns and data transformation.

## Getting Started

To run Punk in interaactive mode.

```bash
npm start
```

To run a punk program e.g. myApp.punk.

```bash
npm start myApp.punk
```

## The Punk Language

Here are the key concepts used in the Punk language.

### Things

Punk is not a strongly typed language but it does have function that can do math and all sorts of other things. All fucntions work on the premice that if the value feels like the kind of thing that the function can usefully process at runtime then it does. e.g. adding thos things where those things seem like numbers will add them together as number and return a new thing.

### Numbers

Most programing language allow literal numebrs to be part of the code and Punk is no exception. 

```punk
> 42 ⏎
{42} 
```

### Words

Where other languages won't acept literal words as token in the language, Punk is fine with it. 

```punk
> Paul ⏎
{Paul}
```

In fact Punk doesn't differenciate netween 42 and Paul until you do things with them later. They are just data values until then. Data elements are separated by space.

```punk
> 42 Paul ⏎
{42 Paul}
```

42 and Paul are two things so the { } wrapper is describing to you that they have been interpreted as two things. In the above reponses you can see Punk is making it clear they are one thing using the same { } notation. Punk things within parenthasis Templates.

### Templates

To explicitly define a Template of two things then you can code the { } directly.

```punk
> {Hello world} ⏎
{Hello world}
```

### Named Things

In Punk most things can be given a name so they can queried in a leter part of your code. Names are simply attached directly to the start of a thing using colons : to specify the name assignment. Spaces are not allowed because then Punk would see two things not one named thing.

In this example we have one named template which itself contains two things.

```punk
> message:{Hello world} ⏎
{message:{Hello world}}
```

> NOTE: Punk treats names as imutable. Once you have attached a name to one thing then it sticks. You can't remove the name or attached that name to another thing within the same namespace.

### Querying Named Things

You can retrive a thing from it's name using a ? query.

```punk
> message? ⏎
{Hello world}
```

> NOTE: Without the : or ? on the end message is just a normal word and Punk woudl treat it as data. its the : that let's Punk know you want to use it as a name or ? to let Punk know you want resolve it as a name.

### Nested Templates

Templates can contain other templates including other named templates.

```punk
> person:{name:{Paul Jones} age:42} ⏎
{person:{name:{Paul Jones} age:42}}
```

> NOTE: Any query that doesn't align with the names or structures of the thing being queries will result in a NULL response.

### Deeper Queries

The whole idea of Template and Data in Punk is that there is structure that can be determined and use in your programs. Because it's clear to Punk that message holds a list of two things then we can chain that context in our query. The dot . notation followed by a nested name or by index is used to specify the path segments to get to the deeper layers of the structure. Assuming the person definition above...

```punk
> person.age? ⏎
{42}
```

This query resolved the value attached to the nested 'age' name within the person template.

```punk
> person.name.2 ⏎
{Jones} 
```

This query resolved the name within the person template then from there the 2nd item in the inner template.

> NOTE: Manu progrsamming languages index things in lists starting from 0 to represent the 1st item. In Punk 1 means 1st. 2 means 2nd etc..

Here is a list of all the query types available using this example template:

```punk
> person:{name:{Paul Jones} age:49 birthday:{day:12 month:June year:1997}} ⏎
```

```punk
> {Birthday person.birthday?}! # value by name # ⏎
{Birthday {12 June 1997}}

> {Age person.2?}! # item value by index # ⏎
{Age {42}}

> {Second Item Name person.2.:?}! # extract the name of the reference # ⏎
{Second Item Name {42}}

> {Number of Person Attributes person.#?} # count of the things in reference # ⏎
{Number of Person Attributes {3}}

> {All date elements person.birthday.?} # expand out the the full contents # ⏎
{All date elements day:12 month:June year:1997} 
```

### Template Placeholders

Using what we have learned we could name a value and then create a template that includes a query to that value.

```punk
> name:Paul ⏎
{name:{Paul}}
> message:{Hello name?} ⏎
message:{Hello name?}
```

### Evaluating a template

To evaluate the template so that the name query is replaced with the name value then we use the ! syntax at the end of the reference.

```punk
> message! ⏎
{Hello Paul}
```

> NOTE: We have learned of three Punk language features now. : is used to define a name a template, ? is used to query the template the name is attached to, ! is used to evaluate the template the name is attached to. 

### Patterns

Paterns are a way of defining the shape of a template so that they can be compared and so we can build conditions in out program. Patterns are defined by ( ) syntax where underscores _ are used to denote an item placement ans * to denote any number of items.

```punk
> (_) # A pattern that describes a template shape that contains a single thing # ⏎
> (_ _) # A pattern that describes a template shape that contains two things # ⏎
> (*) # A pattern that describes a template that has any numebr of things including empty # ⏎
> (5) # A pattern that describes a template that contains the single value 5 # ⏎
```

### Conditional Queries

Patterns become useful when attached to a query where they can be used as condition againt the value of the query.

```punk
> name:{Paul Jones} ⏎
> name?(_ _) # Name does have two things # ⏎
{TRUE}
> name?(_) # Name does not have just one thing # ⏎
{FALSE}
```

### Conditional Queries with attached Template

Sometimes we want to actually do something not just get a TRUE or FALSE. Conditional queries allow a final template to be attached that can be evaluated but ONLY IF the condition is TRUE. Also new names can be attached to the shapes and then dereferenced by that final template.

```punk
> name:{Paul Jones} ⏎
> name?(firstname:_ lastname:_){Hi firstname? thanks for entering your full name including your last name lastname?}! ⏎
{Hi Paul thanks for entering your full name including your last name Jones}
``` 

### Functions

In Punk a function is simply a pattern connected to a template (...){...} and in fact you have already seen them just above.

```punk
> (firstname:_ lastname:_){Hi firstname? thanks for entering your full name including your last name lastname?} ⏎
```

### Named Functions

Like other things functons can also be named so they can be used later. Here is a simple functon that greets peopl with any numebr of parts to their name as * matches all.

```punk
> welcome:(n:_){Hello n?} ⏎
```

### Evaluating a Function

We can provide the value for the function to operat on after the ! signal to evaluate as follows:

```punk
> welcome!{Sally} ⏎
{Hello Sally}
```

### Pipes

We can also provide values to functiuon by piping it using the -> notation like an arrow.

```punk
> {Sally}->welcome! ⏎
{Hello Sally}
```

> NOTE: Pipes can be made chained together using an initial query or reference followed by any numebr of function names and then terminated with our evaluate symbol !

### Unstructured Templates

We have seen how structured templates are core to how Punk references code and data alomst interchangably. Somethings we need to work with or produce unstructures data. Punk uses " " to define Unstructured Templates rather than { } which are used to define Structured Templates as we have already seen. Unstructured templates can be used in the same way as structured ones.

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

And to evaluate an unstructured template we use the same directive of ! which finds any embeded structural templates and evaluates them as data or code based on the directives they contain. In this case the {name?} template is found, resolved to "Sally Green" which is then inserted into the position of the placeholder.

```punk
> welcome! ⏎
{"Hello Sally Green"}
```

Querying into an unstructured template is possible but the only structure is a sequence of characters but deep queries are able to access that structure.

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




