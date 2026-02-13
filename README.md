# Punk Programming Language

## Introduction
Punk is a functional programming language designed for concise and expressive data processing. It features a unique syntax that emphasizes readability and composability, with a focus on functional programming patterns and data transformation.

## Core Concepts

### Things and Named Things
Things are the basic building blocks in Punk. They can be Simple Things or Named Things.

```punk
hello           # Simple Thing
person:Tim      # Named Thing
```

#### Accessing a thing by its name

In Punk the `.` character resolves the Thing associated with a name from a Named Thing.

```punk
name:Tim # define a Named Thing
.name # Resolves the Simple Thing that was named. In this case Tim (retrieved from the default namespace)
```

**Immutability and Naming:**  
All Things in Punk are immutable. Once a Thing is named, its value cannot be changed. However, a new Named Thing within the same namespace will remap the new Thing to that name. This is similar to shadowing or rebinding in other functional languages.

**No Null Things:**  
Punk has no null Thing. If an expression produces nothing, then nothing is returned and no Thing exists to be used or printed.

```punk
person:Tim
person:Bob
.person # returns Bob, the new Thing named 'person'
```

### Lists are Things

A List is a collection of Things enclosed in brackets `[ ]`. **Importantly, a List itself is a single Thing** when viewed from outside. When you pass a List to a function, you're passing one Thing (which happens to contain multiple items).

Lists can be used as both associative arrays (by name) and indexed arrays (by position):
```punk
[Tim age:44]  # A List containing a Thing and a Named Thing
```
NOTE: When dereferencing items from a List by name the last value is returned on the principle that within the namespace new named things replace previous ones using that name.

### Character Rules

#### Special Characters
The following characters have special meaning in Punk and cannot appear in Thing values or names:
- `.` - Dereference operator
- `:` - Name assignment operator
- `!` - Function call operator
- `?` - Pattern matching operator
- `??` - Multiple pattern matching operator
- `[` `]` - List delimiters
- `(` `)` - Pattern delimiters
- `_` - Single wildcard in patterns
- `*` - Multiple wildcard in patterns
- `~` - Last item accessor
- `#` - Comment delimiter (block style)

#### Things
- Can contain any character except the special characters listed above
- Examples:
  ```punk
  hello-world  # Valid Thing
  user@example  # Valid Thing
  price99  # Valid Thing
  ```

#### Names of things
- Must start with a letter (a-z, A-Z)
- Can only contain letters and numbers after the first character
- Examples:
  ```punk
  person:John  # Valid name
  field27:Monday # Valid name
  name:Tim  # Valid name
  3x: # Not a valid name
  ```

#### Numbers
Punk supports numeric literals in two formats:
- Standard format: `123`, `-45`, `0`
- European format: `1,5` (comma as decimal separator, equivalent to `1.5`)

Examples:
```punk
42        # Integer
-17       # Negative integer
3,14159   # European decimal (equals 3.14159)
```

#### Comments
Comments in Punk use block-style delimiters with `#`:
```punk
#This is a comment#
name:Tim  #inline comment# age:44
```
Comments are completely removed during tokenization and can span multiple lines.

#### Strings
Punk has no string literal type. To represent text with multiple words, use a List of Things:
```punk
message:[Hello World]  # A list containing two Things
.log!message           # Logs: Hello World
```

#### Literal Boolean Things
Punk has two special literal Things for boolean values:
- `TRUE` - Represents a true value
- `FALSE` - Represents a false value

These are capitalized to emphasize they are static literals.

### Whitespace
Whitespace (spaces, tabs, newlines) serves as a delimiter between tokens. Multiple whitespace characters are treated as a single delimiter. Whitespace between operators and operands is significant - for example, `numbers.1` (no space) dereferences index 1, while `numbers .1` (with space) is invalid syntax.

### Lists
Lists in Punk have a unique dual nature - they can be accessed both by index (like traditional arrays) and by name (like associative arrays).

```punk
[1 2 3]  # Simple List
names:[Tim Bob Mary]  # Simple Named list
people:[
  [name:Tim age:44]
  [name:John age:30]
]  # Named List of Lists
```

Important rules for list things:
1. Simple Things don't need individual brackets
2. Nested Lists require their own brackets: `[[1 2] [3 4]]`
3. Lists can contain Things, Named Things, or other Lists
4. All Things are immutable
5. Things in a List can be accessed by both index and name (if named)
6. When multiple items have the same name, the last one supersedes earlier ones

#### List Access Examples
```punk
# Access by numeric index (using . followed by number)
numbers:[1 2 3]  # Define a named list
numbers.1  # Returns 2 (0-based indexing) - note no space before .1

# Access last item using ~
numbers.~  # Returns 3 (the last item)

# Access by name
people:[person:John person:Tim]  # Defines a list of Named Things
.people.person  # Returns 'Tim' as it overloads the previous named thing in the list
```

# Pattern Matching

A pattern in Punk is defined by shapes of data placed between `( )` where:
- `_` represents a single Thing in a pattern shape
- `*` represents any number of Things (including zero Things)

For example:
```punk
(_ _)        # Matches a List containing exactly two Things
(3 _ _)      # Matches a List containing three Things where first is Thing '3'
(*)          # Matches any Thing
(person:Tim *) # Matches any List where 'person:Tim' is the first Thing in the list
```

**Note:** Empty patterns `()` are not currently implemented.

## Conditional Pattern Matching (`?`)

The `?` operator performs conditional pattern matching:
```punk
value?pattern[thenExpression][elseExpression]
```

## Multiple Pattern Matching (`??`)

The `??` operator allows matching against multiple patterns:
```punk
value??[
  [pattern1 [expression1]]
  [pattern2 [expression2]]
  [pattern3 [expression3]]
]
```
The first matching pattern's expression is evaluated and returned.

## Named Patterns

Patterns can be named just like any other Thing. Use the names anywhere a pattern is expected.

```punk
isTim:(Tim)
isBob:(Bob)
isZero:(0)
```

## Functions

Functions are defined by a pattern connected to an expression (List) that can be applied to a Thing passed to the function that matches that pattern. They are executed by using the `!` character after the function or named function.

**Every function takes exactly one Thing as its parameter.** Since a List is a single Thing, you can effectively pass multiple values by wrapping them in a List `[ ]`.

Punk has no methods. Operations live in function libraries (like `.math`, `.list`, `.text`), and the target Thing is passed as the argument. For example, use `.list.map![.numbers (_)[...]]` rather than `numbers.map`.

To call (execute) a named function, first resolve it using `.` and then apply `!`. For example:

```punk
double:(_)[.math.mul![. 2]]   # Define a function named 'double'
.double!4                     # Calls the function 'double' with argument 4, returns 8
```

If a function is resolved by name but without the `!`, the result is a reference to the function itself, which can be passed as a parameter to another function:

```punk
double:(_)[mul![. 2]]
.map![.numbers .double]  # Passes the function reference 'double' to 'map!'
```

Punk supports anonymous functions that are useful for higher-order functions that accept a function as a parameter.

```punk
.map![.people (person:_)[.person.name]]
```
Returns a list of names from a list of people that contain an element called `name`.

There are a number of built-in functions such as those within the `.math` global namespace.

#### Named Function Example

```punk
sum:(_ _)[.math.add![.0 .1]]
.sum![2 3]  # Returns the full List from the function body
```

**Function Return Values:** A function body is always a List. When the function executes, the entire List is evaluated and returned. Each expression in the List is evaluated in sequence, and the complete List of results is returned.

To access specific results:
- `.0` - First item in the returned List
- `.1` - Second item in the returned List
- `.~` - Last item in the returned List

## Parameter Access

### Single Parameter Access
When a function has a single parameter, you can use `.` to access it.

### Multi-Parameter and List Item Access
For functions that take a List of inputs, use `.0`, `.1`, etc. to access items in that List. These numeric accessors work by dereferencing the List by name - each item in a List is implicitly given a numeric name corresponding to its index.

```punk
# Accessing list items by index (which is actually accessing by numeric name)
numbers:[10 20 30]
numbers.0  # Returns 10 (first item, index 0)
numbers.1  # Returns 20 (second item, index 1)
numbers.~  # Returns 30 (last item)
```

If the function's pattern signature has named parameters, you can also access the input values using the name. The `.` lookup resolves the function's local parameter namespace first, then walks up the calling namespaces to the default namespace.

## Library Functions

Common built-in functions include:

### Mathematical Operations (in `.math` namespace)
```punk
.math.add!      # Add two numbers
.math.sub!      # Subtract two numbers
.math.mul!      # Multiply two numbers
.math.div!      # Divide two numbers
.math.pow!      # Power function
.math.sqrt!     # Square root
.math.isnum!    # Check if a Thing is a number (returns TRUE or FALSE)
```

Example usage:
```punk
.math.add![5 3]     # Returns 8
.math.mul![4 7]     # Returns 28
```

### List Operations (in `.list` namespace)
```punk
.list.map!      # Transform each element in a list
.list.filter!   # Filter elements based on a condition
.list.reduce!   # Reduce a list to a single value
.list.flatMap!  # Transform and flatten a list
```

### Text Operations (in `.text` namespace)
```punk
.text.upper!    # Convert text to uppercase
.text.lower!    # Convert text to lowercase
.text.split!    # Split text into list
.text.join!     # Join list into text
.text.replace!  # Replace text in text
.text.trim!     # Remove whitespace
```

### Logic Operations (in `.logic` namespace)
Logic functions perform comparisons and return boolean literal Things (TRUE or FALSE) that can be used in conditionals and pattern matching.

```punk
.logic.gt!      # Greater than - compares numbers or text (alphanumeric order)
.logic.lt!      # Less than - compares numbers or text (alphanumeric order)
.logic.eq!      # Equal - deep equality check, returns TRUE if Things look the same
```

The `.logic.gt!` and `.logic.lt!` functions work on both numbers and text. For text, they compare using alphanumeric order (e.g., `xyz` is greater than `abc`).

The `.logic.eq!` function performs deep equality checking, meaning it compares the structure and values of Things:
```punk
.logic.eq![[1 2 3] [1 2 3]]    # Returns TRUE (lists have same values)
.logic.eq![5 5]                 # Returns TRUE (same number)
.logic.eq![[a:1 b:2] [a:1 b:2]] # Returns TRUE (same named things and values)
```

### Log Function
The log function is used to output messages. It's one of the few functions available at the top level (not namespaced).

```punk
.log![This is a message]  # Logs: This is a message
.log![Hello World]         # Logs: Hello World
```

The log function takes a single Thing as its parameter. Since a List is a single Thing, you can pass a List to log multiple values. The function returns nothing.