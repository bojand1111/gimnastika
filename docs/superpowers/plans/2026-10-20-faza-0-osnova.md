# Faza 0: Osnova (Electron, SQLite, IPC, okvir ekrana, instaler, ažuriranje)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prazna, ali potpuna Electron aplikacija: prozor sa okvirom ekrana, SQLite baza sa migracijama, IPC sloj, instaler `Gimnastika-Setup-0.1.0.exe` i ažuriranje sa GitHub Releases, sve sa testovima.

**Architecture:** Main proces (CJS) drži bazu, modele i updater; renderer (React 19 + Vite 7) crta ekrane i zove `window.gim.<modul>.<radnja>()` iz preload-a. Čisti moduli (ruter, prečice, stanje updatera) su bez Electron zavisnosti i testiraju se sa `node --test`.

**Tech Stack:** Node 22, Electron 44, React 19, Vite 7, better-sqlite3, electron-builder (NSIS), electron-updater (github provider), node:test.

**Spec:** `docs/superpowers/specs/2026-10-20-gimnastika-electron-design.md` (odeljci 3, 4, 5, 6). Izvorni projekat za prenos fajlova: `C:\Users\bojan\Desktop\Takmicarski program` (dalje: PHP projekat).

## Global Constraints

- Repo `C:\Posao\gimnastika`, grana `main`. Commit samo kad Bojan traži; na kraju zadatka javiti šta je urađeno i šta nije provereno. Bez AI atribucije u commit porukama.
- Sav tekst interfejsa srpski latinicom; bez em crte (U+2014) igde. Nazivi u kodu srpski bez kvačica.
- Nema spoljnih URL-ova u radu osim provere ažuriranja. Font Manrope iz `PHP projekat\dizajn\fonts\` ide u `src/fonts/`.
- Nema Python/JDK/VS: native moduli samo prebuilt (`better-sqlite3` preko `electron-builder install-app-deps`).
- `package.json` `version` je jedini izvor verzije aplikacije; početna `0.1.0`.
- Testovi: `npm test` = `node --test tests/*.test.cjs tests/*.test.mjs`; svaki zadatak dodaje svoje i svi prolaze pre predaje.
- Podaci: `%APPDATA%\Gimnastika\gimnastika.sqlite`; u razvoju `GIM_PODACI` env promenljiva menja fasciklu.

## Review Focus

- Prvo pokretanje bez `%APPDATA%\Gimnastika`: fascikla i baza se prave, migracije prolaze, prozor se otvara (Task 2 test `migracije na praznoj bazi`).
- Ažuriranje bez interneta: nema greške na ekranu, nema čekanja, stanje `idle` sa porukom (Task 5 test za `offline`).
- Dva pokretanja istovremeno: drugo samo fokusira prvo (`app.requestSingleInstanceLock`, Task 1, ručna provera).
- Greška u modelu (npr. brisanje kluba sa takmičarima) stiže u renderer kao `{ok:false, greska}` sa porukom na srpskom, ne kao pad (Task 3 test `GreskaKorisnika`).
- Instalacija bez admin prava u korisnički folder i tiha instalacija `/S` (Task 5 ručna provera).

---

### Task 1: Projekat, prozor, verzija

**Files:**
- Create: `package.json`, `vite.config.mjs`, `index.html`, `src/main.jsx`, `src/App.jsx`, `electron/main.cjs`, `electron/preload.cjs`, `electron/sistem.cjs`, `electron/putanje.cjs`, `.gitignore`, `README.md`
- Test: `tests/sistem.test.cjs`

**Interfaces:**
- Produces: `electron/sistem.cjs` → `verzija(): string` (iz package.json), `electron/putanje.cjs` → `fasciklaPodataka(): string` (`process.env.GIM_PODACI` ili `%APPDATA%\Gimnastika`, pravi je ako ne postoji), `putanjaBaze(): string`, `fasciklaKopija(): string` (`<podaci>\kopije`).
- Produces: `window.gim.sistem.verzija(): Promise<string>` u rendereru (preload, `contextBridge`).

- [ ] **Step 1: Napiši test**

```js
// tests/sistem.test.cjs
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
```

- [ ] **Step 2: Pokreni test, mora da padne** (`npm test` → "Cannot find module").
- [ ] **Step 3: Napravi projekat**: `npm init -y`, pa `npm i react react-dom` i `npm i -D electron@44 vite@7 @vitejs/plugin-react electron-builder`. `package.json`: `"name":"gimnastika"`, `"version":"0.1.0"`, `"main":"electron/main.cjs"`, skripte `start` (`vite build && electron .`), `dev` (`vite` uz `electron .` sa `VITE_DEV_URL`), `build` (`vite build`), `test`, `installer` (zadatak 5), `publish-release` (zadatak 5). `vite.config.mjs`: `base: './'`, `build.outDir: 'dist'`. `.gitignore`: `node_modules`, `dist`, `release`.
- [ ] **Step 4: `electron/main.cjs`**: `app.requestSingleInstanceLock()` (drugo pokretanje fokusira prozor), `BrowserWindow` 1366x768, `minWidth 1200`, `webPreferences: {preload, contextIsolation: true, nodeIntegration: false, sandbox: false}`, učitava `VITE_DEV_URL` ili `dist/index.html`, naslov `Gimnastika`. `electron/preload.cjs`: `contextBridge.exposeInMainWorld('gim', {...})` gde za sada stoji `sistem: { verzija: () => ipcRenderer.invoke('gim:sistem:verzija') }` (zadatak 3 to generalizuje). `main.cjs` registruje `ipcMain.handle('gim:sistem:verzija', () => verzija())`.
- [ ] **Step 5: `src/App.jsx`** prikazuje `Gimnastika <verzija>` (verzija iz `window.gim.sistem.verzija()`).
- [ ] **Step 6: Pokreni testove** (`npm test` → 2 passed) i `npm start` → prozor sa tekstom `Gimnastika 0.1.0`. Pokreni drugi put dok prvi radi: ne otvara se drugi prozor.

### Task 2: Baza i migracije

**Files:**
- Create: `electron/baza/baza.cjs`, `electron/baza/migracije/001_pocetna.sql`, `002_takmicenje_grb_domacin.sql`, `003_potvrde_klubova.sql`, `004_redosled_po_rotaciji.sql`
- Test: `tests/baza.test.cjs`
- Reference: `PHP projekat\migracije\*.sql` (iste tabele i kolone), `PHP projekat\app\Jezgro\Baza.php` (imena metoda)

**Interfaces:**
- Produces: `otvori(putanja: string): Baza` gde `Baza` ima `migriraj(): string[]` (vraća imena primenjenih), `naCekanju(): string[]`, `svi(sql, params=[]): object[]`, `jedan(sql, params): object|null`, `vrednost(sql, params): any|null`, `izvrsi(sql, params): number` (changes), `ubaci(tabela, podaci: object): number` (lastInsertRowid), `izmeni(tabela, podaci, uslov: string, params): number`, `transakcija(fn: (b) => T): T`, `tabele(): string[]`, `zatvori()`; statička `Baza.sad(): string` (`YYYY-MM-DD HH:MM:SS` UTC, kao `Baza::sad()` u PHP-u).
- SQL prevod: `AUTO_INCREMENT` → `INTEGER PRIMARY KEY AUTOINCREMENT`; `DECIMAL(6,3)` → `INTEGER` (hiljaditi delovi); `DATETIME`/`DATE` → `TEXT`; `TINYINT(1)` → `INTEGER`; kolacije i `ENGINE` se brišu; `ADD COLUMN IF NOT EXISTS` → običan `ADD COLUMN` (migracija se primenjuje jednom). Tabela `migracije(ime TEXT PRIMARY KEY, primenjeno TEXT)`.

- [ ] **Step 1: Napiši test**

```js
// tests/baza.test.cjs
test('migracije na praznoj bazi prave sve tabele i ponovo ne rade nista', () => {
  const b = otvori(':memory:');
  const prvi = b.migriraj();
  assert.deepEqual(prvi, ['001_pocetna', '002_takmicenje_grb_domacin', '003_potvrde_klubova', '004_redosled_po_rotaciji']);
  assert.deepEqual(b.tabele().sort(), ['grupa_clanovi','grupa_redosled','grupe','izmene_ocena','kategorije','klubovi','migracije','ocene','ocene_e','podesavanja','potvrde_klubova','prijava_sprave','prijave','programi','sprave','takmicari','takmicenja']);
  assert.deepEqual(b.migriraj(), []);
});
test('ubaci, izmeni, jedan, vrednost, transakcija', () => {
  const b = otvori(':memory:'); b.migriraj();
  const sad = Baza.sad(); assert.match(sad, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const id = b.ubaci('klubovi', { puno_ime: 'Klub Jedan', skracenica: 'JED', kreirano: sad, izmenjeno: sad });
  assert.equal(id, 1);
  assert.equal(b.izmeni('klubovi', { grad: 'Novi Sad' }, 'id = ?', [id]), 1);
  assert.equal(b.jedan('SELECT * FROM klubovi WHERE id = ?', [id]).grad, 'Novi Sad');
  assert.equal(b.vrednost('SELECT COUNT(*) FROM klubovi'), 1);
  assert.throws(() => b.transakcija(x => { x.ubaci('klubovi', { puno_ime: 'Dva', skracenica: 'DVA', kreirano: sad, izmenjeno: sad }); throw new Error('stop'); }), /stop/);
  assert.equal(b.vrednost('SELECT COUNT(*) FROM klubovi'), 1, 'transakcija je vracena');
});
test('ocene su celi brojevi u hiljaditim delovima', () => { /* ubaci red u ocene sa konacna: 13050 (uz potrebne prijava_id, sprava_id), procitaj 13050 kao number */ });
```

- [ ] **Step 2: Pokreni test, mora da padne.**
- [ ] **Step 3: `npm i better-sqlite3`** i `"postinstall": "electron-builder install-app-deps"` u package.json; napiši `baza.cjs` (WAL kad putanja nije `:memory:`, `PRAGMA foreign_keys = ON`) i prevedi četiri SQL fajla (isti nazivi tabela i kolona kao u PHP projektu; indeksi i `UNIQUE` ostaju).
- [ ] **Step 4: Testovi prolaze.** U `main.cjs` pri startu: `otvori(putanjaBaze())`, `migriraj()`, a imena primenjenih upiši u `dnevnik.log` u fascikli podataka.

### Task 3: IPC sloj i greške

**Files:**
- Create: `electron/greska.cjs`, `electron/ipc.cjs`, `electron/api.cjs`, `src/gim.js`
- Modify: `electron/preload.cjs`, `electron/main.cjs`
- Test: `tests/ipc.test.cjs`

**Interfaces:**
- Produces: `class GreskaKorisnika extends Error` (poruka za korisnika; model baca nju umesto `RuntimeException`).
- Produces: `api.cjs` → `MODULI = { sistem: ['verzija'], ... }` (lista raste po fazama; preload iz nje gradi `window.gim`).
- Produces: `registruj(ipcMain, moduli: {[modul]: {[radnja]: fn}}, dnevnik)`: za svaki par `ipcMain.handle('gim:<modul>:<radnja>', (ev, ...args) => ...)`; rezultat `{ok:true, podaci}`; `GreskaKorisnika` → `{ok:false, greska: poruka}`; druga greška → upis u dnevnik i `{ok:false, greska: 'Greška u programu. Pogledajte dnevnik.log.'}`. Renderer strana (`src/gim.js`): `gim.<m>.<r>(...)` vraća `podaci` ili baca `Error(greska)`.

- [ ] **Step 1: Test** sa lažnim `ipcMain` (`{handle(kanal, fn)}` koji pamti): registrovani kanali su `['gim:sistem:verzija']` za `MODULI`; poziv funkcije koja baca `GreskaKorisnika('Klub ima 3 takmičara.')` vraća `{ok:false, greska:'Klub ima 3 takmičara.'}`; poziv koja baca `TypeError` vraća generičku poruku i poziva `dnevnik.greska` jednom; uspešan poziv vraća `{ok:true, podaci:'0.1.0'}`.
- [ ] **Step 2: Pokreni, pada.**
- [ ] **Step 3: Napiši module**; preload gradi objekat iz `MODULI`.
- [ ] **Step 4: Testovi prolaze**; `npm start` i dalje prikazuje verziju.

### Task 4: Okvir ekrana, CSS, font, ikone, prečice, ekran Sistem

**Files:**
- Create: `src/ruter.js`, `src/precice.js`, `src/okvir/Meni.jsx`, `src/okvir/Traka.jsx`, `src/okvir/Poruke.jsx`, `src/komponente/Ikona.jsx`, `src/ekrani/Sistem.jsx`, `src/ekrani/Prazno.jsx`, `src/stil/app.css`, `src/stil/tokens.css`, `src/fonts/*`, `src/ikone/*.svg`
- Modify: `src/App.jsx`
- Test: `tests/ruter.test.mjs`, `tests/precice.test.mjs`
- Reference: `PHP projekat\app\Pogledi\okvir.php` (meni i traka), `app\Pogledi\sistem.php` (ekran komponenti), `public\assets\css\app.css`, `dizajn\tokens.css`, `public\assets\ikone\*.svg`, `public\assets\js\app.js` (prečice, obaveštenja), `dizajn\slike\00-vizuelni-sistem.png`

**Interfaces:**
- Produces: `ruter.js` → `razlozi(hash: string): {ekran: string, parametri: object}` (`'#/prijave?pol=M'` → `{ekran:'prijave', parametri:{pol:'M'}}`, prazno → `pocetna`), `url(ekran, parametri={}): string`.
- Produces: `precice.js` → `radnja(ev: {key, altKey, ctrlKey, target:{tagName, isContentEditable}}): string|null` sa vrednostima `'unos'` (F2), `'rang'` (F4), `'novi'` (Alt+N), `'otkazi'` (Esc), `'stampa'` (Ctrl+P), `'kopija'` (Ctrl+S); Alt+N i Esc rade i u poljima, F2/F4 ne rade dok je fokus u `INPUT`/`SELECT`/`TEXTAREA`.
- Produces: `Poruke.jsx` izvozi `obavesti(tekst, vrsta='ok'|'greska'|'upozorenje'|'info')` (kao `App.obavesti`), `Ikona` prima `ime` i `velicina`.
- Produces: `App.jsx` drži `ekran` iz hasha, crta `Meni` (iste stavke, grupe i prečice kao `okvir.php`), `Traka` (naslov ekrana, aktivno takmičenje iz `gim.podesavanja.aktivno()` kad bude postojalo; sad tekst „Nema aktivnog takmičenja“) i sadržaj; nepoznat ekran crta `Prazno` sa tekstom „Ekran <ime> još nije napravljen.“.

- [ ] **Step 1: Testovi** za `razlozi`/`url` (gornji primeri, plus `'#/takmicenja/izmeni?id=3'` → `{ekran:'takmicenja/izmeni', parametri:{id:'3'}}`) i za `radnja` (F2 van polja → `'unos'`, F2 u `INPUT` → `null`, Alt+N u `INPUT` → `'novi'`, Esc → `'otkazi'`, Ctrl+P → `'stampa'`, obično slovo → `null`).
- [ ] **Step 2: Pokreni, pada.**
- [ ] **Step 3: Napiši module i komponente.** `app.css` i `tokens.css` se kopiraju iz PHP projekta i menjaju samo gde React traži (`@font-face` putanje na `./fonts/`). Ikone: svaki SVG uvezen kao `?raw` i ubačen preko `dangerouslySetInnerHTML`, sa `width/height` kao u `ikona()` PHP funkciji. Ekran Sistem ponavlja `sistem.php`: dugmad, polja, statusi, tabela, poruke, kartice.
- [ ] **Step 4: Testovi prolaze.** `npm start`, `#/sistem` na 1366x768, uporediti sa `00-vizuelni-sistem.png`: isti razmaci, boje i font; bez vodoravnog skrola. Prečice F2/F4 menjaju hash, Alt+N šalje `document` događaj `app:novi`, Esc `app:otkazi`.

### Task 5: Instaler, GitHub ažuriranje, objavljivanje

**Files:**
- Create: `installer/electron-builder.yml`, `installer/ikona.ico` (kopija `PHP projekat\paket\izlaz\gimnastika.ico`), `electron/updater-stanje.mjs`, `electron/updater.cjs`, `installer/publish-release.cjs`, `installer/github.cjs`, `src/okvir/Azuriranje.jsx`, `beleske/0.1.0.md`
- Modify: `package.json` (skripte `installer`, `publish-release`), `electron/main.cjs`, `electron/api.cjs` (`azuriranje: ['stanje','proveri','preuzmi','instaliraj']`), `src/okvir/Traka.jsx`, `src/ekrani/Sistem.jsx`
- Test: `tests/updater-stanje.test.mjs`, `tests/publish.test.cjs`
- Reference: `C:\Posao\structure-studio\electron\updater.cjs`, `installer.cjs`, `publish-release.cjs`, `release\installer-config.json`

**Interfaces:**
- Produces: `updater-stanje.mjs` → `pocetno(verzija): Stanje` i `sledece(stanje, dogadjaj): Stanje` gde `dogadjaj` je `{tip:'checking'|'available'|'none'|'progress'|'downloaded'|'error', verzija?, procenat?, poruka?}` i `Stanje = {stanje:'idle'|'checking'|'available'|'downloading'|'ready'|'error', trenutna, verzija?, procenat?, poruka}`; `'error'` sa porukom koja sadrži `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT` ili `net::` daje `{stanje:'idle', poruka:'Nema veze sa internetom.'}`.
- Produces: `updater.cjs` → `createUpdater({app, send, dnevnik, preInstalacije})` sa `status()`, `check()`, `download()`, `install()` (pre `quitAndInstall` zove `preInstalacije()`; u fazi 7 to je kopija baze vrste `pre_azuriranja`, u fazi 0 upis u dnevnik). `autoDownload=false`, `autoInstallOnAppQuit=false`; provajder i repo iz `app-update.yml` koji electron-builder upiše iz `publish` bloka. Van `app.isPackaged` stanje je `{stanje:'idle', poruka:'Ažuriranje radi samo u instaliranom programu.'}`.
- Produces: `github.cjs` → `napraviRelease({owner, repo, token, tag, naziv, beleske}): Promise<{id, upload_url}>`, `dodajFajl({upload_url, token, putanja, ime})`, `citajToken(putanja = ~/.config/github-token.txt): string`, `spisakFajlova(fascikla, verzija): string[]`; `publish-release.cjs` → CLI `--notes <md> [--dry-run]`: traži tag `v<verzija>` na GitHub-u, odbija ako release postoji, šalje `Gimnastika-Setup-<v>.exe`, `.blockmap`, `latest.yml` iz `release/`.
- UI: u `Traka` pored verzije dugme `Nova verzija <v>` (stanje `available`), `Preuzimanje <procenat>%`, `Ponovo pokreni i ažuriraj` (stanje `ready`); na ekranu Sistem (u fazi 7 seli se na Rezervna kopija) dugme „Proveri ažuriranje“ i tekst stanja. Tiha provera 5 s posle starta.

- [ ] **Step 1: Testovi**: `sledece(pocetno('0.1.0'), {tip:'available', verzija:'0.2.0'})` → `{stanje:'available', verzija:'0.2.0', trenutna:'0.1.0', poruka:''}`; niz `checking → progress 40 → downloaded` daje `ready` sa `verzija`; `{tip:'error', poruka:'net::ERR_INTERNET_DISCONNECTED'}` → `idle` sa porukom `Nema veze sa internetom.`; `{tip:'error', poruka:'sha512 mismatch'}` → `error` sa tom porukom. `publish.test.cjs`: `spisakFajlova(dir, '0.1.0')` vraća tri imena kad postoje i baca sa imenom fajla koji fali; `citajToken` baca poruku sa putanjom kad fajla nema (bez ispisa sadržaja).
- [ ] **Step 2: Pokreni, pada.**
- [ ] **Step 3: Napiši module.** `electron-builder.yml`: `appId: com.sandblockstudios.gimnastika`, `productName: Gimnastika`, `win.target: nsis x64`, `nsis: {oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, artifactName: Gimnastika-Setup-${version}.exe, shortcutName: Gimnastika}`, `publish: [{provider: github, owner: <Bojanov nalog>, repo: gimnastika}]`, `files: [dist, electron, package.json]`. Skripta `installer`: `vite build && electron-builder --config installer/electron-builder.yml --win --publish never`.
- [ ] **Step 4: Testovi prolaze. `npm run installer`** daje `release/Gimnastika-Setup-0.1.0.exe`, `.blockmap`, `latest.yml`. Tiha instalacija: `release\Gimnastika-Setup-0.1.0.exe /S /D=<privremena fascikla>`; pokreni `Gimnastika.exe`: prozor, `#/sistem`, „Proveri ažuriranje“ bez interneta (ili sa nepostojećim repo-om) daje „Nema veze sa internetom.“ bez greške na ekranu. `node installer/publish-release.cjs --notes beleske/0.1.0.md --dry-run` ispisuje šta bi poslao. Obriši probnu instalaciju.
- [ ] **Step 5: Javi Bojanu**: traži ime GitHub naloga i repo-a, da li je repo javan, i znak za `git init` i prvi commit.
