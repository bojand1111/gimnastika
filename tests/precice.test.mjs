import test from 'node:test';
import assert from 'node:assert/strict';
import { radnja } from '../src/precice.js';

const ev = (key, extra = {}, tagName = 'BODY') => ({ key, altKey: false, ctrlKey: false, target: { tagName, isContentEditable: false }, ...extra });

test('F2 i F4 van polja', () => {
  assert.equal(radnja(ev('F2')), 'unos');
  assert.equal(radnja(ev('F4')), 'rang');
});

test('F2 i F4 rade i u poljima', () => {
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA']) {
    assert.equal(radnja(ev('F2', {}, tag)), 'unos');
    assert.equal(radnja(ev('F4', {}, tag)), 'rang');
  }
  assert.equal(radnja({ ...ev('F2'), target: { tagName: 'DIV', isContentEditable: true } }), 'unos');
});

test('obicna slova u poljima ne okidaju precice', () => {
  assert.equal(radnja(ev('n', {}, 'INPUT')), null);
  assert.equal(radnja(ev('F8', {}, 'INPUT')), null);
  assert.equal(radnja(ev('F9', {}, 'INPUT')), null);
});

test('Alt+N i Esc rade i u poljima', () => {
  assert.equal(radnja(ev('n', { altKey: true }, 'INPUT')), 'novi');
  assert.equal(radnja(ev('N', { altKey: true })), 'novi');
  assert.equal(radnja(ev('Escape', {}, 'INPUT')), 'otkazi');
  assert.equal(radnja(ev('Escape')), 'otkazi');
});

test('Ctrl+P i Ctrl+S', () => {
  assert.equal(radnja(ev('p', { ctrlKey: true })), 'stampa');
  assert.equal(radnja(ev('s', { ctrlKey: true })), 'kopija');
});

test('obicna slova i prazna meta', () => {
  assert.equal(radnja(ev('a')), null);
  assert.equal(radnja(ev('n')), null);
  assert.equal(radnja(ev('p')), null);
  assert.equal(radnja({ key: 'F2', altKey: false, ctrlKey: false, target: null }), 'unos');
});

test('Alt+M i Alt+Z biraju deo aplikacije, i u poljima', () => {
  assert.equal(radnja(ev('m', { altKey: true })), 'pol-m');
  assert.equal(radnja(ev('Z', { altKey: true })), 'pol-z');
  assert.equal(radnja(ev('m', { altKey: true }, 'INPUT')), 'pol-m');
  assert.equal(radnja(ev('z', { altKey: true }, 'TEXTAREA')), 'pol-z');
});

test('M i Z bez Alt, i AltGr (Ctrl+Alt), ne biraju deo', () => {
  assert.equal(radnja(ev('m')), null);
  assert.equal(radnja(ev('z', {}, 'INPUT')), null);
  assert.equal(radnja(ev('m', { altKey: true, ctrlKey: true })), null);
  assert.equal(radnja(ev('z', { altKey: true, ctrlKey: true })), null);
});
