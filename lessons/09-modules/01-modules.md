# Modules

`import!name` evaluates the file `name.punk` (beside your program, then in the `lib` folder) and returns everything it names. Name the result and query it.

```punk
http:import!punk.http
http.parseForm!a=1&b=hello+x
```
**`[a:1 b:hello x]`**

A module is evaluated once. It cannot see the importer's names. A missing module is `[]`.

The `lib` folder holds `punk.http` (response and form helpers) and `punk.html`. In `punk.html` code is data: an element is a named function that is never called. Its name is the tag, its pattern holds the attributes and its body holds the children. The library reads them with `patternOf` and `bodyOf`.

```punk
html:import!punk.html
html.page![head:()[title:()[My page]] body:()[h1:(color:red)[Welcome]]]
```
**`<!DOCTYPE html><html lang="en"><head><title>My page</title></head><body><h1 color="red">Welcome</h1></body></html>`**

The core library provides `serve` to run a server. It parses a form post's body into named things, so a handler can query it as `body.note?`. `examples/server.punk` is a todo web app written in Punk.
