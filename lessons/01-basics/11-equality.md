# Equality

`=` compares things by shape and content. There is no separate idea of identity, because a name never refers to something that can change underneath it.

```punk
=![[a b:1] [a b:1]]
```
**`TRUE`**

```punk
=![[a b] [b a]]
```
**`FALSE`**

Several things can be compared at once.

```punk
=![1 1 1]
```
**`TRUE`**

A thing equals its single-item wrapping (GRP-6).

```punk
=![x [x]]
```
**`TRUE`**
