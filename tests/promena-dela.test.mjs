import test from 'node:test';
import assert from 'node:assert/strict';
import { napraviPromenu, pripremiPromenu } from '../src/promenaDela.js';

test('pripremiPromenu ceka obecanja ekrana', async () => {
  const meta = new EventTarget();
  let gotovo = false;
  meta.addEventListener('app:pre-pol', (ev) => ev.detail.cekaj.push(new Promise((r) => setTimeout(() => { gotovo = true; r(); }, 20))));
  await pripremiPromenu(meta);
  assert.equal(gotovo, true);
});

test('pripremiPromenu radi i bez slusalaca', async () => {
  await pripremiPromenu(new EventTarget());
});

test('promena: pripremi se zavrsava pre postavi', async () => {
  const redosled = [];
  const promeni = napraviPromenu({
    trenutni: () => 'M',
    pripremi: async () => { await new Promise((r) => setTimeout(r, 10)); redosled.push('pripremi'); },
    postavi: async (n) => { redosled.push('postavi'); return n; },
  });
  assert.equal(await promeni('Z'), 'Z');
  assert.deepEqual(redosled, ['pripremi', 'postavi']);
});

test('promena na isti deo ne radi nista', async () => {
  let pozivi = 0;
  const promeni = napraviPromenu({ trenutni: () => 'M', pripremi: async () => { pozivi++; }, postavi: async (n) => { pozivi++; return n; } });
  assert.equal(await promeni('M'), null);
  assert.equal(pozivi, 0);
});

test('drugi pritisak za vreme promene se ignorise, posle se opet radi', async () => {
  let deo = 'M';
  let postavljeno = 0;
  const promeni = napraviPromenu({
    trenutni: () => deo,
    pripremi: () => new Promise((r) => setTimeout(r, 10)),
    postavi: async (n) => { postavljeno++; deo = n; return n; },
  });
  const [a, b, c] = await Promise.all([promeni('Z'), promeni('M'), promeni('Z')]);
  assert.deepEqual([a, b, c], ['Z', null, null]);
  assert.equal(postavljeno, 1);
  assert.equal(await promeni('M'), 'M');
});

test('ako postavi pukne, greska ide dalje, deo ostaje i moze opet', async () => {
  let deo = 'M';
  let pada = true;
  const promeni = napraviPromenu({
    trenutni: () => deo,
    pripremi: async () => {},
    postavi: async (n) => { if (pada) throw new Error('puklo'); deo = n; return n; },
  });
  await assert.rejects(() => promeni('Z'), /puklo/);
  assert.equal(deo, 'M');
  pada = false;
  assert.equal(await promeni('Z'), 'Z');
});

test('ako pripremi pukne, postavi se ne zove', async () => {
  let postavljeno = false;
  const promeni = napraviPromenu({
    trenutni: () => 'M',
    pripremi: async () => { throw new Error('nije snimljeno'); },
    postavi: async (n) => { postavljeno = true; return n; },
  });
  await assert.rejects(() => promeni('Z'), /nije snimljeno/);
  assert.equal(postavljeno, false);
});
