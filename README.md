```
╭───╮ ╭╮  ╭─╮ ╭╮ ╭╮ ╭╮╭─╮      
│╭╮ │ ││  │ │ │╰╮││ │╰╯╭╯         
│╰╯ │ ││  │╭╯ │ ╰╯│ │╭╮│         
│╭──╯ ││  ││ ╭╯╭╮ │ │││╰╮            
│╰╮   │╰──╯│ │ │╰╮│ │││ ╰╮      
╰─╯   ╰────╯ ╰─╯ ╰╯ ╰╯╰──╯ 
```

# Punk

IDEA: Use Currying for multiple params to a function that are clearly separate values. e.g. split![-][split this-and this]

Punk is a functional immutable interpreted very loosely typed programming language. It has unique concepts and syntax. This implementation uses JavaScript as it's runtime.

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

### Reserved words

Punk does not have any reserved words. This way the words you see in your code are the ones you choose to describe your problem and reference your data and structure.

The reserved symbols used by Punk include: `[].?!:_*>(){}\`

### Things

Punk is not a strongly typed language, in fact there is really only one data type and that is a thing. 

### Numbers

Most software languages understand numbers implicitly. Punk is different. Punk doesn't understand that a number is a number until you try to use a function that treats the thing as a number.

```punk
> [42] ⏎
[42] 
```

### Words

Where other languages usually don't accept words as data outside of strings, Punk doesn't differenciate between string type things or number type thing. To punk it's all just characters inside [].

```punk
> [Paul] ⏎
[Paul]
```

In fact Punk doesn't differentiate between 42 and Paul even when they are parts of the same thing.

```punk
> [Paul is 42] ⏎
[Paul is 42]
```


### Named Things

You can name a thing using colon `:`.

```punk
> message:[Hello world] ⏎
message:[Hello world]
```

> NOTE: Punk treats names as immutable. Once you have attached a name to a thing then it sticks. You can't  attach that name to another thing (within the same namespace).


### Querying Named Things

You can retrieve a thing from it's name using a ? query.

```punk
> message? ⏎
[Hello world]
```

### Templates

Every Thing in punk is a template that that allows you to extract structure from a thing. Using an index you can get the nth word from the thing which is returned as a new Thing.

```punk
> message.1? ⏎
[Hello]
```

> NOTE: Indexes in most programming languages start with zero to get the first item. Punk is different. It uses 1 for the first item, 2 for the second etc..

### Nested Things

Things can contain other things including other named things.

```punk
> person:[name:[Paul Jones] age:[42]] ⏎
person:[name:[Paul Jones] age:[42]]
```

### Deeper Queries

The whole idea of using a Thing as a Template in Punk is that there is structure that can be determined and used in your programs by referencing named things and nested things by their name or by their index. 

This query resolved the value attached to the nested 'age' name within the person Thing above.

```punk
> person.age? ⏎
[42]
```

> NOTE: Any query that doesn't align with the names or structures of the thing being queries will result in a NULL response.

Here is another example that queries the person's name value then refernces the second word.

```punk
> person.name.2? ⏎
[Jones] 
```

### Nested Queries

Queries are also a thing so you can embed a query inside another thing. 

```punk
> person:[Paul] ⏎
person:[Paul]
> message:[Hello person?] ⏎
message:[Hello person?]
```

### Templates

Evaluating a thing with nested queries is essentially a template. Using the things above we can evaluate the message thing using the ! syntax at the end of the reference to the thing. 

```punk
> message! ⏎
[Hello [Paul]]
```

The inner `[Paul]` is there because `person` was bound to the thing `[Paul]`. A final . before the ? as in `.?` lets Punk know that you want reference the content of person, as we have done above, but without any additional reference to innser structure. Punk inlines the content without returning the enclosing Thing markers `[]`. 

```punk
> message2:[Hello person.?] ⏎
> message2! ⏎
[Hello Paul]
```

> NOTE: We have learned of three Punk language features now. : is used to name a thing, ? is used to query a thing for its content, and ! is used to evaluate a thing like it's a template.

### Patterns

Paterns are a way of defining the shape of a things so that they can be compared. This provides a way to build conditions in out program. Patterns are defined by ( ) syntax where underscores _ are used to denote an item placement and * to denote any number of items.

```punk
> (_) # A pattern that describes a thing shape that contains a single item # ⏎
> (_ _) # A pattern that describes a thing shape that contains two items # ⏎
> (*) # A pattern that describes a thing that has any number of nested items including no items # ⏎
> (5 _ _) # A pattern that describes a thing that contains three items where the item is 5 # ⏎
```

### Conditional Queries

Patterns become useful when attached to a query where they can be used as to check for a match againt the results of a query.

```punk
> name:[Paul Jones] ⏎
> name?(_ _) # does have two items # ⏎
[TRUE]
> name?(_) # does not have just one thing # ⏎
[FALSE]
```

### Conditional Queries with attached Things

Sometimes we want to resolve a value that isn't just [TRUE] or [FALSE].

```punk
> name:[Paul Jones] ⏎
> name?(_ _)[Full name found] ⏎
[Full name found]
``` 

### Conditional Queried with attached Things to evaluate

We can go one step further and define a Thing to evaluate IF the pattern matches by including the evaluation directive `!` on the end.

```punk
> name:[Paul Jones] ⏎
> name?(_ _)[name? is a full name]! ⏎
[[Paul Jonmes] is a full name]
``` 

### Conditional Queries named placeholdeers and with attached Things to evaluate ###

Conditional queries are even more powerful because we can use names for each of the placeholders in our patterns.

```punk
> name:[Paul Jones] ⏎
> name?(first:_ last:_)[The last name is last?]! ⏎
[The last name is [Jones]]
``` 

> NOTE: Where there is a query embeded into the contents of a thing that is difficult to differenciate between the reference and the other content then you can specify the named thing using {} which are ignored except for helping to demark where your name starts and ends.

```punk
> name:[Paul Jones] ⏎
> name?(first:_ last:_)[lastname={last}.?]! ⏎
[lastname=Jones]
``` 

> NOTE: to use ? . or other special syntact in a Things that you want to use as a template then you can escape those characters with a backslash.

### Functions

In Punk a function is simply a pattern connected to a template (...)[...] and in fact you have already seen one just above.

```punk
> (first:_ last:_)[The last name is last?]! ⏎
```

### Named Functions

Like other things functions can also be named so they can be used later. Here is a simple function that greets people with any number of parts to their name as * matches all. * is also a special name available inside function templates that gets all parametere passed to the function.

```punk
> welcome:(*)[Hello *.?] ⏎
```

### Evaluating a Function

To evaluate a function in a non-conditional way we pass the thing into the function after the `!`.

```punk
> welcome![Sally-Ann Green] ⏎
[Hello Sally-Ann Green]
```

> NOTE: Conditional queries in punk are actually just special higher order functions that take a function as their input.

### Pipes

There is one more way to provide a value to a function. Using pipe notation `>` suggestive of an arrow.

```punk
> [Sally]>welcome! ⏎
[Hello Sally]
```

> NOTE: Pipes can be chained together using an initial query or reference followed by any number of function names and then terminated with our evaluate symbol ! . 

We have seen how using things as templates is core to how Punk references code and data almost interchangeably.

### Where next?

See: punk-by-example.md file for more examples and language features.