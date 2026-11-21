# Named things

`name:thing` attaches a name to a thing. Defining a name evaluates to
the named thing itself (NAME-3).

```punk
x:1
```
**`x:1`**

Names are immutable inside a context. A second definition of the same
name in that context is a syntax error (NAME-2).

```punk
x:1
x:2
```
**`The name 'x' is already attached in this context`**
