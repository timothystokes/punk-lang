# Punk — repository instructions for AI assistants

This file is the canonical, version-controlled summary of language rules,
conventions, and gotchas for working in this repo. Read it before making
changes. If a rule here conflicts with code, the rule wins and the code
is the bug — flag it and ask before reinterpreting.

## Project shape

- Source: `src/` (tokenize → parse → eval), entry `src/index.js`
- Built-ins: `src/builtins.js`
- Tests: `tests/*.test.mjs`, run with `npm test`
- Reference docs: `README.md` (tour), `docs/punk-by-example.md` (deep)
- CLI: `npm start <file.punk>` runs a file silently (only `print!` writes
  to stdout). REPL prints the full result tmpl per top-level expression.

## Core language rules

### Short-form sugar (parse-time)

The RHS of `:`, `!`, `'` accepts a single bare value as shorthand for a
singleton template. Wrap is applied uniformly **at parse time** so all
downstream passes see one canonical shape.

**Principle:** wrap only **bare value-words** — things with no internal
structure. Anything that already has its own structural identity binds
directly.

| Value on RHS | Wrap to `{value}`? | Notes |
|---|---|---|
| Word value (`hello`) | **YES** | `n:Paul` ≡ `n:{Paul}` |
| Word number (`42`) | **YES** | `n:5` ≡ `n:{5}` |
| Word reserved (`TRUE` `NULL`) | **YES** | `ok:TRUE` ≡ `ok:{TRUE}` |
| Fn `(p){b}` | NO | `name:(p){b}` is *naming a function* — binds the Fn directly. To put a Fn into a template, the user wraps it explicitly. |
| PartialFn `fn'x` | NO | callable, same reason as Fn |
| Pattern `(...)` | NO | first-class; `p:(x:_)` names a pattern (see [Named patterns](#named-patterns)) |
| Tmpl `{...}` | NO | already a template |
| Text `"..."` | NO | already a template (joined-with-space form) |
| Box `[name]` | error on `:` RHS | boxes don't bind via `:` |
| Ref (`xs?`) | NO | evaluates lazily; no wrap |
| Range `1~5` | NO | already structural |
| Exec `f!x` | NO | already structural |
| Query `xs.1?` | NO | already structural |

### Slots are NOT named bindings — never wrap

Pattern slots are **labeled shape checks**, not Named bindings. The
RHS of a slot (after `:`) is one of: `_` (one thing), `*` (rest — must
be last), a literal to value-match, or a `ref?` query. **It is never
short-form wrapped.** A slot named `(n:_)` says "this position is one
thing of any shape; label that one thing `n`". Compare:

- `(n:_)` vs `{Tim}` → match. `n` binds to `Word{Tim}` (whatever
  matched the `_`, no wrap).
- `(n:{_})` vs `{Tim}` → **no match**. The slot now requires a
  singleton-tmpl shape, but `{Tim}` is a 1-item tmpl containing a
  Word, not a tmpl-containing-a-tmpl.

So `welcome:(n:_){Hello n?}` then `welcome!{Tim}`:

- args is `{Tim}` (a 1-item Tmpl).
- slot `n` binds the matched item `Tim` (Word value) — **no wrap**.
- body: `n?` resolves to `Word{Tim}` and lands as one item.
- body items = `[Word{Hello}, Word{Tim}]`.
- fn body IS a template: result = `{Hello Tim}`.

### Patterns

- Patterns describe **value shape**. Names in a pattern bind only; they
  are NOT part of the contract. `(name:_)` binds a wildcard slot;
  `(_)` matches the same shape without binding.
- Slot syntax: the value-position marker is either `_` (exactly one
  thing) or `*` (zero or more, **must be last**). Both can appear bare
  or after `name:`.
  - `_` — anonymous single slot
  - `name:_` — named single slot
  - `*` — anonymous rest (last slot only)
  - `name:*` — named rest (last slot only)
- `_:_` is meaningless (wildcard name binding wildcard value) and is a
  syntax error. Same for `_:*`.
- At most one `*` per pattern, and it must be the last slot.

### Named patterns

Patterns are first-class values; they can be bound to a name and reused.

```
person:(name:_ age:_)            -- name a pattern
greet:(person?){Hi name?, age?}  -- use the named pattern via (p?){body}
greet!{Sally 32}                 -- {Hi {Sally}, {32}}
```

The `(p?){body}` form looks up `p` in the env, expects it to be a
Pattern, and **splices the named pattern's slots** into this call-site
pattern (i.e. you get the named slots `name:_ age:_` directly, not a
nested pattern). The same named pattern can be used in multiple
functions.

Currently a `(p?){body}` form supports a single named-pattern reference
spliced as the entire pattern; mixing splice and inline slots is not
yet defined.

### Function call / pipe canonical table

For `welcome:(n:_){Hello n?}`:

| Form | Result |
|---|---|
| `welcome!{Sally}` | `{Hello Sally}` |
| `welcome!Sally` | `{Hello Sally}` — short-form of above |
| `{Sally}->welcome!` | `{Hello Sally}` — pipe ≡ `welcome!{Sally}` |
| `Sally->welcome!` | `{Hello Sally}` — pipe seed auto-wraps (≡ above) |
| `5->double!` | short-form of `{5}->double!` ≡ `double!{5}` |
| `{a b}->welcome!` | **runtime error** — 2 items into 1 slot |
| `welcome!{a b}` | **runtime error** — same reason |

Pipe rule: `X->fn!` ≡ `fn!X`. A pipe stage receives exactly one thing.

The fn body has 2 items (`Hello` and `n?`). Slot binding doesn't
wrap, so `n?` is bare `Sally`. The body IS a template, so its result
is `{Hello Sally}` — flat, because the body itself has the items.

**Pipe seed auto-wrap (uniform):** a bare Word value/number/reserved
at the start of an executing pipe gets the same short-form wrap as
`:` / `!` / `'` RHS — it becomes a singleton Tmpl. This applies
uniformly to ALL executing pipes, including box writes. So
`42->[n]!` parses with seed `{42}` and writes `{42}` (a Tmpl) into
the box. The box stores whatever flows through; there is no special
unwrap for box-write pipes. Mid-stages are callable refs (resolved
when the trailing `!` fires) and are **not** wrapped. Arity mismatch
(e.g. `{a b}->one-slot!`) remains a runtime error, not a parse error.

### Embed stringification — `"..."` vs `{...}`

- Inside `"..."` (unstructured text): each `{expr}` embed is evaluated,
  then **joined-with-space** to a string. A singleton-Tmpl value
  stringifies as its inner item (join of one). So `(n:_)"Hi {n?}"!Bob`
  → `"Hi Bob"` — the singleton form is invisible to text rendering.
- Inside `{...}` (structured template): embeds are NOT stringified;
  the resolved value lands as one item, preserving its shape.

### Arithmetic / data builtins auto-unwrap singletons

`toNum` and similar coercers in `src/builtins.js` unwrap a singleton
Tmpl automatically. So `n? = {5}` flows through `<=!{n? 1}` as 5 vs 1
without an explicit `.?`. Use `.?` only to spread a multi-item tmpl
inline into a structured template.

### Templates and structural whitespace

- Whitespace at template/top-level context tokenizes to first-class
  SPACE tokens — preserved through serialize/format, transparent to
  data builtins.
- Punk has **no escape for spaces/tabs/newlines** (no `\<space>`,
  `\<tab>`, `\<newline>`). Punk is a templating engine; whitespace is
  structural.
- Word-internal escapes: `\n`, `\t` map to newline/tab; any other
  `\X` is literal X (esc-flagged). No `\s`.

### Boxes

- No declaration form. `name:[value]` is **wrong**. The brackets ARE
  the box; it comes into existence on first write: `value->[name]!`.
- Read: `[name]->fn!`.

### Function return semantics

A function is a pattern attached to a template. Calling the function
evaluates the body template's items in scope and returns the result
**as a template** — always. There is no unwrap, no special case for
1-item bodies, no magic.

- Body items become the result template's items. 1-item body returns
  `{thing}`; 3-item body returns `{a b c}`. If `thing` is itself a
  Tmpl `{x y}`, the 1-item result is `{{x y}}` — nesting is correct
  and expected.
- All top-level items of the body land in the result, including
  `name:value` bindings that did prep work. Use `~` on the final
  expression to **slice** the result to just that item (still
  returned as a 1-item template).
- To **inline** a nested fn-call result into the surrounding body
  template, use `.?` on the call: `f!{x}.?` spreads the items of
  `f`'s returned tmpl into the parent template. Without `.?` the
  call's result lands as one item (a Tmpl), causing the natural
  nesting.

Pipe-seed wrap is uniform: `value->stage!` ≡ `{value}->stage!`. The
seed is a tmpl as it flows; box writes therefore store the wrapped
form. Use `.?` (in a fn body) or feed through `(v:_){v?~}` if you
want the seed-as-bare-value.

### Terminology

- Punk has no "literals" — text/num/tmpl/named are all just Values.
  Don't introduce "literal" terminology in identifiers or docs.
- Don't say "auto-wrap"; the term is **short-form** (parse-time sugar).

## Coding conventions

- ES modules. Imports use explicit `.js` extensions.
- Tests use Node's built-in `node:test` + `node:assert/strict`.
- Test helper `tests/_punk.mjs::punk()` uses `evalProgram` (returns
  last item only); CLI uses `evalProgramAsTmpl` (full tmpl). Tests for
  multi-item top-level output differ between the two.

## Workflow

- Run `npm test` before and after changes.
- Don't chase test errors before verifying tests reflect the current
  rules — fix obvious-wrong expectations first, then run, then debug
  what remains.
- When fixing a language bug, prefer fixing it in the right phase
  (tokenize/parse/eval) so internals remain uniform.
- Co-author commits to `Copilot` when the change was AI-assisted.

## Open / pending design work

- **Pattern slot-kinds refactor (in scope now):** `Pattern.items`
  become uniform `Slot {name: string|null, rest: bool}` nodes,
  replacing today's `Word{subkind:'wildcard'|'variadic'}` and
  `Named{value:Word{...}}` shapes. Removes subkind-sniffing across
  `parse.js`, `match.js`, `eval.js`, `builtins.js`.
- **Single short-form wrap helper:** one `applyShortFormWrap(node)`
  called from `passResolveNamed` (both branches) and from slot binding
  in `match.js`. Wrap kinds per the table above.
- **Unified call-form mechanism:** `node ! args`, `node ' args`,
  `node ? segments` should produce `Exec`/`PartialFn`/`Query`
  regardless of whether `node` is a name-Word, Fn, Tmpl, Box, etc.
  Today there are two paths (decodeWord-glued vs `passPostfixBang`)
  and `passPostfixBang` runs after the final `passArgsAttach`, which
  is a bug.
- **Pipe simplification:** `runPipeline` should desugar to `fn!argsTmpl`
  directly. Pipe seed auto-wraps via the same `applyShortFormWrap`
  helper used elsewhere (bare Word value/number/reserved → singleton
  Tmpl). No parse-time ban on bare seeds; arity mismatch is a runtime
  error only.
- **Named-pattern splice:** `(p?){body}` resolves `p` to a Pattern and
  splices its slots into the call-site pattern.
- **Error-location coverage:** `expected a number` and
  `map!: last argument must be a template` lack source locations.
