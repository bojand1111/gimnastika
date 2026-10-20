const test = require('node:test'), assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
test('verzija je iz package.json i semver', () => {
  const { verzija } = require('../electron/sistem.cjs');
  assert.equal(verzija(), require('../package.json').version);
  assert.match(verzija(), /^\d+\.\d+\.\d+$/);
});
test('fascikla podataka iz GIM_PODACI se pravi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-')); fs.rmSync(dir, { recursive: true });
  process.env.GIM_PODACI = dir;
  const p = require('../electron/putanje.cjs');
  assert.equal(p.fasciklaPodataka(), dir); assert.ok(fs.existsSync(dir));
  assert.equal(p.putanjaBaze(), path.join(dir, 'gimnastika.sqlite'));
  assert.equal(p.fasciklaKopija(), path.join(dir, 'kopije'));
});
