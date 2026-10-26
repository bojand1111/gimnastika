import test from 'node:test';
import assert from 'node:assert/strict';
import { literal, razlozi, pretvori, preskociRed } from '../electron/racun/mysql-uvoz.mjs';
import { podeli } from '../electron/racun/sql-delilac.mjs';

test('literal: NULL, brojevi, stringovi sa escape-om', () => {
  assert.equal(literal('NULL'), null);
  assert.equal(literal('null'), null);
  assert.equal(literal('12'), 12);
  assert.equal(literal('-3'), -3);
  assert.equal(literal("'abc'"), 'abc');
  assert.equal(literal("'O\\'Brien'"), "O'Brien");
  assert.equal(literal("'O''Brien'"), "O'Brien");
  assert.equal(literal("'a\\\\b'"), 'a\\b');
  assert.equal(literal("'red1\\nred2\\r\\t\\0\\Z'"), 'red1\nred2\r\t\0\x1a');
  assert.equal(literal("'\\\"x\\\"'"), '"x"');
  assert.equal(literal("'\\%\\_'"), '\\%\\_');
  assert.equal(literal("'Đurđevak, šuma; čežnja'"), 'Đurđevak, šuma; čežnja');
  assert.equal(literal("''"), '');
});

test('literal: nepoznat izraz baca', () => {
  assert.throws(() => literal('NOW()'), /Nepoznat SQL izraz/);
});

test('razlozi: primer iz POPIS 4 (vise redova, zarez i zagrada u stringu)', () => {
  const n = 'INSERT INTO `ocene` (`id`, `prijava_id`, `d`, `konacna`, `status`, `uneto_u`) VALUES\n' +
    "(1, 1, '4.200', '12.900', 'uneto', '2026-10-01 18:44:06'),\n" +
    "(2, 1, NULL, NULL, 'na (x), y', NULL)";
  const r = razlozi(n);
  assert.equal(r.tabela, 'ocene');
  assert.deepEqual(r.kolone, ['id', 'prijava_id', 'd', 'konacna', 'status', 'uneto_u']);
  assert.deepEqual(r.redovi[0], [1, 1, '4.200', '12.900', 'uneto', '2026-10-01 18:44:06']);
  assert.deepEqual(r.redovi[1], [2, 1, null, null, 'na (x), y', null]);
});

test('razlozi: apostrof kao \\\' u nazivu kluba, posle podeli', () => {
  const sql = "INSERT INTO `klubovi` (`id`, `puno_ime`) VALUES\n(1, 'Klub \\'Soko\\'; Novi Sad'),\n(2, 'B\\\\C');\nSET FOREIGN_KEY_CHECKS=1;";
  const nar = podeli(sql);
  assert.equal(nar.length, 2);
  const r = razlozi(nar[0]);
  assert.deepEqual(r.redovi, [[1, "Klub 'Soko'; Novi Sad"], [2, 'B\\C']]);
  assert.equal(razlozi(nar[1]), null);
});

test('razlozi: sve sto nije INSERT daje null; los red baca', () => {
  assert.equal(razlozi('DROP TABLE IF EXISTS `x`'), null);
  assert.equal(razlozi('CREATE TABLE `x` (`a` int)'), null);
  assert.throws(() => razlozi('INSERT INTO `t` (`a`, `b`) VALUES (1)'), /Broj vrednosti/);
  assert.throws(() => razlozi("INSERT INTO `t` (`a`) VALUES ('abc"), /Nezavrsen/);
});

test('pretvori: decimale u hiljadite, grbovi u prazan tekst, ostalo ostaje', () => {
  assert.equal(pretvori('ocene', 'konacna', '12.900'), 12900);
  assert.equal(pretvori('ocene', 'd', '4.200'), 4200);
  assert.equal(pretvori('ocene', 'odbitak', '0.000'), 0);
  assert.equal(pretvori('ocene', 'e', '8.7'), 8700);
  assert.equal(pretvori('ocene', 'e', 12), 12000);
  assert.equal(pretvori('ocene', 'e', null), null);
  assert.equal(pretvori('ocene_e', 'vrednost', '8.250'), 8250);
  assert.equal(pretvori('ocene', 'status', 'uneto'), 'uneto');
  assert.equal(pretvori('ocene', 'broj_ispravki', 2), 2);
  assert.equal(pretvori('takmicenja', 'grb_levo', 'grb/x.png'), '');
  assert.equal(pretvori('takmicenja', 'grb_desno', 'grb/y.png'), '');
  assert.equal(pretvori('takmicenja', 'naziv', 'Kup'), 'Kup');
  assert.equal(pretvori('izmene_ocena', 'staro', '{"konacna":"12.900"}'), '{"konacna":"12.900"}');
});

test('preskociRed: kljucevi podesavanja koji su putanje', () => {
  const k = ['kljuc', 'vrednost'];
  assert.equal(preskociRed('podesavanja', k, ['kopije_fascikla', 'E:\\x']), true);
  assert.equal(preskociRed('podesavanja', k, ['grb_levo', 'a']), true);
  assert.equal(preskociRed('podesavanja', k, ['grb_desno', 'a']), true);
  assert.equal(preskociRed('podesavanja', k, ['aktivno_takmicenje', '1']), false);
  assert.equal(preskociRed('klubovi', ['kljuc'], ['grb_levo']), false);
});
