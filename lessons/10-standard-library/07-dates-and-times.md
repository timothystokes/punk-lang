# Dates and times

`time` takes no things and gives milliseconds since 1970-01-01 UTC. Punk has no calendar functions, so a date has to be calculated from that number.

```punk
isnum![time!]
```
**`TRUE`**

```punk
[3600000] > map!(ms:_)[\![ms? 60000]]
```
**`60`**
