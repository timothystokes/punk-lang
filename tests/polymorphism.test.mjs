// Polymorphism — composed from patterns, `??`, queries, and boxes.
//
// From doc § "Polymorphism":
//   - By arity: `??` on `args:___`.
//   - By shape: tag-style patterns in `??`.
//   - By value: literal slots.
//   - By regex: regex slots.
//   - Open dispatch: handler table in a box.
//   - Method-style: object-as-namespace; path query dispatches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('arity dispatch — one arg', () => {
  const src = `greet:(args:___){
      args??{
        (n:_)    {Hello n?}
        (n:_ t:_){Hello t? n?}
      }
    }
    greet!Tim`;
  assert.equal(punk(src), '{Hello Tim}');
});

test('arity dispatch — two args', () => {
  const src = `greet:(args:___){
      args??{
        (n:_)    {Hello n?}
        (n:_ t:_){Hello t? n?}
      }
    }
    greet!{Tim Dr.}`;
  assert.equal(punk(src), '{Hello Dr. Tim}');
});

test('shape dispatch — area of a rect', () => {
  const src = `area:(shape:_){
      shape??{
        (circle r:_  ){*!{*!{3.141 r?} r?}}
        (rect w:_ h:_){*!{w? h?}}
        (tri b:_ h:_ ){/!{*!{b? h?} 2}}
      }
    }
    area!{rect w:4 h:3}`;
  assert.equal(punk(src), '{12}');
});

test('shape dispatch — area of a circle', () => {
  const src = `area:(shape:_){
      shape??{
        (circle r:_  ){*!{*!{3.141 r?} r?}}
        (rect w:_ h:_){*!{w? h?}}
        (tri b:_ h:_ ){/!{*!{b? h?} 2}}
      }
    }
    area!{circle r:5}`;
  assert.equal(punk(src), '{78.525}');
});

test('value dispatch — literal slots', () => {
  const src = `route:(req:_){
      req??{
        (method:GET path:/      ___){home}
        (method:GET path:/about ___){about}
        (___                       ){notFound}
      }
    }
    route!{method:GET path:/about extra:1}`;
  assert.equal(punk(src), '{about}');
});

test('value dispatch — falls through to catch-all', () => {
  const src = `route:(req:_){
      req??{
        (method:GET path:/      ___){home}
        (method:GET path:/about ___){about}
        (___                       ){notFound}
      }
    }
    route!{method:POST path:/x}`;
  assert.equal(punk(src), '{notFound}');
});

test('regex dispatch — integer text', () => {
  const src = `classify:(s:_){
      s??{
        (n:/^\\d+$/         ){integer}
        (h:/^#[0-9a-f]{6}$/){color}
        (_                 ){other}
      }
    }
    classify!42`;
  assert.equal(punk(src), '{integer}');
});

test('regex dispatch — color text', () => {
  const src = `classify:(s:_){
      s??{
        (n:/^\\d+$/         ){integer}
        (h:/^#[0-9a-f]{6}$/){color}
        (_                 ){other}
      }
    }
    classify!#aabbcc`;
  assert.equal(punk(src), '{color}');
});

test('method-style dispatch — same call site, different object', () => {
  const src = `printer:{
      print:(msg:_){upper!msg?}
    }
    silent-printer:{
      print:(msg:_){}
    }
    log-it:(p:_ m:_){p.print!{m?}}
    log-it!{printer hello}`;
  assert.equal(punk(src), '"HELLO"');
});
