```
             _   
 ___ _ _ ___| |_ 
| . | | |   | '_|
|  _|___|_|_|_,_|
|_|  
```

# Punk

Punk is an interpreted functional very loosely typed immutable programming language. It has unique concepts and syntax. This implementation uses node.js as it's runtime.

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

Punk does not have any reserved words. This way the words you see in your code are the ones you choose to describe your problem and reference your functions and data structure.

The reserved symbols used by Punk include: 
`:` - name a thing
`[]` - A thing that contains multiple things
`.` - A segment of a namespace query
`?` - Evaluate a query
`!` - Evaluate a pattern or function or template
`>` - a segment of a pipe
`->` - a case to in a match case
`()` - a pattern
`|` - a 'such that' condition within a pattern
`_` - a single placeholder in a pattern
`#` - an any placeholder in a pattern

### Things

Punk is not a strongly typed language, in fact there is really only one data type and that is a thing. 

### Numbers

Most software languages understand numbers implicitly. Punk is different. Punk doesn't understand that a number is a number until you try to use a function that treats the thing as a number.

```punk
42
```
**`42`**

### Words

Where other languages usually don't accept words outside of strings, Punk doesn't differenciate between string type things or number type thing. To punk it's all just characters inside.

```punk
Paul
```
**`Paul`**

### Things that contain multiple things

Punk's primary delimiter between things is space.

When there are multiple things you want to treat as a thing then you can group them with [ ]. In punk the [ ] don't mean anything at all except to group things together.

```punk
[Paul is 42]
```
**`[Paul is 42]`**

### Named Things

You can name a thing using colon `:`.

```punk
x:1
```
**`x:1`**

A named thing with things in it would looks like this...

```punk
message:[Hello world]
```
**`message:[Hello world]`**

> NOTE: Punk treats names as immutable. Once you have attached a name to a thing within a namespace context then it sticks. You can't  attach that name to another thing.


### Querying Named Things

You can retrieve a thing from it's name using a ? query.

```punk
message?
```
**`[Hello world]`**

### Using the Structure of Things

Every thing can be queried in a ways that leverages structure from the thing. For example using an index you can get the nth thing from the thing based on spaces being punk's native delimiter.

```punk
message.1?
```
**`Hello`**

> NOTE: Indexes in most programming languages start with zero to get the first item. Punk is different. It uses 1 for the first item, 2 for the second etc..

### Nested Named Things

Things can contain other things including other named things.

```punk
person:[name:[Paul Jones] age:42]
```
**`person:[name:[Paul Jones] age:42]`**

### Deeper Queries

Queries can extract information from deep into the structure of any thing including referencing nested named inner things. 

This query resolved the value attached to the nested 'age' name within the person Thing above.

```punk
person.age?
```
**`42`**

> NOTE: Any query that doesn't align with the names or structures of the thing being queries will result in a non thing which is represented by [].

Here is another example that queries the person's 'name' thing then refernces it's second thing.

```punk
person.name.2?
```
**`Jones`**

### Nested Queries

Queries are also a thing so you can embed a query inside another thing. 

```punk
person:[Paul]
```
**`person:[Paul]`**

```punk
message:[Hello person?]
```
**`message:[Hello person?]`**

### Templates

Evaluating a thing with nested queries is essentially a template. Using the things above we can evaluate the message thing using the ! syntax at the end of the reference to the thing. 

```punk
message!
```
**`[Hello Paul]`**

### Patterns

Paterns are a way of defining the shape that can be compared to a thing. This provides a way to build conditions in our program. Patterns are defined by ( ) syntax where underscores _ are used to denote an item placement and # to denote any number of items.

**`(_)`** - A pattern that describes a thing shape that contains a single thing

**`(_ _)`** - A pattern that describes a thing shape that contains two grouped things

**`(#)`** - A pattern that describes a thing that has any number of nested items including no items

**`(5 _ _)`** - A pattern that describes a thing that contains three items where the first item is 5

**`(_ _ _ #)`** - A pattern that describes a thing that has at least 3 things


### Pattern Matching

Patterns become useful for seeing if a thing passed to the pattern using > matches by 'executing' the pattern using !

In this example patterns are used to determine the shape of the thing being passed. Is there two things in the thing or one thing?

```punk
name:[Paul Jones]
```

```punk
name? > (_ _)!
```
**`TRUE`**

```punk
name?(_)!
```
**`FALSE`**

> NOTE: TRUE and FALSE are not special things. They just happen to be used consistantly in punk.


### Pattern Matching with a specific outcome

Sometimes we want to do mote than just find out if a pattern matched. This is done by attaching a thing to a pattern as a template thing that should be evaluated if the pattern matches.

```punk
name:[Paul Jones]
name? > (_ _)[Full name found]!
```
**`[Full name found]`**

### Such That Patterns

A pattern can use `|` (such that) to match the names and values inside the thing being passed. The left side of the `|` is a normal shape pattern. The right side lists `name:value` pairs that must be present in the thing, in any order.

```punk
person:[name:Bob age:42]
```

```punk
person? > (# | name:Bob)!
```
**`TRUE`**

```punk
person? > (# | name:Sally)!
```
**`FALSE`**

The `#` on the left means match any shape, then the thing must also have a named thing `name` with the content `Bob`.

Labels on the left side of the `|` are names for the matched things that can be used inside the function template. The names on the right side of the `|` are the actual names and values of the thing being passed to the function. In other words, match the thing using a shape `|` (such that) the named things are there and have specific values.

### Functions

In Punk a function is simply a pattern connected to a template thing(...)[...] and in fact you have already seen one just above.

The shapes of the within a function's pattern can be named as normal using : and then resolved from within the function's template using ? to query. 

```punk
(first:_ last:_)[The last name is .last?]
```

> NOTE: the . prefix in the query syntax references the one thing that was passed to the function. Punk only ever passes a single thing to all functions but using the . reference and punks query syntacx structure can be retrieved from that thing.

### Named Functions

Like other things functions can also be named so they can be used later. Here is a simple function that greets people.

```punk
welcome:(name:_)[Hello .name?]
```

### Evaluating a Function

To evaluate a function in in punk we use ! so using the named function above we can do this.

```punk
Sally > welcome!
```
**`[Hello Sally]`**

We can also call functions by providing the thing to process directly attached when not in a pipe.

```punk
welcome![Jim]
```
**`[Hello Jim]`**

> NOTE: If the pattern of a fuction doesn't match the thing being passed to it then it returns [] which is essentially a non-thing.

### Pipes

We have already seen how values are passed to a function. This is called a pipe and they can be chained using additional `>` where the output of one function is passed to the next.

```punk
Sally > welcome! > upper!
```
**`[HELLO SALLY]`**

> NOTE: A pipe of functions is a essentially just a function where the initial patterns determines the input and the last function determines the output.

### Named Pipes

Like anything else in punk a pipe can be named

```punk
upperWelcome:> welcome! > upper!
```

```punk
John > upperWelcome!
```
**`[HELLO JOHN]`**

### Pattern Matching with multiple Cases

Punk provides a way to specify multiple functions or pipes and then executes the first match only. This is done using ->.

```punk
number: 43 
number? 
-> (42)[This is Forty Two]!
-> (n:_)[This is .n?]!
```
**`[This is 43]`**

### Nested Pattern Matching with Cases

When there are multiple levels of cases to be matched then the arrow notation -> can be extended to show each level for example --> or --->

```punk
person:[name:[John Smith] role:vip] 
person? 
-> (_ _)[.?]!
--> (n:_ vip)[.n?]! > upper!
--> (n:_ _)[.n?]!
-> (_)[You need to provide two names]!
```
**`[JOHN SMITH]`**

### Currying

Because Punk knows the expected shape of the thing being passed to a function, where there are missing parameters, punk fills in the ones it gets starting from left to right and then returns a new function with that slot filled by the literal value. This coding style is called currying.

```punk
timesTwo:*[2]!
4 > timesTwo!
```
**`8`**

By using Currying with directly a directly attached parameter in pipelines we can inject data into any pipeline.

```punk
4 > -!8 > *!7
```
**`28`**

which is equivelent to 

```punk
*![-![8 4] 7]
```
**`28`**

### The Library

Punk has a built in library of functions for example the upper functions which takes andy thing and converts all alpha characters to uppercase.

Here is a full list of functions, their patterns and what they do. Functions are grouped by purpose.

### Maths

- `+(_ _ #)` - add two or more numbers.
- `-(_ _)` - subtract the second number from the first.
- `*(_ _ #)` - multiply two or more numbers.
- `\(_ _)` - divide the first number by the second.
- `mod(_ _)` - the remainder after dividing the first number by the second.
- `pow(_ _)` - raise the first number to the power of the second.
- `sqrt(_)` - square root.
- `abs(_)` - absolute value.
- `neg(_)` - flip the sign of a number.
- `floor(_)` - round down to the nearest whole number.
- `ceil(_)` - round up to the nearest whole number.
- `round(_)` - round to the nearest whole number.
- `min(_ _ #)` - the smallest of two or more numbers.
- `max(_ _ #)` - the largest of two or more numbers.
- `sum(#)` - add up every item in a thing.
- `rand(_ _)` - a random number between the first and second numbers.

### Comparison

- `=(_ _ #)` - returns TRUE if two or more things are the same.
- `~=(_ _ #)` - returns TRUE if two or more things are not all the same. Equivalent to `~` applied to `=`.
- `lt(_ _)` - returns TRUE if the first number is less than the second.
- `gt(_ _)` - returns TRUE if the first number is greater than the second.
- `lte(_ _)` - returns TRUE if the first number is less than or equal to the second.
- `gte(_ _)` - returns TRUE if the first number is greater than or equal to the second.

### Logic

- `~(#)` - inverts the logical input.
- `&(_ _ #)` - returns TRUE if all of two or more logical inputs are TRUE.
- `xor(_ _)` - returns TRUE if exactly one of the two inputs is TRUE.

### Type Checks

- `isnum(_)` - TRUE if the thing can be treated as a number.
- `istext(_)` - TRUE if the thing is text.
- `isempty(#)` - TRUE if the thing has no items.
- `isfn(_)` - TRUE if the thing is a function.
- `num(_)` - converts a thing to a number, or returns [] if it can't be.

### Text Manipulation

- `upper(#)` - converts all alpha characters to uppercase.
- `lower(#)` - converts all alpha characters to lowercase.
- `trim(#)` - removes leading and trailing whitespace.
- `length(#)` - the number of characters in a text.
- `chars(#)` - splits text into a thing of individual characters.
- `split(_ _)` - splits text by a separator into a thing of items.
- `join(_ #)` - joins the items of a thing into text using a separator.
- `replace(_ _ _)` - replaces every occurrence of a search text with another text.
- `sub(_ _ _)` - the part of a text between a start and end position.
- `startsWith(_ _)` - TRUE if the text begins with the given text.
- `endsWith(_ _)` - TRUE if the text ends with the given text.
- `repeat(_ _)` - repeats a text a number of times.
- `pad(_ _ _)` - pads a text to a given width using a fill character.

### Collections

- `count(#)` - the number of items in a thing.
- `first(#)` - the first item.
- `last(#)` - the last item.
- `rev(#)` - reverses the order of items.
- `sort(#)` - sorts items in ascending order.
- `unique(#)` - removes duplicate items.
- `contains(_ #)` - TRUE if the thing contains the given item.
- `concat(_ _ #)` - joins two or more things into one.
- `slice(_ _ #)` - the items between a start and end position.
- `range(_ _)` - a thing containing every whole number from the first to the second.
- `zip(_ _)` - pairs up the items of two things.
- `flatten(#)` - removes one level of nesting.

### Higher Order Functions

- `map(_ #)` - applies a function to every item and returns the results.
- `filter(_ #)` - keeps only the items for which a function returns TRUE.
- `find(_ #)` - the first item for which a function returns TRUE.
- `each(_ #)` - calls a function for every item, for side effects.
- `reduce(_ _ #)` - combines all items into one using a function and a starting value.
- `any(_ #)` - TRUE if a function returns TRUE for any item.
- `all(_ #)` - TRUE if a function returns TRUE for every item.

### Input, Output and Files

- `print(#)` - writes a thing to the output.
- `read(_)` - reads the contents of a file.
- `write(_ _)` - writes a thing to a file, replacing its contents.
- `append(_ _)` - adds a thing to the end of a file.
- `exists(_)` - TRUE if a file exists.

### Utility

- `assert(_ #)` - fails with a message if the first thing is not TRUE.
- `serialize(_)` - converts a thing to text.
- `deserialize(_)` - converts text back to a thing.
- `import(_)` - loads the functions from another Punk file.
