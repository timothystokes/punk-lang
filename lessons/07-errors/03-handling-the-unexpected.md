# Handling the unexpected

There is no `try` or `except`, because nothing is thrown. A failed lookup, bad call or unmatched case is the non-thing, which can be tested like any other thing and answered with a case.

```punk
settings:[port:8080]
settings.host?
```
**`[]`**

```punk
settings:[port:8080]
isempty!settings.host?
-> (TRUE)[localhost]!
-> (_)[settings.host?]!
```
**`localhost`**
