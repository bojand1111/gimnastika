import test from 'node:test';
import assert from 'node:assert/strict';
import { pocetno, sledece } from '../electron/updater-stanje.mjs';

test('pocetno stanje je idle', () => {
  assert.deepEqual(pocetno('0.1.0'), { stanje: 'idle', trenutna: '0.1.0', poruka: '' });
});

test('available nosi verziju', () => {
  assert.deepEqual(sledece(pocetno('0.1.0'), { tip: 'available', verzija: '0.2.0' }),
    { stanje: 'available', verzija: '0.2.0', trenutna: '0.1.0', poruka: '' });
});

test('checking, progress 40, downloaded daje ready sa verzijom', () => {
  let s = pocetno('0.1.0');
  s = sledece(s, { tip: 'checking' });
  assert.equal(s.stanje, 'checking');
  s = sledece(s, { tip: 'available', verzija: '0.2.0' });
  s = sledece(s, { tip: 'progress', procenat: 40 });
  assert.equal(s.stanje, 'downloading');
  assert.equal(s.procenat, 40);
  s = sledece(s, { tip: 'downloaded', verzija: '0.2.0' });
  assert.equal(s.stanje, 'ready');
  assert.equal(s.verzija, '0.2.0');
  assert.equal(s.trenutna, '0.1.0');
});

test('none daje none', () => {
  assert.equal(sledece(pocetno('0.1.0'), { tip: 'none' }).stanje, 'none');
});

test('mrezna greska daje idle sa porukom', () => {
  for (const poruka of ['net::ERR_INTERNET_DISCONNECTED', 'getaddrinfo ENOTFOUND github.com', 'connect ECONNREFUSED', 'ETIMEDOUT', 'read ECONNRESET', 'getaddrinfo EAI_AGAIN github.com', 'Request timed out', 'connect ENETUNREACH', 'connect EHOSTUNREACH']) {
    assert.deepEqual(sledece(pocetno('0.1.0'), { tip: 'error', poruka }),
      { stanje: 'idle', trenutna: '0.1.0', poruka: 'Nema veze sa internetom.' });
  }
});

test('druga greska daje error sa opstom porukom na srpskom', () => {
  const s = sledece(pocetno('0.1.0'), { tip: 'error', poruka: 'sha512 checksum mismatch' });
  assert.equal(s.stanje, 'error');
  assert.equal(s.poruka, 'Ažuriranje nije uspelo. Pogledajte dnevnik.log.');
});

test('Request timed out i ECONNRESET daju idle bez veze', () => {
  for (const poruka of ['Request timed out', 'read ECONNRESET']) {
    assert.deepEqual(sledece(pocetno('0.1.0'), { tip: 'error', poruka }),
      { stanje: 'idle', trenutna: '0.1.0', poruka: 'Nema veze sa internetom.' });
  }
});

test('cifre 404 unutar hasha nisu nepostojeci release', () => {
  const s = sledece(pocetno('0.1.0'), { tip: 'error', poruka: 'sha512 mismatch, expected abc404def' });
  assert.equal(s.stanje, 'error');
});

test('nepostojeci release (404, latest.yml) daje none sa porukom', () => {
  for (const poruka of ['Cannot find latest.yml in the latest release artifacts', 'HTTP 404 Not Found', '404 Not Found method: GET url: https://github.com/x/y/releases.atom', 'HttpError: 404', 'status 404', 'No published versions on GitHub']) {
    const s = sledece(pocetno('0.1.0'), { tip: 'error', poruka });
    assert.equal(s.stanje, 'none');
    assert.equal(s.poruka, 'Nema objavljenih verzija.');
  }
});
