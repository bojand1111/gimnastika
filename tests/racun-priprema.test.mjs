import test from 'node:test';
import assert from 'node:assert/strict';
import { ucesce, poljaUcesca, stanje } from '../electron/racun/priprema.mjs';

test('priprema: ucesce', () => {
  assert.equal(ucesce(0, 0), 'pojedinac');
  assert.equal(ucesce(true, false), 'ekipa');
  assert.equal(ucesce(1, 0), 'ekipa');
  assert.equal(ucesce(0, 1), 'vk');
  assert.equal(ucesce(1, 1), 'vk', 'stari red sa oba polja se prikazuje kao VK, kao sto ga racuna ekipni zbir');
  assert.deepEqual(poljaUcesca('ekipa'), { clan_ekipe: 1, van_konkurencije: 0 });
  assert.deepEqual(poljaUcesca('pojedinac'), { clan_ekipe: 0, van_konkurencije: 0 });
  assert.deepEqual(poljaUcesca('vk'), { clan_ekipe: 0, van_konkurencije: 1 });
  for (const u of ['ekipa', 'pojedinac', 'vk']) {
    const p = poljaUcesca(u);
    assert.equal(ucesce(p.clan_ekipe, p.van_konkurencije), u, 'tamo i nazad');
  }
  assert.throws(() => poljaUcesca('nesto'), { message: 'Nepoznato učešće: nesto' });
});

test('priprema: stanje', () => {
  const p = (klub, kat = 1, prog = 1, sprava = 4, grupa = true) =>
    ({ klub_id: klub, kategorija_id: kat, program_id: prog, broj_sprava: sprava, u_grupi: grupa });

  let s = stanje([], []);
  assert.equal(s.korak, 'prijave', 'bez prijava prvi korak su prijave');
  assert.equal(s.prijava, 0);
  assert.deepEqual(s.klubovi, {});

  s = stanje([p(1), p(1, null), p(2, 1, 1, 0), p(2, 1, null, 4, false)], [1]);
  assert.equal(s.prijava, 4);
  assert.equal(s.nepotpune, 3, 'bez kategorije, bez sprava, bez programa');
  assert.equal(s.nerasporedjeni, 1);
  assert.equal(s.korak, 'prijave', 'nepotpune prijave imaju prednost nad rotacijama');
  assert.equal(s.nepotvrdjeni_klubovi, 1);
  assert.deepEqual(s.klubovi[1], { prijava: 2, nepotpune: 1, nerasporedjeni: 0, potvrdjeno: true });
  assert.deepEqual(s.klubovi[2], { prijava: 2, nepotpune: 2, nerasporedjeni: 1, potvrdjeno: false });

  s = stanje([p(1), p(2, 1, 1, 4, false)], []);
  assert.equal(s.korak, 'rotacije');
  assert.equal(s.nepotvrdjeni_klubovi, 2);

  s = stanje([p(1), p(2)], []);
  assert.equal(s.korak, 'spremno', 'nepotvrdjen spisak ne zaustavlja pripremu, samo se prikazuje');

  // Prijave bez kluba idu pod kljuc 0 i ne broje se u nepotvrdjene klubove
  s = stanje([p(null), p(3)], [3]);
  assert.equal(s.nepotvrdjeni_klubovi, 0);
  assert.equal(s.klubovi[0].potvrdjeno, false);
  assert.equal(s.klubovi[0].prijava, 1);
  // Potvrda kluba koji nema prijave se ne racuna
  assert.equal(stanje([p(4)], [9]).nepotvrdjeni_klubovi, 1);
});
