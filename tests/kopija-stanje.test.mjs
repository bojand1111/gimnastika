import test from 'node:test';
import assert from 'node:assert/strict';
import { vrstaTekst, potvrdaTekst, porukaNapravljena, fasciklaOpis, prikaziPodrazumevanu } from '../src/ekrani/kopijaStanje.js';

const VRSTE = { rucna: 'Ručna', pre_vracanja: 'Pre vraćanja', uvoz: 'Uvezena' };

test('vrstaTekst: poznata vrsta, nepoznata vrsta i fajl bez opisa', () => {
  assert.equal(vrstaTekst({ vrsta: 'rucna' }, VRSTE), 'Ručna');
  assert.equal(vrstaTekst({ vrsta: 'nesto' }, VRSTE), 'nesto');
  assert.equal(vrstaTekst(null, VRSTE), null);
  assert.equal(vrstaTekst(undefined, VRSTE), null);
});

test('potvrdaTekst: sa imenom i bez imena', () => {
  assert.equal(potvrdaTekst('kopija_2026-10-26_1405.sqlite'),
    'Vratiti podatke iz kopija_2026-10-26_1405.sqlite? Svi trenutni podaci se zamenjuju (pre toga se pravi kopija trenutnog stanja).');
  assert.equal(potvrdaTekst(),
    'Vratiti podatke iz izabranog fajla? Svi trenutni podaci se zamenjuju (pre toga se pravi kopija trenutnog stanja).');
  assert.equal(potvrdaTekst(''), potvrdaTekst());
});

test('porukaNapravljena: ime i velicina', () => {
  assert.equal(porukaNapravljena({ ime: 'k.sqlite', velicinaTekst: '39 KB' }), 'Rezervna kopija je napravljena: k.sqlite (39 KB).');
});

test('fasciklaOpis: podrazumevana, izabrana i nedostupna', () => {
  assert.deepEqual(fasciklaOpis({ putanja: 'C:\k', podrazumevana: true, izabrana: '', nedostupna: false }),
    { naslov: 'Fascikla za kopije (podrazumevana)', napomena: '' });
  assert.deepEqual(fasciklaOpis({ putanja: 'E:\k', podrazumevana: false, izabrana: 'E:\k', nedostupna: false }),
    { naslov: 'Fascikla za kopije', napomena: '' });
  assert.deepEqual(fasciklaOpis({ putanja: 'C:\k', podrazumevana: true, izabrana: 'E:\k', nedostupna: true }),
    { naslov: 'Fascikla za kopije (podrazumevana)', napomena: 'Izabrana fascikla E:\k nije dostupna.' });
});

test('prikaziPodrazumevanu: samo kad nije podrazumevana ili je izabrana nedostupna', () => {
  assert.equal(prikaziPodrazumevanu({ podrazumevana: true, izabrana: '' }), false);
  assert.equal(prikaziPodrazumevanu({ podrazumevana: false, izabrana: 'E:\k' }), true);
  assert.equal(prikaziPodrazumevanu({ podrazumevana: true, izabrana: 'E:\k' }), true);
});
