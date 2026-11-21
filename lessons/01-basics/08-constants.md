# Constants

Every name is a constant. A name cannot be defined twice in the same context (NAME-2), and nothing is ever changed in place.

```punk
pi:3.14159
pi:3
```
**`The name 'pi' is already attached in this context`**

To "change" a value, make a new thing with a new name.

```punk
price:10
total:*![price? 3]
total?
```
**`30`**

Inner contexts, such as function bodies, can use the same name for something different without touching the outer one.

```punk
x:1
f:(_)[x:2 x?]
0 > f!
```
**`[x:2 2]`**
