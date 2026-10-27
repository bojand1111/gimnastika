// Rezervna kopija (SQLite). Kopija je jedan .sqlite fajl (VACUUM INTO) sa tabelom kopija_opis; PHP zip kopije
// se prikazuju i uvoze u novu bazu. Pravila su u docs/superpowers/specs/2026-10-26-faza-7-popis-php.md, odeljci 3, 4 i 6.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { otvori } = require('../baza/baza.cjs');
const { pocetniPodaci } = require('../baza/seme.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const zip = require('../uvoz/zip.cjs');
const { podeli } = require('../racun/sql-delilac.mjs');
const { razlozi, pretvori, preskociRed, PRESKOCENE_TABELE } = require('../racun/mysql-uvoz.mjs');

const VRSTE = {
  rucna: 'Ručna',
  pre_vracanja: 'Pre vraćanja',
  pre_azuriranja: 'Pre ažuriranja',
  pre_migracije: 'Pre migracije',
  uvoz: 'Uvezena',
};
// Najnovija PHP verzija iz koje se kopija uvozi (POPIS 4).
const NAJNOVIJA_PHP = '1.2.0';
const GRB_OBLIK = new RegExp('^grb/[A-Za-z0-9_-][A-Za-z0-9_.-]*$');
const grbOk = (v) => GRB_OBLIK.test(String(v ?? '')) && !String(v).includes('..');
const OPIS_KLJUCEVI = ['aplikacija', 'verzija', 'baza_verzija', 'vreme', 'vrsta'];

// Poredjenje a.b.c brojno (1.10.0 > 1.9.0); prazno ili nebrojno se racuna kao 0.
function uporediVerzije(a, b) {
  const delovi = (v) => String(v ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const x = delovi(a);
  const y = delovi(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function dvaMesta(n) {
  return String(n).padStart(2, '0');
}

// Lokalno vreme: {datum: 'GGGG-MM-DD', sat: 'HHMM', puno: 'GGGG-MM-DD HH:MM:SS'}
function lokalnoVreme(d = new Date()) {
  const datum = `${d.getFullYear()}-${dvaMesta(d.getMonth() + 1)}-${dvaMesta(d.getDate())}`;
  const sat = `${dvaMesta(d.getHours())}${dvaMesta(d.getMinutes())}`;
  return { datum, sat, puno: `${datum} ${dvaMesta(d.getHours())}:${dvaMesta(d.getMinutes())}:${dvaMesta(d.getSeconds())}` };
}

function brisi(p) {
  fs.rmSync(p, { force: true });
}

function brisiSaPratecim(p) {
  brisi(p);
  brisi(`${p}-wal`);
  brisi(`${p}-shm`);
}

function bezZavrsnihKosih(p) {
  const t = String(p ?? '').trim().replace(/[\\/]+$/, '');
  return /^[A-Za-z]:$/.test(t) ? t + path.sep : t; // "E:" bez kose crte bi bio relativan
}

// Posle prekinutog vracanja (pad izmedju dva preimenovanja) nema zive baze, a postoji .staro: vrati ga.
// Cist fs, poziva se pre otvaranja baze. Vraca true kad je nesto vraceno.
function oporaviStaro(putanjaBaze) {
  const staro = `${putanjaBaze}.staro`;
  if (fs.existsSync(putanjaBaze) || !fs.existsSync(staro)) return false;
  brisi(`${putanjaBaze}-wal`);
  brisi(`${putanjaBaze}-shm`);
  fs.renameSync(staro, putanjaBaze);
  return true;
}

function napravi(baza, opcije) {
  const { fasciklaPodrazumevana, podesavanja, verzija, dnevnik } = opcije;
  const posleVracanja = opcije.posleVracanja ?? (() => { baza.migriraj(); pocetniPodaci(baza); });

  function fasciklaStanje() {
    const izabrana = bezZavrsnihKosih(podesavanja.daj('kopije_fascikla'));
    const postoji = izabrana !== '' && fs.existsSync(izabrana) && fs.statSync(izabrana).isDirectory();
    // Izabrana fascikla koja ne postoji (USB izvucen, baza sa drugog racunara) se zaobilazi, kao u PHP-u.
    return {
      putanja: postoji ? izabrana : fasciklaPodrazumevana,
      podrazumevana: !postoji,
      izabrana,
      nedostupna: izabrana !== '' && !postoji,
    };
  }

  function fascikla() {
    return fasciklaStanje().putanja;
  }

  function bazaVerzija() {
    if (!baza.tabele().includes('migracije')) return '';
    return baza.vrednost('SELECT MAX(ime) FROM migracije') ?? '';
  }

  function napraviFasciklu(f) {
    try {
      fs.mkdirSync(f, { recursive: true });
    } catch (err) {
      throw new GreskaKorisnika(`Ne mogu da napravim fasciklu ${f}`, { cause: err });
    }
  }

  // Ime koje jos ne postoji: kopija_GGGG-MM-DD_HHMM.sqlite, pa _2, _3...
  function slobodnoIme(f, vreme) {
    const osnova = `kopija_${vreme.datum}_${vreme.sat}`;
    let ime = `${osnova}.sqlite`;
    for (let n = 2; fs.existsSync(path.join(f, ime)); n++) ime = `${osnova}_${n}.sqlite`;
    return ime;
  }

  // vrsta: kljuc iz VRSTE. Vraca {putanja, ime, velicina}.
  function napraviKopiju(vrsta = 'rucna') {
    if (!Object.hasOwn(VRSTE, vrsta)) throw new Error(`Nepoznata vrsta kopije: ${vrsta}`);
    const f = fascikla();
    napraviFasciklu(f);
    const vreme = lokalnoVreme();
    const ime = slobodnoIme(f, vreme);
    const cilj = path.join(f, ime);
    const privremeno = `${cilj}.tmp`; // lista() ga ne vidi dok kopija nije cela
    brisi(privremeno);
    try {
      baza.db.prepare('VACUUM INTO ?').run(privremeno);
      const kopija = new DatabaseSync(privremeno);
      try {
        kopija.exec('PRAGMA journal_mode = DELETE');
        kopija.exec('DROP TABLE IF EXISTS kopija_opis'); // ziva baza moze da ga nosi iz ranijeg vracanja
        kopija.exec('CREATE TABLE kopija_opis (kljuc TEXT PRIMARY KEY, vrednost TEXT)');
        const upis = kopija.prepare('INSERT INTO kopija_opis (kljuc, vrednost) VALUES (?, ?)');
        const opis = {
          aplikacija: 'gimnastika', verzija, baza_verzija: bazaVerzija(), vreme: vreme.puno, vrsta,
        };
        for (const k of OPIS_KLJUCEVI) upis.run(k, String(opis[k]));
      } finally {
        kopija.close();
      }
      fs.renameSync(privremeno, cilj);
    } catch (err) {
      brisiSaPratecim(privremeno);
      if (err instanceof GreskaKorisnika) throw err;
      throw new GreskaKorisnika(`Kopija nije napravljena: ${err.message}`, { cause: err });
    }
    return { putanja: cilj, ime, velicina: fs.statSync(cilj).size };
  }

  const NIJE_KOPIJA = 'Fajl nije rezervna kopija ove aplikacije';

  function opisSqlite(putanja) {
    let db;
    try {
      db = new DatabaseSync(putanja, { readOnly: true });
      const tabela = db.prepare("SELECT 1 AS ima FROM sqlite_master WHERE type = 'table' AND name = 'kopija_opis'").get();
      if (!tabela) throw new GreskaKorisnika(`${NIJE_KOPIJA} (nedostaje kopija_opis).`);
      const o = Object.fromEntries(db.prepare('SELECT kljuc, vrednost FROM kopija_opis').all().map((r) => [r.kljuc, r.vrednost]));
      if (o.aplikacija !== 'gimnastika') throw new GreskaKorisnika('Opis kopije nije ispravan.');
      return {
        verzija: String(o.verzija ?? ''), baza_verzija: String(o.baza_verzija ?? ''),
        vreme: String(o.vreme ?? ''), vrsta: String(o.vrsta ?? ''), format: 'sqlite',
      };
    } catch (err) {
      if (err instanceof GreskaKorisnika) throw err;
      throw new GreskaKorisnika(`${NIJE_KOPIJA} (${err.message}).`, { cause: err });
    } finally {
      if (db) db.close();
    }
  }

  function opisZip(putanja) {
    let spisak;
    try {
      spisak = zip.lista(putanja);
    } catch (err) {
      throw new GreskaKorisnika(err.message, { cause: err });
    }
    if (!spisak['opis.json'] || !spisak['baza.sql']) {
      throw new GreskaKorisnika(`${NIJE_KOPIJA} (nedostaje opis.json ili baza.sql).`);
    }
    let o;
    try {
      o = JSON.parse(zip.procitaj(putanja, 'opis.json', spisak).toString('utf8'));
    } catch {
      throw new GreskaKorisnika('Opis kopije nije ispravan.');
    }
    if (!o || typeof o !== 'object' || o.aplikacija !== 'gimnastika') throw new GreskaKorisnika('Opis kopije nije ispravan.');
    return {
      verzija: String(o.verzija ?? ''), baza_verzija: parseInt(o.baza_verzija, 10) || 0,
      vreme: String(o.vreme ?? ''), vrsta: String(o.vrsta ?? ''), format: 'zip',
    };
  }

  // Baca GreskaKorisnika kad fajl nije ispravna kopija.
  function opis(putanja) {
    return path.extname(putanja).toLowerCase() === '.zip' ? opisZip(putanja) : opisSqlite(putanja);
  }

  function lista() {
    const f = fascikla();
    let imena;
    try {
      imena = fs.readdirSync(f);
    } catch {
      return []; // fascikla jos ne postoji: nema kopija
    }
    const redovi = [];
    for (const ime of imena) {
      if (!/\.(sqlite|zip)$/i.test(ime)) continue;
      const p = path.join(f, ime);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue; // nestao izmedju citanja fascikle i provere
      }
      if (!st.isFile()) continue;
      let o = null;
      try {
        o = opis(p);
      } catch {
        o = null; // "neispravan fajl" u listi, ostali fajlovi se prikazuju
      }
      redovi.push({ putanja: p, ime, velicina: st.size, vreme: Math.round(st.mtimeMs), opis: o, _mt: st.mtimeMs });
    }
    redovi.sort((a, b) => (b._mt - a._mt) || (a.ime < b.ime ? 1 : -1));
    return redovi.map(({ _mt, ...r }) => r);
  }

  function putanjaImena(ime) {
    if (!/^[A-Za-z0-9_.-]+\.(sqlite|zip)$/i.test(String(ime)) || String(ime).includes('..')) {
      throw new GreskaKorisnika('Nevažeće ime fajla.');
    }
    const p = path.join(fascikla(), ime);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new GreskaKorisnika(`Fajl ne postoji: ${ime}`);
    return p;
  }

  function proveriVerziju(o) {
    const granica = o.format === 'zip' ? NAJNOVIJA_PHP : verzija;
    if (uporediVerzije(o.verzija, granica) <= 0) return;
    if (o.format === 'zip') {
      throw new GreskaKorisnika(`Kopija je iz novije verzije PHP aplikacije (${o.verzija}) nego što može da se uveze (najviše ${NAJNOVIJA_PHP}).`);
    }
    throw new GreskaKorisnika(`Kopija je iz novije verzije aplikacije (${o.verzija}) nego što je instalirana (${verzija}). Prvo ažurirajte aplikaciju.`);
  }

  // Zamena fajla baze pripremljenim fajlom. Ziva baza se zatvara pre svake izmene fajlova (Windows),
  // staro stanje se cuva pored dok se ne potvrdi da novo radi; sigurnosna je poslednja odbrana.
  // Vec postojeci .staro (ostatak prekinutog vracanja) se nikad ne brise, nego dobija vremenski sufiks.
  function zameni(pripremljen, sigurnosnaPutanja) {
    const cilj = baza.putanja;
    const staro = `${cilj}.staro`;
    baza.zatvori(); // zatvaranje poslednje veze upisuje WAL u glavni fajl
    let odneto = false; // cilj je preimenovan u staro
    try {
      const wal = `${cilj}-wal`;
      if (fs.existsSync(wal) && fs.statSync(wal).size > 0) {
        // zatvaranje nije upisalo WAL u fajl: neko drugi drzi bazu
        throw new GreskaKorisnika('Baza je zauzeta u drugom programu. Zatvorite ga i pokušajte ponovo.');
      }
      brisi(wal);
      brisi(`${cilj}-shm`);
      if (fs.existsSync(staro)) {
        try {
          fs.renameSync(staro, `${staro}.${Date.now()}`);
        } catch (err) {
          throw new GreskaKorisnika(`Ne mogu da sačuvam raniji fajl ${path.basename(staro)}.`, { cause: err });
        }
      }
      fs.renameSync(cilj, staro);
      odneto = true;
      fs.renameSync(pripremljen, cilj);
      baza.otvoriPonovo(cilj);
      baza.vrednost('SELECT COUNT(*) FROM sqlite_master');
    } catch (err) {
      dnevnik.greska('Vracanje: zamena baze nije uspela, vraca se prethodno stanje', err);
      try {
        baza.zatvori();
        if (odneto) {
          brisiSaPratecim(cilj);
          if (fs.existsSync(staro)) fs.renameSync(staro, cilj);
          else fs.copyFileSync(sigurnosnaPutanja, cilj);
        }
        baza.otvoriPonovo(cilj);
      } catch (err2) {
        dnevnik.greska('Vracanje: ni povratak na prethodno stanje nije uspeo', err2);
        throw new GreskaKorisnika(`Baza nije otvorena. Prethodno stanje je u fajlu ${path.basename(sigurnosnaPutanja)}.`, { cause: err2 });
      }
      throw err;
    }
    brisiSaPratecim(staro); // samo ono sto je napravljeno u ovom prolazu
  }

  // Ceo tok: provera verzije, priprema i provera izvora (bez izmene zive baze i bez sigurnosne kopije),
  // pa sigurnosna kopija, zamena i migracije.
  function izvrsiVracanje(putanja, o, pripremi) {
    proveriVerziju(o);
    if (!baza.putanja || baza.putanja === ':memory:') throw new GreskaKorisnika('Baza nije u fajlu, pa se ne može vratiti.');
    const pripremljen = `${baza.putanja}.${o.format === 'zip' ? 'uvoz' : 'vracanje'}`;
    brisiSaPratecim(pripremljen);
    let dodatak;
    let sigurnosna;
    try {
      dodatak = pripremi(pripremljen);
      sigurnosna = napraviKopiju('pre_vracanja');
      zameni(pripremljen, sigurnosna.putanja);
    } finally {
      brisiSaPratecim(pripremljen);
    }
    try {
      posleVracanja();
    } catch (err) {
      dnevnik.greska('Vracanje: migracije posle zamene nisu uspele', err);
      throw new GreskaKorisnika(`Vraćanje nije dovršeno: ${err.message}. Stanje pre vraćanja je u fajlu ${sigurnosna.ime}.`, { cause: err });
    }
    return { ime: path.basename(putanja), opis: o, sigurnosna: sigurnosna.ime, uvoz: o.format === 'zip', ...dodatak };
  }

  // SQLite kopija se NE koristi kao baza: podaci se prepisuju u svezu bazu (migracije, bez okidaca i pogleda),
  // pa se ona proverava i zamenjuje. Nepoznate tabele, okidaci i pogledi iz kopije tako ne prelaze.
  const MESNI_KLJUCEVI = ['kopije_fascikla', 'grb_levo', 'grb_desno'];

  function pripremiSqlite(izvor) {
    return (pripremljen) => {
      const fasciklaKopija = podesavanja.daj('kopije_fascikla');
      const kopijaFajl = `${pripremljen}.izvor`; // ATTACH ne sme da dira originalnu kopiju
      let nova = null;
      try {
        const ro = new DatabaseSync(izvor, { readOnly: true });
        try {
          const provera = ro.prepare('PRAGMA quick_check').all().map((r) => Object.values(r)[0]);
          if (provera.length !== 1 || provera[0] !== 'ok') throw new GreskaKorisnika('Kopija je oštećena.');
        } finally {
          ro.close();
        }
        fs.copyFileSync(izvor, kopijaFajl);
        nova = otvori(pripremljen);
        nova.migriraj();
        nova.db.exec('PRAGMA foreign_keys = OFF');
        nova.db.prepare('ATTACH DATABASE ? AS kopija').run(kopijaFajl);
        const tabele = nova.tabele().filter((t) => t !== 'migracije');
        nova.transakcija((b) => {
          for (const t of tabele) {
            const glavne = b.svi(`PRAGMA main.table_info("${t}")`).map((c) => c.name);
            const izKopije = new Set(b.svi(`PRAGMA kopija.table_info("${t}")`).map((c) => c.name));
            const kolone = glavne.filter((c) => izKopije.has(c)).map((c) => `"${c}"`).join(', ');
            if (!kolone) continue; // tabele nema u starijoj kopiji
            const uslov = t === 'podesavanja'
              ? ` WHERE kljuc NOT IN (${MESNI_KLJUCEVI.map((k) => `'${k}'`).join(', ')})` : '';
            b.db.exec(`INSERT INTO main."${t}" (${kolone}) SELECT ${kolone} FROM kopija."${t}"${uslov}`);
          }
          // Grbovi iz podesavanja prelaze samo ako su oblika grb/<ime>
          if (tabele.includes('podesavanja')) {
            const grb = b.svi("SELECT kljuc, vrednost FROM kopija.podesavanja WHERE kljuc IN ('grb_levo', 'grb_desno')");
            for (const r of grb) {
              if (r.vrednost !== '' && grbOk(r.vrednost)) b.izvrsi('INSERT INTO main.podesavanja (kljuc, vrednost) VALUES (?, ?)', [r.kljuc, r.vrednost]);
            }
          }
          // AUTOINCREMENT brojaci se prepisuju tacno kakvi su bili (i posle brisanja poslednjih redova);
          // INSERT ... SELECT je u svezoj bazi napravio nulte brojace i za prazne tabele, pa se prvo brisu.
          b.izvrsi('DELETE FROM main.sqlite_sequence');
          const imaSekvence = b.jedan("SELECT 1 AS ima FROM kopija.sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'");
          if (imaSekvence) {
            for (const r of b.svi("SELECT name, seq FROM kopija.sqlite_sequence WHERE typeof(seq) = 'integer' AND seq >= 0 AND seq < 9223372036854775807")) {
              if (tabele.includes(r.name)) b.izvrsi('INSERT INTO main.sqlite_sequence (name, seq) VALUES (?, ?)', [r.name, r.seq]);
            }
          }
        });
        nova.db.exec('DETACH DATABASE kopija');
        nova.db.prepare('INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost')
          .run('kopije_fascikla', fasciklaKopija);
        ocistiGrbove(nova.db);
        proveriOciscenje(nova.db, fasciklaKopija);
        nova.db.exec('PRAGMA foreign_keys = ON');
        if (nova.svi('PRAGMA foreign_key_check').length) throw new GreskaKorisnika('Kopija je oštećena.');
        const cela = nova.svi('PRAGMA integrity_check').map((r) => Object.values(r)[0]);
        if (cela.length !== 1 || cela[0] !== 'ok') throw new GreskaKorisnika('Kopija je oštećena.');
        nova.db.exec('PRAGMA journal_mode = DELETE');
      } catch (err) {
        if (err instanceof GreskaKorisnika) throw err;
        throw new GreskaKorisnika(`${NIJE_KOPIJA} (${err.message}).`, { cause: err });
      } finally {
        if (nova) nova.zatvori();
        brisi(kopijaFajl);
      }
    };
  }

  // Grb sme da pokazuje samo na grb/<ime> u fascikli podataka; sve drugo (apsolutna ili mrezna putanja) se prazni.
  function ocistiGrbove(db) {
    const kolone = db.prepare('PRAGMA table_info(takmicenja)').all().map((c) => c.name.toLowerCase());
    for (const kolona of ['grb_levo', 'grb_desno']) {
      if (kolone.includes(kolona)) {
        for (const r of db.prepare(`SELECT id, ${kolona} AS v FROM takmicenja WHERE ${kolona} <> ''`).all()) {
          if (!grbOk(r.v)) db.prepare(`UPDATE takmicenja SET ${kolona} = '' WHERE id = ?`).run(r.id);
        }
      }
      const p = db.prepare('SELECT vrednost FROM podesavanja WHERE kljuc = ?').get(kolona);
      if (p && p.vrednost !== '' && !grbOk(p.vrednost)) db.prepare("UPDATE podesavanja SET vrednost = '' WHERE kljuc = ?").run(kolona);
    }
  }

  // Ponovo cita ono sto je upisano; ne poklapanje znaci da nesto u fajlu menja podatke mimo nas.
  function proveriOciscenje(db, fasciklaKopija) {
    const f = db.prepare("SELECT vrednost FROM podesavanja WHERE kljuc = 'kopije_fascikla'").get();
    let ispravno = f && f.vrednost === fasciklaKopija;
    for (const r of db.prepare("SELECT vrednost FROM podesavanja WHERE kljuc IN ('grb_levo', 'grb_desno')").all()) {
      if (r.vrednost !== '' && !grbOk(r.vrednost)) ispravno = false;
    }
    const kolone = db.prepare('PRAGMA table_info(takmicenja)').all().map((c) => c.name.toLowerCase());
    for (const kolona of ['grb_levo', 'grb_desno']) {
      if (!kolone.includes(kolona)) continue;
      for (const r of db.prepare(`SELECT ${kolona} AS v FROM takmicenja WHERE ${kolona} <> ''`).all()) {
        if (!grbOk(r.v)) ispravno = false;
      }
    }
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('trigger', 'view')").get()) ispravno = false;
    if (!ispravno) throw new GreskaKorisnika('Kopija je oštećena.');
  }

  // PHP zip: INSERT naredbe iz baza.sql idu u novu bazu sa migracijama; vraca {redovi: {tabela: broj}}.
  function pripremiUvoz(zipPutanja) {
    return (pripremljen) => {
      const fasciklaKopija = podesavanja.daj('kopije_fascikla');
      let sql;
      try {
        sql = zip.procitaj(zipPutanja, 'baza.sql').toString('utf8');
      } catch (err) {
        throw new GreskaKorisnika(err.message, { cause: err });
      }
      const naredbe = podeli(sql);
      const nova = otvori(pripremljen);
      const redovi = {};
      try {
        nova.migriraj();
        const tabele = new Set(nova.tabele());
        nova.db.exec('PRAGMA foreign_keys = OFF'); // ne sme u transakciji, a redosled tabela u izvozu je abecedni
        nova.transakcija((b) => {
          naredbe.forEach((naredba, i) => {
            try {
              const r = razlozi(naredba);
              if (!r || PRESKOCENE_TABELE.includes(r.tabela) || !tabele.has(r.tabela)) return;
              const postojece = new Set(b.svi(`PRAGMA table_info(${r.tabela})`).map((c) => c.name.toLowerCase()));
              const nema = r.kolone.find((k) => !postojece.has(k));
              if (nema) throw new Error(`tabela ${r.tabela} nema kolonu ${nema}`);
              const upit = b.db.prepare(
                `INSERT INTO ${r.tabela} (${r.kolone.join(', ')}) VALUES (${r.kolone.map(() => '?').join(', ')})`);
              for (const red of r.redovi) {
                if (preskociRed(r.tabela, r.kolone, red)) continue;
                upit.run(...red.map((v, k) => pretvori(r.tabela, r.kolone[k], v)));
                redovi[r.tabela] = (redovi[r.tabela] ?? 0) + 1;
              }
            } catch (err) {
              throw new GreskaKorisnika(`Vraćanje prekinuto na naredbi ${i + 1} od ${naredbe.length}: ${err.message}`, { cause: err });
            }
          });
          // Pojas i naramenice: putanje sa drugog racunara se ne prenose ni ako je pravilo gore zaobidjeno.
          b.izvrsi("DELETE FROM podesavanja WHERE kljuc IN ('kopije_fascikla', 'grb_levo', 'grb_desno')");
          // izbor fascikle je ovog racunara: ostaje, da pre_vracanja kopija bude u istoj listi
          b.izvrsi('INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?)', ['kopije_fascikla', fasciklaKopija]);
          b.izvrsi("UPDATE takmicenja SET grb_levo = '', grb_desno = ''");
        });
        nova.db.exec('PRAGMA foreign_keys = ON');
        const loseVeze = nova.svi('PRAGMA foreign_key_check');
        if (loseVeze.length) {
          throw new GreskaKorisnika(`Uvoz prekinut: kopija ima veze ka podacima kojih nema (tabela ${loseVeze[0].table}).`);
        }
        nova.db.exec('PRAGMA journal_mode = DELETE');
      } finally {
        nova.zatvori();
      }
      return { redovi };
    };
  }

  function uveziPhpZip(zipPutanja) {
    const o = opisZip(zipPutanja);
    return izvrsiVracanje(zipPutanja, o, pripremiUvoz(zipPutanja));
  }

  // Vraca bazu iz kopije (.sqlite ili PHP .zip). Pozivalac prikazuje poruke POPIS 3.2.
  function vrati(putanja) {
    const o = opis(putanja);
    if (o.format === 'zip') return izvrsiVracanje(putanja, o, pripremiUvoz(putanja));
    return izvrsiVracanje(putanja, o, pripremiSqlite(putanja));
  }

  // nova: putanja ili '' (podrazumevana). Vraca poruku za korisnika.
  function postaviFasciklu(nova) {
    const f = bezZavrsnihKosih(nova);
    if (f === '') {
      podesavanja.postavi('kopije_fascikla', '');
      return 'Kopije se ponovo čuvaju u podrazumevanoj fascikli.';
    }
    try {
      fs.mkdirSync(f, { recursive: true });
      if (!fs.statSync(f).isDirectory()) throw new Error('nije fascikla');
    } catch (err) {
      throw new GreskaKorisnika(`Fascikla ne postoji i ne može da se napravi: ${f}`, { cause: err });
    }
    const proba = path.join(f, `.proba_${crypto.randomBytes(3).toString('hex')}`);
    try {
      fs.writeFileSync(proba, 'x');
      fs.rmSync(proba);
    } catch (err) {
      brisi(proba);
      throw new GreskaKorisnika(`U fasciklu ne može da se upisuje: ${f}`, { cause: err });
    }
    podesavanja.postavi('kopije_fascikla', f);
    return `Fascikla za kopije je promenjena: ${f}`;
  }

  return {
    VRSTE, fascikla, fasciklaStanje, napravi: napraviKopiju, opis, lista, putanja: putanjaImena, vrati, uveziPhpZip, postaviFasciklu,
  };
}

module.exports = { VRSTE, NAJNOVIJA_PHP, napravi, uporediVerzije, oporaviStaro };
