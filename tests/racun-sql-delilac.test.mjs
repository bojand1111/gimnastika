import test from 'node:test';
import assert from 'node:assert/strict';
import { podeli } from '../electron/racun/sql-delilac.mjs';

test('podeli: osnovne naredbe i prazan ostatak', () => {
  assert.deepEqual(podeli('SELECT 1; SELECT 2;\n'), ['SELECT 1', 'SELECT 2']);
  assert.deepEqual(podeli(''), []);
  assert.deepEqual(podeli('  ;; ;'), []);
  assert.deepEqual(podeli('SELECT 1'), ['SELECT 1']);
});

test('podeli: tacka-zarez u stringu sa backslash escape-om i dupliranim navodnikom', () => {
  const sql = "INSERT INTO t VALUES ('a\\'b;c', 'd''e;f'); SELECT 2;";
  assert.deepEqual(podeli(sql), ["INSERT INTO t VALUES ('a\\'b;c', 'd''e;f')", 'SELECT 2']);
});

test('podeli: dvostruki navodnik i backtick', () => {
  assert.deepEqual(podeli('SELECT "a;b", `c;d`; SELECT 2'), ['SELECT "a;b", `c;d`', 'SELECT 2']);
  // backslash u backtick nazivu nije escape
  assert.deepEqual(podeli('SELECT `a\\`; SELECT 2'), ['SELECT `a\\`', 'SELECT 2']);
});

test('podeli: komentari se odbacuju, ali ne unutar stringova', () => {
  const sql = "-- zaglavlje; sa tackom\nSET NAMES utf8mb4; # drugi; komentar\n/* blok; */ SELECT '-- nije; komentar'; -- kraj";
  assert.deepEqual(podeli(sql), ['SET NAMES utf8mb4', "SELECT '-- nije; komentar'"]);
});

test('podeli: "--" bez razmaka nije komentar', () => {
  assert.deepEqual(podeli('SELECT 5--3; SELECT 1'), ['SELECT 5--3', 'SELECT 1']);
});

test('podeli: nezavrsen string ili blok komentar ne baca', () => {
  assert.deepEqual(podeli("SELECT 'abc; def"), ["SELECT 'abc; def"]);
  assert.deepEqual(podeli('SELECT 1; /* nezavrsen; SELECT 2'), ['SELECT 1']);
});
