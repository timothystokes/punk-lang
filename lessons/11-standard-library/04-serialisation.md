# Serialisation

`serialize` turns one thing into text and `deserialize` evaluates text back into a thing. The text is Punk, not JSON. To save several things, name them as one.

```punk
serialize![point:[1 2]]
```
**`point:[1 2]`**

```punk
serialize![point:[1 2]] > deserialize!
```
**`point:[1 2]`**
