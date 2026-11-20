// Standard library (spec section 11). Data is always the LAST argument and
// the function (if any) the first, so partial application gives pipeline
// stages (HOF-1). Library functions never throw and never mutate (LIB-3, LIB-5):
// a non-number is treated as 0, a number as a word.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import {
  NONE, TRUE, FALSE, mkWord, mkGroup, mkBool, mkNamed, itemsOf, unwrapNamed,
  isNone, isTrue, equals, toNum, numWord, isNumericText,
} from './values.js';
import { fmt, textOf } from './format.js';

const INF = Infinity;
const list = [];
const def = (name, min, max, fn) => list.push({ name, min, max, fn });

const textFrom = (items) => items.map((x) => textOf(unwrapNamed(x))).join(' ');
const dataOf = (items, from) => {
  const rest = items.slice(from);
  return rest.length === 1 ? itemsOf(rest[0]) : rest;
};
const mapText = (v, f) => {
  if (v.kind === 'Word') return mkWord(f(v.text ?? fmt(v)));
  if (v.kind === 'Group') return mkGroup(v.items.map((x) => mapText(x, f)));
  if (v.kind === 'Named') return { ...v, value: mapText(v.value, f) };
  return v;
};
const wholeThing = (items) => mkGroup(items);
const cmpValues = (a, b) => {
  const x = textOf(unwrapNamed(a)), y = textOf(unwrapNamed(b));
  if (isNumericText(x) && isNumericText(y)) return Number(x) - Number(y);
  return x < y ? -1 : x > y ? 1 : 0;
};

// Maths
def('+', 2, INF, (a) => numWord(a.reduce((s, x) => s + toNum(x), 0)));
def('-', 2, 2, (a) => numWord(toNum(a[0]) - toNum(a[1])));
def('*', 2, INF, (a) => numWord(a.reduce((s, x) => s * toNum(x), 1)));
def('\\', 2, 2, (a) => (toNum(a[1]) === 0 ? NONE : numWord(toNum(a[0]) / toNum(a[1]))));
def('mod', 2, 2, (a) => (toNum(a[1]) === 0 ? NONE : numWord(toNum(a[0]) % toNum(a[1]))));
def('pow', 2, 2, (a) => numWord(toNum(a[0]) ** toNum(a[1])));
def('sqrt', 1, 1, (a) => numWord(Math.sqrt(toNum(a[0]))));
def('abs', 1, 1, (a) => numWord(Math.abs(toNum(a[0]))));
def('neg', 1, 1, (a) => numWord(-toNum(a[0])));
def('floor', 1, 1, (a) => numWord(Math.floor(toNum(a[0]))));
def('ceil', 1, 1, (a) => numWord(Math.ceil(toNum(a[0]))));
def('round', 1, 1, (a) => numWord(Math.round(toNum(a[0]))));
def('min', 2, INF, (a) => numWord(Math.min(...a.map(toNum))));
def('max', 2, INF, (a) => numWord(Math.max(...a.map(toNum))));
def('sum', 0, INF, (a) => numWord(a.reduce((s, x) => s + toNum(x), 0)));
def('rand', 2, 2, (a) => numWord(toNum(a[0]) + Math.random() * (toNum(a[1]) - toNum(a[0]))));

// Comparison
const allEqual = (a) => a.every((x) => equals(unwrapNamed(a[0]), unwrapNamed(x)));
def('=', 2, INF, (a) => mkBool(allEqual(a)));
def('~=', 2, INF, (a) => mkBool(!allEqual(a)));
def('lt', 2, 2, (a) => mkBool(cmpValues(a[0], a[1]) < 0));
def('gt', 2, 2, (a) => mkBool(cmpValues(a[0], a[1]) > 0));
def('lte', 2, 2, (a) => mkBool(cmpValues(a[0], a[1]) <= 0));
def('gte', 2, 2, (a) => mkBool(cmpValues(a[0], a[1]) >= 0));

// Logic
def('~', 1, INF, (a) => mkBool(!a.every((x) => isTrue(unwrapNamed(x)))));
def('&', 2, INF, (a) => mkBool(a.every((x) => isTrue(unwrapNamed(x)))));
def('^', 2, INF, (a) => mkBool(a.some((x) => isTrue(unwrapNamed(x)))));
def('xor', 2, 2, (a) => mkBool(isTrue(unwrapNamed(a[0])) !== isTrue(unwrapNamed(a[1]))));

// Type checks
def('isnum', 1, 1, (a) => mkBool(isNumericText(textOf(unwrapNamed(a[0])))));
def('istext', 1, 1, (a) => {
  const x = unwrapNamed(a[0]);
  return mkBool(x.kind === 'Word' && !isNumericText(textOf(x)));
});
def('isempty', 0, INF, (a) => mkBool(a.length === 0));
def('isfn', 1, 1, (a) => mkBool(['Fn', 'Builtin', 'Partial', 'PipeFn'].includes(a[0].kind)));
def('num', 1, 1, (a) => {
  const t = textOf(unwrapNamed(a[0]));
  return isNumericText(t) ? mkWord(String(Number(t))) : NONE;
});

// Text
def('upper', 0, INF, (a) => mapText(wholeThing(a), (s) => s.toUpperCase()));
def('lower', 0, INF, (a) => mapText(wholeThing(a), (s) => s.toLowerCase()));
def('trim', 0, INF, (a) => mapText(wholeThing(a), (s) => s.trim()));
def('length', 0, INF, (a) => numWord(textFrom(a).length));
def('chars', 0, INF, (a) => mkGroup([...textFrom(a)].filter((c) => !/\s/.test(c)).map(mkWord)));
def('split', 2, INF, (a) => {
  const sep = textOf(a[0]);
  return mkGroup(textFrom(a.slice(1)).split(sep).filter((x) => x !== '').map(mkWord));
});
def('cat', 0, INF, (a) => mkWord(a.flatMap((x) => itemsOf(x)).map((x) => textOf(unwrapNamed(x))).join('')));
def('space', 0, 0, () => mkWord(' '));
def('join', 2, INF, (a) => mkWord(dataOf(a, 1).map((x) => textOf(unwrapNamed(x))).join(textOf(a[0]))));
def('replace', 3, INF, (a) => mkWord(textFrom(a.slice(2)).split(textOf(a[0])).join(textOf(a[1]))));
def('sub', 3, INF, (a) => {
  const t = textFrom(a.slice(2));
  return mkWord(t.slice(Math.max(toNum(a[0]) - 1, 0), toNum(a[1])));
});
def('startsWith', 2, INF, (a) => mkBool(textFrom(a.slice(1)).startsWith(textOf(a[0]))));
def('endsWith', 2, INF, (a) => mkBool(textFrom(a.slice(1)).endsWith(textOf(a[0]))));
def('repeat', 2, INF, (a) => mkWord(textFrom(a.slice(1)).repeat(Math.max(0, Math.floor(toNum(a[0]))))));
def('pad', 3, INF, (a) => mkWord(textFrom(a.slice(2)).padStart(Math.max(0, toNum(a[0])), textOf(a[1]) || ' ')));

// Collections
def('count', 0, INF, (a) => numWord(a.length));
def('first', 0, INF, (a) => a[0] ?? NONE);
def('last', 0, INF, (a) => a[a.length - 1] ?? NONE);
def('rev', 0, INF, (a) => mkGroup([...a].reverse()));
def('sort', 0, INF, (a) => mkGroup([...a].sort(cmpValues)));
def('unique', 0, INF, (a) => mkGroup(a.filter((x, i) => a.findIndex((y) => equals(x, y)) === i)));
def('contains', 2, INF, (a) => mkBool(dataOf(a, 1).some((x) => equals(unwrapNamed(a[0]), unwrapNamed(x)))));
def('push', 1, INF, (a) => mkGroup(a.flatMap(itemsOf)));
def('pop', 0, INF, (a) => mkGroup(a.slice(0, -1)));
def('shift', 0, INF, (a) => mkGroup(a.slice(1)));
def('unshift', 1, INF, (a) => mkGroup([a[0], ...a.slice(1).flatMap(itemsOf)]));
def('take', 1, INF, (a) => mkGroup(dataOf(a, 1).slice(0, Math.max(toNum(a[0]), 0))));
def('drop', 1, INF, (a) => mkGroup(dataOf(a, 1).slice(Math.max(toNum(a[0]), 0))));
def('remove', 1, INF, (a) => mkGroup(dataOf(a, 1).filter((_, i) => i !== toNum(a[0]) - 1)));
def('concat', 2, INF, (a) => mkGroup(a.flatMap(itemsOf)));
def('slice', 3, INF, (a) => {
  const d = dataOf(a, 2);
  return mkGroup(d.slice(Math.max(toNum(a[0]) - 1, 0), toNum(a[1])));
});
def('range', 2, 2, (a) => {
  const from = toNum(a[0]), to = toNum(a[1]);
  const out = [];
  const step = from <= to ? 1 : -1;
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) out.push(mkWord(String(i)));
  return mkGroup(out);
});
def('zip', 2, 2, (a) => {
  const x = itemsOf(a[0]), y = itemsOf(a[1]);
  const n = Math.min(x.length, y.length);
  return mkGroup(Array.from({ length: n }, (_, i) => ({ kind: 'Group', items: [x[i], y[i]] })));
});
def('flatten', 0, INF, (a) => mkGroup(a.flatMap(itemsOf)));

// Higher order: f first, data last (HOF-1)
const call = (ctx, f, x, i = 0) => (f.kind === 'Fn'
  ? ctx.callEach(f, x, x.kind === 'Named' ? x.value : x, x.kind === 'Named' ? mkWord(x.name) : NONE, numWord(i + 1))
  : ctx.callFn(f, x));
const hof = (name, min, fn) => def(name, min, INF, (a, ctx) => fn(a[0], dataOf(a, 1), ctx, a));
hof('map', 2, (f, d, c) => mkGroup(d.map((x, i) => call(c, f, x, i))));
hof('flatMap', 2, (f, d, c) => mkGroup(d.flatMap((x, i) => itemsOf(call(c, f, x, i)))));
hof('filter', 2, (f, d, c) => mkGroup(d.filter((x, i) => isTrue(call(c, f, x, i)))));
hof('find', 2, (f, d, c) => d.find((x, i) => isTrue(call(c, f, x, i))) ?? NONE);
hof('each', 2, (f, d, c) => { d.forEach((x, i) => call(c, f, x, i)); return mkGroup(d); });
hof('any', 2, (f, d, c) => mkBool(d.some((x, i) => isTrue(call(c, f, x, i)))));
hof('all', 2, (f, d, c) => mkBool(d.every((x, i) => isTrue(call(c, f, x, i)))));
hof('sortBy', 2, (f, d, c) => {
  const keyed = d.map((x, i) => ({ x, k: call(c, f, x, i) }));
  return mkGroup(keyed.sort((p, q) => cmpValues(p.k, q.k)).map((p) => p.x));
});
hof('partition', 2, (f, d, c) => {
  const yes = [], no = [];
  d.forEach((x, i) => (isTrue(call(c, f, x, i)) ? yes : no).push(x));
  return { kind: 'Group', items: [mkGroup(yes), mkGroup(no)] };
});
def('reduce', 3, INF, (a, c) => {
  let acc = a[1];
  for (const x of dataOf(a, 2)) acc = call(c, a[0], { kind: 'Group', items: [acc, x] });
  return acc;
});

// Input, output, files
def('print', 0, INF, (a, c) => { c.print(textFrom(a)); return NONE; });
def('read', 1, 1, (a) => { try { return mkWord(readFileSync(textOf(a[0]), 'utf8')); } catch { return NONE; } });
def('write', 2, INF, (a) => { try { writeFileSync(textOf(a[0]), textFrom(a.slice(1))); return TRUE; } catch { return NONE; } });
def('append', 2, INF, (a) => { try { appendFileSync(textOf(a[0]), textFrom(a.slice(1))); return TRUE; } catch { return NONE; } });
def('exists', 1, 1, (a) => mkBool(existsSync(textOf(a[0]))));

// Utility
def('assert', 1, INF, (a, c) => {
  if (isTrue(unwrapNamed(a[0]))) return TRUE;
  c.print(textFrom(a.slice(1)));
  return NONE;
});
def('serialize', 1, 1, (a) => mkWord(fmt(a[0])));
def('deserialize', 1, 1, (a, c) => c.evalSource(textOf(a[0])));
def('import', 1, 1, (a, c) => c.importFile(textOf(a[0])));

def('urldecode', 1, INF, (a) => {
  try { return mkWord(decodeURIComponent(textFrom(a).replace(/\+/g, ' '))); } catch { return NONE; }
});
def('urlencode', 1, INF, (a) => mkWord(encodeURIComponent(textFrom(a))));

// Named things
def('nameOf', 1, 1, (a) => (a[0].kind === 'Named' ? mkWord(a[0].name) : NONE));
def('valueOf', 1, 1, (a) => unwrapNamed(a[0]));
def('pick', 2, INF, (a) => {
  const hit = dataOf(a, 1).find((x) => x.kind === 'Named' && x.name === textOf(a[0]));
  return hit ? hit.value : NONE;
});
def('time', 0, 0, () => mkWord(String(Date.now())));
// Introspection: a function is data. Its pattern and body can be read
// without calling it.
def('patternOf', 1, 1, (a) => {
  const f = a[0];
  if (f.kind !== 'Fn') return NONE;
  const slotThing = (s) => {
    const t = s.type === 'lit' ? s.thing : mkWord(s.type === 'rest' ? '#' : '_');
    return s.label ? mkNamed(s.label, t) : t;
  };
  return mkGroup(f.pattern.left.map(slotThing));
});
// Consecutive items that are not named things are one run of text.
def('bodyOf', 1, 1, (a, c) => {
  if (a[0].kind !== 'Fn') return NONE;
  const out = [];
  let run = [];
  const flush = () => { if (run.length) out.push(mkWord(run.join(' '))); run = []; };
  for (const x of c.bodyItems(a[0]).flatMap((i) => (i.kind === 'Group' ? i.items : [i]))) {
    if (x.kind === 'Named') { flush(); out.push(x); } else run.push(textOf(x));
  }
  flush();
  return mkGroup(out);
});
def('isnamed', 1, 1, (a) => mkBool(a[0].kind === 'Named'));

// HTTP: `serve![port handler]`. The handler receives
// [method:.. url:.. headers:[..] body:..] and returns [status:.. headers:[..] body:..].
export const servers = [];
// Response things may nest (a handler's template can hold the result of
// another call), so look through nested groups.
const flat = (t) => itemsOf(t).flatMap((x) => (x.kind === 'Group' ? flat(x) : [x]));
const pick = (t, name) => flat(t).find((x) => x.kind === 'Named' && x.name === name)?.value;
// A urlencoded form body is parsed into named things so a handler can query body.note?
const formBody = (type, body) => {
  if (!/^application\/x-www-form-urlencoded/i.test(type ?? '') || !body) return mkWord(body);
  const dec = (s) => decodeURIComponent(s.replace(/\+/g, ' '));
  return mkGroup(body.split('&').filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? mkNamed(dec(p), NONE) : mkNamed(dec(p.slice(0, i)), mkWord(dec(p.slice(i + 1))));
  }));
};

def('serve', 2, 2, (a, c) => {
  const port = toNum(a[0]);
  const handler = a[1];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const headers = Object.entries(req.headers).map(([k, v]) => mkNamed(k, mkWord(String(v))));
      const reqThing = mkGroup([
        mkNamed('method', mkWord(req.method)),
        mkNamed('url', mkWord(req.url)),
        mkNamed('headers', mkGroup(headers)),
        mkNamed('body', formBody(req.headers['content-type'], body)),
      ]);
      let status = 200, outHeaders = {}, outBody = '';
      try {
        const r = c.callFn(handler, reqThing);
        const st = pick(r, 'status');
        if (st) status = toNum(st) || 200;
        for (const h of itemsOf(pick(r, 'headers') ?? NONE)) {
          if (h.kind === 'Named') outHeaders[h.name] = textOf(h.value);
        }
        const b = pick(r, 'body');
        if (b) outBody = textOf(b);
      } catch { status = 500; }
      res.writeHead(status, outHeaders);
      res.end(outBody);
    });
  });
  server.listen(port);
  servers.push(server);
  return TRUE;
});

export const builtins = list;
void FALSE; void isNone;
