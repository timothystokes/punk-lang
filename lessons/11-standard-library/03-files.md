# Files

`write` replaces a file's contents, `append` adds to the end, `read` gives the contents back and `exists` tests for it. Each returns `TRUE` on success. These work in the Node runtime; in the browser they have no files to use.

```bash
npm start examples/todo.punk
```

A missing file is simply absent.

```punk
exists!nothing.txt
```
**`FALSE`**

```punk
read!nothing.txt
```
**`[]`**
