const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori, Baza } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi } = require('../electron/modeli/klubovi.cjs');
const { poImenu, istiTekst, KOLATOR } = require('../electron/modeli/sortiranje.cjs');

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return { baza, klubovi: napravi(baza) };
}

test('sortiranje: istiTekst ignorise velika/mala, razlikuje c/č/ć', () => {
  assert.equal(istiTekst('bgd', ' BGD '), true);
  assert.equal(istiTekst('c', 'č'), false);
  assert.equal(istiTekst('č', 'Č'), true);
  assert.equal(KOLATOR.compare('Cvetković', 'Ćirić') < 0, true);
});

test('sortiranje: poImenu je stabilno i ne menja ulaz', () => {
  const ulaz = [{ id: 2, a: 'x' }, { id: 1, a: 'X' }, { id: 3, a: 'a' }];
  const izlaz = poImenu(ulaz, 'a');
  assert.deepEqual(izlaz.map(r => r.id), [3, 1, 2]);
  assert.deepEqual(ulaz.map(r => r.id), [2, 1, 3]);
});

test('sacuvaj novi klub vraca id, skracenica velikim slovima', () => {
  const { baza, klubovi } = nova();
  const id = klubovi.sacuvaj({ puno_ime: 'GK „Beograd“', skracenica: 'bgd', grad: 'Beograd' }, null);
  const k = klubovi.nadji(id);
  assert.equal(k.skracenica, 'BGD');
  assert.equal(k.puno_ime, 'GK „Beograd“');
  assert.match(k.kreirano, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(k.izmenjeno, k.kreirano);
  assert.equal(klubovi.nadji(999), null);
  baza.zatvori();
});

test('proveri: poruke doslovno', () => {
  const { baza, klubovi } = nova();
  assert.deepEqual(klubovi.proveri({ puno_ime: '', skracenica: 'B', grad: '' }, null),
    ['Puno ime kluba je obavezno.', 'Skraćenica mora imati 2 do 4 slova.']);
  assert.deepEqual(klubovi.proveri({ puno_ime: 'A', skracenica: 'ABCDE', grad: '' }, null),
    ['Skraćenica mora imati 2 do 4 slova.']);
  assert.deepEqual(klubovi.proveri({ puno_ime: 'A', skracenica: 'A1', grad: '' }, null),
    ['Skraćenica mora imati 2 do 4 slova.']);
  klubovi.sacuvaj({ puno_ime: 'Prvi', skracenica: 'BGD', grad: '' }, null);
  assert.deepEqual(klubovi.proveri({ puno_ime: 'Drugi', skracenica: 'Bgd', grad: '' }, null),
    ['Skraćenica "BGD" je već zauzeta.']);
  baza.zatvori();
});

test('proveri: izmena istog kluba sa svojom skracenicom prolazi, ČĆŽ prolazi, c i č su razlicita', () => {
  const { baza, klubovi } = nova();
  const id = klubovi.sacuvaj({ puno_ime: 'Prvi', skracenica: 'ČĆŽ', grad: '' }, null);
  assert.equal(klubovi.nadji(id).skracenica, 'ČĆŽ');
  assert.deepEqual(klubovi.proveri({ puno_ime: 'Prvi', skracenica: 'ččž', grad: '' }, id), []);
  assert.deepEqual(klubovi.proveri({ puno_ime: 'Drugi', skracenica: 'CĆŽ', grad: '' }, null), []);
  assert.deepEqual(klubovi.proveri({ puno_ime: 'Drugi', skracenica: 'čćž', grad: '' }, null),
    ['Skraćenica "ČĆŽ" je već zauzeta.']);
  baza.zatvori();
});

test('sacuvaj izmena menja red, cuva kreirano; greska baca GreskaKorisnika', () => {
  const { baza, klubovi } = nova();
  const id = klubovi.sacuvaj({ puno_ime: 'Prvi', skracenica: 'PRV', grad: 'A' }, null);
  baza.izmeni('klubovi', { kreirano: '2020-01-01 00:00:00' }, 'id = ?', [id]);
  assert.equal(klubovi.sacuvaj({ puno_ime: ' Novo ', skracenica: 'prv', grad: ' B ' }, id), id);
  const k = klubovi.nadji(id);
  assert.equal(k.puno_ime, 'Novo');
  assert.equal(k.grad, 'B');
  assert.equal(k.kreirano, '2020-01-01 00:00:00');
  assert.notEqual(k.izmenjeno, '2020-01-01 00:00:00');
  assert.throws(() => klubovi.sacuvaj({ puno_ime: '', skracenica: 'B', grad: '' }, null), e => {
    assert.ok(e instanceof GreskaKorisnika);
    assert.equal(e.message, 'Puno ime kluba je obavezno. Skraćenica mora imati 2 do 4 slova.');
    return true;
  });
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM klubovi'), 1);
  baza.zatvori();
});

test('svi: sortirano po puno_ime kolatorom, sa broj_takmicara', () => {
  const { baza, klubovi } = nova();
  const imena = ['Šimić', 'Simić', 'Cvetković', 'Ćirić', 'Đorđević', 'Dragić'];
  const ids = imena.map((ime, i) => klubovi.sacuvaj({ puno_ime: ime, skracenica: 'KL' + 'ABCDEF'[i], grad: '' }, null));
  const sad = Baza.sad();
  baza.ubaci('takmicari', { id_broj: 'T1', ime: 'A', prezime: 'B', godina_rodjenja: 2012, pol: 'M', klub_id: ids[2], kreirano: sad, izmenjeno: sad });
  const svi = klubovi.svi();
  assert.deepEqual(svi.map(k => k.puno_ime), ['Cvetković', 'Ćirić', 'Dragić', 'Đorđević', 'Simić', 'Šimić']);
  assert.deepEqual(svi.map(k => k.broj_takmicara), [1, 0, 0, 0, 0, 0]);
  baza.zatvori();
});

test('obrisi: takmicari, pa prijave, inace brise', () => {
  const { baza, klubovi } = nova();
  const sad = Baza.sad();
  const a = klubovi.sacuvaj({ puno_ime: 'A klub', skracenica: 'AAA', grad: '' }, null);
  const b = klubovi.sacuvaj({ puno_ime: 'B klub', skracenica: 'BBB', grad: '' }, null);
  const c = klubovi.sacuvaj({ puno_ime: 'C klub', skracenica: 'CCC', grad: '' }, null);
  const t1 = baza.ubaci('takmicari', { id_broj: 'T1', ime: 'A', prezime: 'B', godina_rodjenja: 2012, pol: 'M', klub_id: a, kreirano: sad, izmenjeno: sad });
  const t2 = baza.ubaci('takmicari', { id_broj: 'T2', ime: 'C', prezime: 'D', godina_rodjenja: 2012, pol: 'Z', klub_id: c, kreirano: sad, izmenjeno: sad });
  const tm = baza.ubaci('takmicenja', { naziv: 'Kup', datum: '2026-11-01', kreirano: sad, izmenjeno: sad });
  baza.ubaci('prijave', { takmicenje_id: tm, takmicar_id: t2, klub_id: b, kreirano: sad, izmenjeno: sad });
  assert.throws(() => klubovi.obrisi(a), e => e instanceof GreskaKorisnika &&
    e.message === 'Klub ima 1 takmičara u bazi i ne može se obrisati. Prvo premestite ili obrišite takmičare.');
  assert.throws(() => klubovi.obrisi(b), e => e instanceof GreskaKorisnika &&
    e.message === 'Klub ima 1 prijava na takmičenjima i ne može se obrisati.');
  baza.izvrsi('DELETE FROM prijave');
  klubovi.obrisi(b);
  assert.equal(klubovi.nadji(b), null);
  assert.equal(t1 > 0, true);
  baza.zatvori();
});
