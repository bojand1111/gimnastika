import test from 'node:test';
import assert from 'node:assert/strict';
import { velicinaPrikaz } from '../electron/racun/velicina.mjs';

test('velicinaPrikaz: vrednosti iz POPIS 7.1', () => {
  assert.equal(velicinaPrikaz(147), '147 B');
  assert.equal(velicinaPrikaz(1024), '1 KB');
  assert.equal(velicinaPrikaz(39695), '39 KB');
  // POPIS 7.1 navodi 1536000 => "1.500 KB", ali PHP (>= 1048576 je MB) i vrednost 1048576 daju MB; PHP pravilo vazi
  assert.equal(velicinaPrikaz(1536000), '1,5 MB');
  assert.equal(velicinaPrikaz(1023 * 1024), '1.023 KB');
  assert.equal(velicinaPrikaz(1048576), '1,0 MB');
  assert.equal(velicinaPrikaz(2516582), '2,4 MB');
});

test('velicinaPrikaz: rubovi', () => {
  assert.equal(velicinaPrikaz(0), '0 B');
  assert.equal(velicinaPrikaz(1023), '1023 B');
  assert.equal(velicinaPrikaz(1048575), '1.024 KB');
  assert.equal(velicinaPrikaz(1500 * 1048576), '1.500,0 MB');
  assert.equal(velicinaPrikaz(null), '0 B');
});
