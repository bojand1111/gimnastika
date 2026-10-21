// Tanak sloj nad node:sqlite (DatabaseSync). Imena metoda prate PHP klasu Baza.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const FASCIKLA_MIGRACIJA = path.join(__dirname, 'migracije');

class Baza {
  constructor(db) {
    this.db = db;
    this.uTransakciji = false;
  }

  // UTC, YYYY-MM-DD HH:MM:SS
  static sad() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  svi(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  jedan(sql, params = []) {
    return this.db.prepare(sql).get(...params) ?? null;
  }

  vrednost(sql, params = []) {
    const red = this.db.prepare(sql).get(...params);
    if (!red) return null;
    const kolone = Object.values(red);
    return kolone.length ? kolone[0] : null;
  }

  // Vraca broj izmenjenih redova.
  izvrsi(sql, params = []) {
    return Number(this.db.prepare(sql).run(...params).changes);
  }

  // Imena kolona dolaze iz koda (kljucevi objekta), vrednosti uvek kroz parametre.
  ubaci(tabela, podaci) {
    const kolone = Object.keys(podaci);
    const sql = `INSERT INTO ${tabela} (${kolone.join(', ')}) VALUES (${kolone.map(() => '?').join(', ')})`;
    return Number(this.db.prepare(sql).run(...Object.values(podaci)).lastInsertRowid);
  }

  izmeni(tabela, podaci, uslov, params = []) {
    const kolone = Object.keys(podaci);
    const sql = `UPDATE ${tabela} SET ${kolone.map((k) => `${k} = ?`).join(', ')} WHERE ${uslov}`;
    return Number(this.db.prepare(sql).run(...Object.values(podaci), ...params).changes);
  }

  // Jedan nivo; ugnjezdeni poziv samo izvrsi fn u okviru spoljne transakcije.
  transakcija(fn) {
    if (this.uTransakciji) return fn(this);
    this.db.exec('BEGIN');
    this.uTransakciji = true;
    try {
      const rezultat = fn(this);
      this.db.exec('COMMIT');
      return rezultat;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    } finally {
      this.uTransakciji = false;
    }
  }

  tabele() {
    return this.svi("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .map((r) => r.name);
  }

  _sveMigracije() {
    return fs.readdirSync(FASCIKLA_MIGRACIJA)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, -4))
      .sort();
  }

  naCekanju() {
    this.db.exec('CREATE TABLE IF NOT EXISTS migracije (ime TEXT PRIMARY KEY, primenjeno TEXT)');
    const primenjene = new Set(this.svi('SELECT ime FROM migracije').map((r) => r.ime));
    return this._sveMigracije().filter((ime) => !primenjene.has(ime));
  }

  // Svaka migracija ide u jednoj transakciji; vraca imena primenjenih.
  migriraj() {
    const primenjene = [];
    for (const ime of this.naCekanju()) {
      const sql = fs.readFileSync(path.join(FASCIKLA_MIGRACIJA, `${ime}.sql`), 'utf8');
      this.transakcija((b) => {
        b.db.exec(sql);
        b.ubaci('migracije', { ime, primenjeno: Baza.sad() });
      });
      primenjene.push(ime);
    }
    return primenjene;
  }

  zatvori() {
    this.db.close();
  }
}

function otvori(putanja) {
  const db = new DatabaseSync(putanja);
  if (putanja !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return new Baza(db);
}

module.exports = { otvori, Baza };
