### Destructuring using Patterns

_ placeholder
[name] named placeholder
* any number of things must be last
*[name] named any number of things must be last

call our current boxes Atoms with syntax @counter@ behave as they do today

given data:{a:1 b:2 c:{green blue}} ...

data?(_ _ _) TRUE
data?([x] [y] [z]) TRUE produces {x:1 y:2 z:{green blue}} if connected to a function body

Now the interesting part. if name: is reintroduced then it can nowe be seen as context not labels
i.e. the labels for the data coming out of the match are in the [] the context of how to align the pattern with the value being passed in is in the name: contexts. 

data?([things/(?<id>\d+)/])

data?(b:[x] a:1 *) TRUE produces {x:2} if connected to a function body
data?(a:[x] c:([a] [b]) ) TRUE produces {x:1 a:green b:blue} if connected to a function body



steps to refactor
1. call our current boxes Atoms with syntax @counter@ behave as they do today
2. leave _ as is
3. swap out n:_ for [n]
4. swap out n:* for *[n]
5. allow n: as contextual for name based descructuring

approach to runtime steps...
1. Reorder content of the input to align with any name context in the pattern  i.e. no longer pure positional matching if the name contexcts in the pattern can't be matched up to names in the params don't match then it's a FALSE
2. Align the non named remaining parts of the pattern to the remaining non mapped items in the params back to ORDER only for what remains. NOTE the params may have been re-ordered by step 1 that may be strange but the user needs to heal with it. they can do pure order base if they want so that's fine. 
2. Check any literals and deeper contexts for a match of shape (with named context) if the literals in the pattern don't batch the param values then it's FALSE
3. If a match populate output with new labels from [n]
NOTE: all placeholders across the pattern, regardless of depth, must be unique and are presented as a flat map.

6. make it clear that the () of a template are representative of the shape of templates
7. allow nested templates (which essentially means tested context in the pattern)

#### Assuming we loose the : requirment in patterns...