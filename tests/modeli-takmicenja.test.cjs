const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi } = require('../electron/modeli/takmicenja.cjs');

function nova(fascikla = os.tmpdir()) {
  const baza = otvori(':memory:');
  baza.migriraj();
  return { baza, t: napravi(baza, fascikla) };
}

const OK = { naziv: 'Kup', datum: '15.03.2027.', broj_e_sudija: '4', pravilo_e: 'odbaci_krajnje', ekipno_broji: '3' };
const S = '2026-01-01 00:00:00';
let brojac = 0;

// Prijava (+ opciono ocena sa datim statusom) za takmicenje.
function prijava(baza, tid, status) {
  brojac += 1;
  const kid = baza.ubaci('klubovi', { puno_ime: 'K' + brojac, skracenica: 'K' + brojac, kreirano: S, izmenjeno: S });
  const tak = baza.ubaci('takmicari', { id_broj: 'T' + brojac, ime: 'A', prezime: 'B', godina_rodjenja: 2010, pol: 'z', klub_id: kid, kreirano: S, izmenjeno: S });
  const sp = baza.ubaci('sprave', { pol: 'z', naziv: 'Preskok', skracenica: 'PR', kreirano: S, izmenjeno: S });
  const pid = baza.ubaci('prijave', { takmicenje_id: tid, takmicar_id: tak, klub_id: kid, kreirano: S, izmenjeno: S });
  if (status) baza.ubaci('ocene', { prijava_id: pid, sprava_id: sp, status, kreirano: S, izmenjeno: S });
  return { pid, kid };
}

test('prazno: podrazumevane vrednosti', () => {
  const { t } = nova();
  assert.deepEqual(t.prazno(), { naziv: '', datum: null, mesto: '', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
    ekipno_broji: 3, pomeraj_redosled: 0, zavrseno: 0, zaglavlje_biltena: '', organizator: '', domacin: '',
    grb_levo: '', grb_desno: '' });
  assert.equal(t.POLJA.length, 11);
  assert.deepEqual(t.GRBOVI, ['grb_levo', 'grb_desno']);
});

test('proveri prazno: svih 5 poruka tim redom', () => {
  const { t } = nova();
  assert.deepEqual(t.proveri({}, null), ['Naziv takmičenja je obavezan.', 'Datum je obavezan.',
    'Broj E sudija mora biti između 1 i 6.', 'Nepoznato pravilo za E ocenu.',
    'Broj ocena koje se broje za ekipu mora biti između 1 i 10.']);
});

test('proveri: neispravan datum, formati, opsezi', () => {
  const { t } = nova();
  assert.deepEqual(t.proveri({ ...OK, datum: '31.02.2027' }, null), ['Datum nije ispravan (dd.mm.gggg).']);
  for (const d of ['15.03.2027.', '15032027', '2027-03-15']) assert.deepEqual(t.proveri({ ...OK, datum: d }, null), []);
  for (const n of ['1', '6']) assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: n }, null), []);
  for (const n of ['0', '7']) assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: n }, null), ['Broj E sudija mora biti između 1 i 6.']);
  assert.deepEqual(t.proveri({ ...OK, ekipno_broji: '0' }, null), ['Broj ocena koje se broje za ekipu mora biti između 1 i 10.']);
  assert.equal(t.proveri({ ...OK, ekipno_broji: '11' }, null).length, 1);
  assert.deepEqual(t.proveri({ ...OK, pravilo_e: 'x' }, null), ['Nepoznato pravilo za E ocenu.']);
});

test('sacuvaj: vraca id, nadji ima podrazumevane, izmena vraca isti id', () => {
  const { t } = nova();
  const id = t.sacuvaj({ ...OK, ekstra: 'x' }, null);
  const r = t.nadji(id);
  assert.equal(r.naziv, 'Kup');
  assert.equal(r.datum, '2027-03-15');
  assert.equal(r.pomeraj_redosled, 0);
  assert.equal(r.zavrseno, 0);
  assert.equal(r.grb_levo, '');
  assert.equal(r.ekstra, undefined);
  assert.equal(t.sacuvaj({ ...OK, naziv: 'Drugo', zavrseno: '1', pomeraj_redosled: true }, id), id);
  const r2 = t.nadji(id);
  assert.equal(r2.naziv, 'Drugo');
  assert.equal(r2.zavrseno, 1);
  assert.equal(r2.pomeraj_redosled, 1);
  assert.equal(r2.kreirano, r.kreirano);
});

test('sacuvaj: baca GreskaKorisnika sa spojenim porukama', () => {
  const { t } = nova();
  assert.throws(() => t.sacuvaj({}, null),
    (e) => e instanceof GreskaKorisnika && e.message.startsWith('Naziv takmičenja je obavezan. Datum je obavezan.'));
});

test('broj E sudija: blokira uneto, ne blokira nacrt, ne blokira istu vrednost', () => {
  const { baza, t } = nova();
  const id = t.sacuvaj(OK, null);
  prijava(baza, id, 'nacrt');
  assert.equal(t.imaOcena(id), false);
  assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: '5' }, id), []);
  prijava(baza, id, 'uneto');
  assert.equal(t.imaOcena(id), true);
  assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: '5' }, id),
    ['Broj E sudija se ne može menjati kad takmičenje već ima unete ocene.']);
  assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: '4' }, id), []);
  assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: '9' }, id), ['Broj E sudija mora biti između 1 i 6.']);
  assert.deepEqual(t.proveri({ ...OK, broj_e_sudija: '5' }, null), []);
});

test('postaviGrb: nepoznato polje baca, prazno uklanja', () => {
  const { t } = nova();
  const id = t.sacuvaj(OK, null);
  assert.throws(() => t.postaviGrb(id, 'naziv', 'x'), /Nepoznato polje grba: naziv/);
  t.postaviGrb(id, 'grb_desno', 'grb/a.png');
  assert.equal(t.nadji(id).grb_desno, 'grb/a.png');
  t.postaviGrb(id, 'grb_desno', '');
  assert.equal(t.nadji(id).grb_desno, '');
});

test('sacuvajGrb: kopira, velika ekstenzija, ime po zigu, greske', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grb-'));
  try {
    const { t } = nova(dir);
    const id = t.sacuvaj(OK, null);
    const izvor = path.join(dir, 'slika.PNG');
    fs.writeFileSync(izvor, 'x');
    const v1 = t.sacuvajGrb(id, 'grb_levo', izvor);
    assert.match(v1, new RegExp(`^grb/takmicenje_${id}_levo_\\d{14}(_\\d+)?\\.png$`));
    assert.ok(fs.existsSync(path.join(dir, v1)));
    assert.equal(t.nadji(id).grb_levo, v1);
    const v2 = t.sacuvajGrb(id, 'grb_levo', izvor);
    assert.notEqual(v1, v2);
    assert.ok(fs.existsSync(path.join(dir, v2)));
    assert.match(t.sacuvajGrb(id, 'grb_desno', izvor), /_desno_/);
    const txt = path.join(dir, 'a.txt');
    fs.writeFileSync(txt, 'x');
    assert.throws(() => t.sacuvajGrb(id, 'grb_levo', txt), /Grb mora biti PNG, JPG, GIF ili SVG slika\./);
    assert.throws(() => t.sacuvajGrb(id, 'grb_levo', path.join(dir, 'nema.png')), /Izabrana slika više ne postoji\./);
    assert.throws(() => t.sacuvajGrb(id, 'naziv', izvor), /Nepoznato polje grba: naziv/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('obrisi: sa prijavom baca sa brojem, bez prijave brise i potvrde', () => {
  const { baza, t } = nova();
  const id = t.sacuvaj(OK, null);
  const { kid } = prijava(baza, id, null);
  assert.equal(t.brojPrijava(id), 1);
  assert.throws(() => t.obrisi(id),
    (e) => e instanceof GreskaKorisnika && e.message === 'Takmičenje ima 1 prijava i ne može se obrisati.');
  const id2 = t.sacuvaj(OK, null);
  baza.ubaci('potvrde_klubova', { takmicenje_id: id2, klub_id: kid, potvrdjeno: S });
  t.obrisi(id2);
  assert.equal(t.nadji(id2), null);
  assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM potvrde_klubova WHERE takmicenje_id = ?', [id2])), 0);
});

test('status: aktivno ima prednost, zavrseno, priprema', () => {
  const { t } = nova();
  assert.equal(t.status({ id: 1, zavrseno: 1 }, 1), 'aktivno');
  assert.equal(t.status({ id: 1, zavrseno: 1 }, 2), 'zavrseno');
  assert.equal(t.status({ id: 1, zavrseno: 0 }, null), 'priprema');
});

test('sva: datum opadajuce pa id, sa brojevima', () => {
  const { baza, t } = nova();
  const a = t.sacuvaj({ ...OK, datum: '2027-01-01' }, null);
  const b = t.sacuvaj({ ...OK, datum: '2027-05-01' }, null);
  const c = t.sacuvaj({ ...OK, datum: '2027-01-01' }, null);
  prijava(baza, a, 'uneto');
  prijava(baza, a, 'nacrt');
  const sva = t.sva();
  assert.deepEqual(sva.map(r => r.id), [b, c, a]);
  const ra = sva.find(r => r.id === a);
  assert.equal(ra.broj_prijava, 2);
  assert.equal(ra.broj_ocena, 1);
});
