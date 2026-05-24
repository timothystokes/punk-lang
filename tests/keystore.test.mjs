import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { punk } from './_punk.mjs';

function uniqueStoreBase() {
  return `tmp-keystore-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

test('serialize!/deserialize! round-trip a value', () => {
  assert.equal(
    punk('v:{note:"hello world" done:FALSE}  d:deserialize!serialize!v?  =!{serialize!v? serialize!d?}'),
    'TRUE',
  );
});

test('keystore open!/put!/get! returns immutable handles', () => {
  const base = uniqueStoreBase();
  const file = path.join(process.cwd(), `${base}.keystore`);
  try {
    const src = `
      ks:import!punk.keystore
      h0:ks.open!${base}
      h1:ks.put!{id-1 {note:"todo 1"} h0?}
      and!{
        =!{NULL ks.get!{id-1 h0?}}
        not!{=!{NULL ks.get!{id-1 h1?}}}
      }
    `;
    assert.equal(punk(src), 'TRUE');
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

test('keystore newKey! produces cuid2-shaped key', () => {
  assert.equal(
    punk('ks:import!punk.keystore  k:ks.newKey!  and!{=!{c k.1?} =!{24 k.#?}}'),
    'TRUE',
  );
});
