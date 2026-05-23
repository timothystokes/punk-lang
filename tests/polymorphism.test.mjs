// Polymorphism — composed from patterns, `??`, queries, and boxes.
//
// From doc § "Polymorphism":
//   - By arity: `??` on `args:*`.
//   - By shape: tag-style patterns in `??`.
//   - By value: literal slots.
//   - By regex: regex slots.
//   - Open dispatch: handler table in a box.
//   - Method-style: object-as-namespace; path query dispatches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('arity dispatch — one arg', () => {
  const src = `greet:(*[args]){
      args??{
        ([n]){Hello n?}
        ([n] [t]){Hello t? n?}
      }!
    }
    greet!Tim`;
  assert.equal(punk(src), '{{Hello Tim}}');
});

test('arity dispatch — two args', () => {
  const src = `greet:(*[args]){
      args??{
        ([n]){Hello n?}
        ([n] [t]){Hello t? n?}
      }!
    }
    greet!{Tim Dr\\.}`;
  assert.equal(punk(src), '{{Hello Dr\\. Tim}}');
});

test('shape dispatch — area of a rect', () => {
  const src = `area:(*[shape]){
      shape??{
        (circle [r]){X!{X!{3.141 r?} r?}}
        (rect [w] [h]){X!{w? h?}}
        (tri [b] [h]){/!{X!{b? h?} 2}}
      }!
    }
    area!{rect w:4 h:3}`;
  assert.equal(punk(src), '{{12}}');
});

test('shape dispatch — area of a circle', () => {
  const src = `area:(*[shape]){
      shape??{
        (circle [r]){X!{X!{3.141 r?} r?}}
        (rect [w] [h]){X!{w? h?}}
        (tri [b] [h]){/!{X!{b? h?} 2}}
      }!
    }
    area!{circle r:5}`;
  assert.equal(punk(src), '{{78.525}}');
});

test('value dispatch — literal slots', () => {
  const src = `route:([req]){
      req??{
        (method:GET path:\\/      *){home}
        (method:GET path:\\/about *){about}
        (*                         ){notFound}
      }!
    }
    route!{{method:GET path:\\/about extra:1}}`;
  assert.equal(punk(src), '{{about}}');
});

test('value dispatch — falls through to catch-all', () => {
  const src = `route:([req]){
      req??{
        (method:GET path:\\/      *){home}
        (method:GET path:\\/about *){about}
        (*                         ){notFound}
      }!
    }
    route!{{method:POST path:\\/x}}`;
  assert.equal(punk(src), '{{notFound}}');
});

test('regex dispatch — integer text', () => {
  const src = `classify:([s]){
      s??{
        ([n/^\\d+$/]         ){integer}
        ([h/^#[0-9a-f]{6}$/]){color}
        (_                 ){other}
      }!
    }
    classify!42`;
  assert.equal(punk(src), '{{integer}}');
});

test('regex dispatch — color text', () => {
  const src = `classify:([s]){
      s??{
        ([n/^\\d+$/]         ){integer}
        ([h/^#[0-9a-f]{6}$/]){color}
        (_                 ){other}
      }!
    }
    classify!"#aabbcc"`;
  assert.equal(punk(src), '{{color}}');
});

test('method-style dispatch — same call site, different object', () => {
  const src = `printer:{
      print:([msg]){upper!{msg?}}
    }
    silent-printer:{
      print:([msg]){}
    }
    log-it:([p] [m]){p?.print!{m?}}
    log-it!{printer hello}`;
  assert.equal(punk(src), '{{"HELLO"}}');
});
