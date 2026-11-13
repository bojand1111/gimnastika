# Objava takmičenja: plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zapisničar objavljuje takmičenje na Bojanov Cloudflare Worker; Bojan ga ubacuje u instaler; svaki program posle ažuriranja ga sam doda kao završeno.

**Architecture:** Čist format (`electron/racun/objava-format.mjs`) gradi i proverava JSON objave. Model `electron/modeli/objava.cjs` čita redove takmičenja i uvozi objavu sa uparivanjem. `electron/objava.cjs` je klijent slanja (kao `sinhro.cjs`), `electron/objave-start.cjs` uvozi fajlove iz `resources/takmicenja` pri startu. Worker i Bojanova skripta su odvojeni fajlovi bez zavisnosti.

**Tech Stack:** Electron 44, React 19, `node:sqlite`, `node --test`, Cloudflare Workers + KV (bez npm paketa).

**Spec:** `docs/superpowers/specs/2026-11-13-objava-takmicenja-design.md` (čitaj ga uz svaki zadatak).

## Global Constraints

- Bez novih npm zavisnosti. Komentari kratki, na srpskom; nazivi u kodu srpski bez kvačica.
- Šema samo kroz novu migraciju `electron/baza/migracije/009_objave.sql`; postojeće migracije se ne diraju.
- Ocene su celi brojevi (hiljaditi delovi); u fajlu ostaju celi brojevi ili `null`.
- U fajl NE ulaze: `kontakt_roditelja`, `lekarski_do`, `broj_licence`, `trener`, `id_broj`, `grb_levo`, `grb_desno`, `zavrseno`, `izmene_ocena`, `potvrde_klubova`, `podesavanja`.
- Uvoz nikad ne menja ni ne briše postojeći red (klub, takmičar, kategorija, program, sprava, takmičenje); samo dodaje.
- Uvoz pri startu nikad ne zaustavlja otvaranje prozora; greška ide u `dnevnik`.
- Tekst interfejsa srpski latinicom, datumi `dd.mm.gggg.`, bez em crtice (U+2014) u bilo kom tekstu.
- Vremensko ograničenje zahteva 15000 ms; telo objave najviše 2 MB (2097152 B).
- Testovi: `npm test` mora da prolazi posle svakog zadatka. Rad na grani `objava-takmicenja`; merge i push samo na Bojanov znak.

## Review Focus

1. Dva različita deteta istog imena, prezimena, godine i pola u istom fajlu: lokalni takmičar se uparuje najviše jednom po uvozu, drugi postaje nov takmičar (inače `uq_prijave_takmicenje_takmicar` obori ceo uvoz). Test u Task 3.
2. Oštećen ili prazan `.json` u `resources/takmicenja`: fajl se odbija sa razlogom, ostali se uvoze, start ide dalje. Test u Task 4.
3. Takmičenje bez ocena i bez grupa, i ocena u nacrtu (`d`, `e`, `konacna` = `null`, `e_sudije.vrednost` = `null`): uvozi se, `null` ostaje `null`. Test u Task 2 i Task 3.
4. Dvostruki klik na „Objavi“: jedno slanje u toku po takmičenju, drugi poziv čeka isti rezultat. Test u Task 5.
5. Takmičar bez kluba (`klub_id` null) i prijava bez kategorije ili programa: uvozi se sa `null`. Test u Task 3.

---

### Task 1: Migracija 009

**Files:**
- Create: `electron/baza/migracije/009_objave.sql`
- Test: `tests/objava-migracija.test.cjs`

**Interfaces:**
- Produces: `takmicenja.uid TEXT NOT NULL DEFAULT ''` + `CREATE UNIQUE INDEX uq_takmicenja_uid ON takmicenja (uid) WHERE uid <> ''`;
  tabela `objave (takmicenje_id INTEGER PRIMARY KEY REFERENCES takmicenja(id) ON DELETE CASCADE, uid TEXT NOT NULL, fajl TEXT NOT NULL, stanje TEXT NOT NULL, poslednji_pokusaj TEXT NULL, poslato TEXT NULL, poruka TEXT NOT NULL DEFAULT '')`;
  tabela `uvezene_objave (uid TEXT PRIMARY KEY, takmicenje_id INTEGER NULL, stanje TEXT NOT NULL, poruka TEXT NOT NULL DEFAULT '', vreme TEXT NOT NULL, izvor_verzija TEXT NOT NULL DEFAULT '', naziv TEXT NOT NULL DEFAULT '', pol TEXT NOT NULL DEFAULT '', prikazano INTEGER NOT NULL DEFAULT 0)` (`naziv` i `pol` iz `o.takmicenje`, da Početna može da prikaže i odbijen fajl).
  `stanje` u `objave`: `ceka` | `poslato`; u `uvezene_objave`: `uvezeno` | `postoji` | `odbijeno`.

- [ ] **Step 1: Napiši test** `migracija 009: uid, objave, uvezene_objave`: posle `otvori(':memory:').migriraj()` postoji kolona `uid` sa `''` za staro takmičenje; dva takmičenja sa `uid = ''` su dozvoljena; drugo sa istim nepraznim `uid` baca grešku; `objave` i `uvezene_objave` primaju red sa kolonama gore.
- [ ] **Step 2:** `npm test` pada (nema tabela).
- [ ] **Step 3:** Napiši `009_objave.sql` sa kratkim komentarom na vrhu (kao 008).
- [ ] **Step 4:** `npm test` prolazi.
- [ ] **Step 5: Commit** `feat(objava): migracija 009 za objave i uvezena takmicenja`

### Task 2: Format objave i izvoz takmičenja

**Files:**
- Create: `electron/racun/objava-format.mjs`, `electron/modeli/objava.cjs`
- Test: `tests/racun-objava-format.test.mjs`, `tests/modeli-objava-izvoz.test.cjs`

**Interfaces:**
- Produces (`objava-format.mjs`):
  - `VERZIJA_FORMATA = 1`, `NAJVECA_VELICINA = 2097152`
  - `napraviObjavu(redovi, { uid, verzija, sad }) -> objekat` u obliku iz spec 5.1 (`program.naziv = 'Gimnastika desktop'`, `objavljeno = sad`). `redovi` = `{ takmicenje, klubovi, takmicari, kategorije, programi, sprave, prijave, prijavaSprave, grupe, clanovi, redosledi, ocene, oceneE }` kao sirovi redovi baze; funkcija bira samo dozvoljena polja.
  - `proveriObjavu(o) -> string[]` (prazno = ispravno): `verzija_formata === 1`, `uid` je UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`), `takmicenje.naziv` i `takmicenje.datum` neprazni, `takmicenje.pol` je `'M'` ili `'Z'`, svi nizovi iz 5.1 postoje, svaki `*_id` u prijavama/grupama/ocenama pokazuje na red u fajlu (`null` dozvoljen za `klub_id`, `kategorija_id`, `program_id`).
- Produces (`modeli/objava.cjs`): `napravi(baza) -> { redoviTakmicenja(tid) }` (više funkcija dodaju Task 3 i 5). `redoviTakmicenja` vraća samo klubove, takmičare, kategorije, programe i sprave koje takmičenje koristi (preko prijava, `prijava_sprave`, ocena).

- [ ] **Step 1: Testovi formata:** `napraviObjavu` izostavlja svako zabranjeno polje iz Global Constraints (proveri ključeve svakog takmičara i takmičenja); ocena u nacrtu zadržava `null` za `d`, `e`, `konacna`, `bonus`, `odbitak` i `e_sudije[].vrednost`; prijava nosi `sprave: [id...]`; grupa nosi `clanovi` i `redosled_po_rotaciji`. `proveriObjavu`: ispravna objava daje `[]`; pogrešna verzija, loš uid, prazan naziv, pol `'X'`, prijava sa nepostojećim `takmicar_id` daju po jednu poruku.
- [ ] **Step 2: Test izvoza** (`modeli-objava-izvoz`): baza sa dva takmičenja; `redoviTakmicenja(t1)` ne sadrži klub ni takmičara koji su samo u t2; takmičenje bez prijava daje prazne nizove.
- [ ] **Step 3:** `npm test` pada.
- [ ] **Step 4:** Implementiraj oba fajla.
- [ ] **Step 5:** `npm test` prolazi.
- [ ] **Step 6: Commit** `feat(objava): format objave i izvoz redova takmicenja`

### Task 3: Uvoz objave sa uparivanjem

**Files:**
- Modify: `electron/modeli/objava.cjs`
- Test: `tests/modeli-objava-uvoz.test.cjs`

**Interfaces:**
- Consumes: `proveriObjavu`, `VERZIJA_FORMATA` (Task 2); `nadjiKlubDetaljno`, `kljuc` (`electron/uvoz/uparivanje.cjs`); `normalizuj` (`electron/uvoz/tumac-prijave.cjs`).
- Produces: `uvezi(o, { verzija, sad }) -> { stanje: 'uvezeno'|'postoji'|'odbijeno'|'preskoceno', takmicenje_id: number|null, poruka: string }` , `proveri(o) -> string[]` (format + sprave postoje lokalno, bez upisa) i `vecObradjen(uid) -> boolean` (uid u `uvezene_objave` ili `takmicenja.uid`; Task 4 ga koristi da ne pravi kopiju za preskočene fajlove).
  - `preskoceno`: `uid` već u `uvezene_objave` ili u `takmicenja.uid`; ništa se ne upisuje.
  - Inače upisuje red u `uvezene_objave` (`izvor_verzija = o.program.verzija`) u istoj transakciji kao podaci. `odbijeno` takođe upisuje red (bez podataka). Izuzetak tokom upisa: rollback i baca dalje (pozivalac beleži; red se ne upisuje, pa se pokušava sledeći put).

Pravila (spec 5.6), redom:
1. `proveri(o)` nije prazno: `odbijeno`, poruka = greške spojene sa `'; '`.
2. Lokalno takmičenje istog `pol`, `normalizuj(naziv)` i `datum`: `postoji`, `takmicenje_id` = taj id.
3. Klub: `nadjiKlubDetaljno(skracenica, klubovi)` sa `delimicno === false`, pa isto za `puno_ime`; nema: `ubaci('klubovi', {puno_ime, skracenica, grad})`.
4. Takmičar: isti `pol`, `kljuc` (i zamenjen redosled imena) i `godina_rodjenja`; lokalni takmičar se koristi najviše jednom po uvozu. Nema: nov takmičar, `id_broj = 'U' + uid.slice(0, 8) + '-' + n` (n od 1 po fajlu), `klub_id` uparenog kluba.
5. Kategorija/program: isti `pol` i `normalizuj(naziv)`; nema: nova sa `redosled = MAX(redosled)+1` u tom polu.
6. Sprava: isti `pol` i `skracenica` (proverava `proveri`).
7. Takmičenje: polja iz fajla + `uid`, `zavrseno = 1`, `grb_levo = grb_desno = ''`. Ne dira `aktivno_takmicenje_*`.
8. Prijave, `prijava_sprave`, grupe (`turnus` iz fajla), `grupa_clanovi`, `grupa_redosled`, ocene, `ocene_e` sa mapiranim id-jevima.

- [ ] **Step 1: Testovi** (svaki sa izvornom bazom A koja pravi objavu kroz Task 2 i ciljnom bazom B):
  - `uvoz u praznu bazu daje iste rezultate`: rang u B (`rezultati` model) je jednak rangu u A za sve kombinacije.
  - `postojeci klub i takmicar se uparuju, nista se ne menja`: svi redovi `klubovi` i `takmicari` iz B pre uvoza postoje posle uvoza sa istim id i istim poljima.
  - `isto ime u fajlu dvaput`: dva takmičara istog imena/godine/pola, B ima jednog takvog: jedan se upari, drugi nov; uvoz uspeva (Review Focus 1).
  - `bez kluba i bez kategorije`: `klub_id`, `kategorija_id`, `program_id` = `null` ostaju `null` (Review Focus 5).
  - `nacrt ocene ostaje null` (Review Focus 3).
  - `nova kategorija ide na kraj redosleda`, `id_broj novog je U<8>-1 i sledeciIdBroj se ne menja`.
  - `nema sprave: odbijeno, red u uvezene_objave, bez podataka`.
  - `isti naziv, datum i pol: postoji`, `isti uid: preskoceno`, `drugi poziv: preskoceno`.
  - `takmicenje je zavrseno i nije aktivno`.
  - `greska usred upisa vraca sve`: lažni `ubaci` baca na ocenama; broj redova svih tabela isti kao pre, nema reda u `uvezene_objave`.
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj `uvezi` i `proveri` u jednoj `baza.transakcija`.
- [ ] **Step 4:** `npm test` prolazi.
- [ ] **Step 5: Commit** `feat(objava): uvoz objave sa uparivanjem klubova i takmicara`

### Task 4: Uvoz pri startu i pakovanje u instaler

**Files:**
- Create: `electron/objave-start.cjs`, `takmicenja/README.md`
- Modify: `electron/modeli/kopija.cjs` (vrsta u `VRSTE`), `electron/main.cjs` (`pokreni()`), `installer/electron-builder.yml`, `.gitignore`
- Test: `tests/objave-start.test.cjs`

**Interfaces:**
- Consumes: `objava.napravi(baza).uvezi/proveri` (Task 3); `kopija.napravi(vrsta)` (postojeći model).
- Produces: `uveziIzFascikle({ baza, fascikla, kopija, dnevnik, verzija, sad }) -> { uvezena: [{uid, naziv, takmicenje_id}], odbijena: [{uid|fajl, poruka}] }`.
  - Čita `*.json` sortirane po `takmicenje.datum`. Loš JSON: `odbijena` + dnevnik; bez `uid` nema reda u bazi, ali se ne prekida.
  - Fajl sa `vecObradjen(uid)` se preskače bez poziva. Za ostale prvo `proveri`; ako bar jedan prolazi, jedna kopija `kopija.napravi('pre_uvoza')`. Greška kopije: dnevnik, uvoz se NE radi (bez kopije nema uvoza).
- `VRSTE.pre_uvoza = 'Pre uvoza takmičenja'`.
- `main.cjs`: posle `podeliPolove` i `kopija = napraviKopijuModel(...)`, u `try/catch` sa `dnevnik.greska('uvoz objava', err)`: fascikla `app.isPackaged ? path.join(process.resourcesPath, 'takmicenja') : path.join(__dirname, '..', 'takmicenja')`; nepostojeća fascikla = ništa.
- `electron-builder.yml`: `extraResources: [{ from: takmicenja, to: takmicenja, filter: ["*.json"] }]`.
- `.gitignore`: `takmicenja/*.json`. `takmicenja/README.md`: dve rečenice (šta ide ovde, `node alati/preuzmi-objave.cjs`).

- [ ] **Step 1: Testovi:** `dva dobra i jedan los fajl` (2 uvezena, 1 odbijen, jedna kopija `pre_uvoza`); `drugi start ne radi nista i ne pravi kopiju`; `sve preskoceno: nema kopije`; `kopija pada: nista se ne uvozi, greska u dnevnik`; `prazna ili nepostojeca fascikla: prazni nizovi` (Review Focus 2).
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj; dodaj u `main.cjs`, builder, `.gitignore`, README.
- [ ] **Step 4:** `npm test` prolazi; `npm run installer` pravi instaler; `release/win-unpacked/resources/takmicenja/` postoji kad je u `takmicenja/` jedan probni `.json` (napravi ga iz primer podataka, obriši posle).
- [ ] **Step 5: Commit** `feat(objava): uvoz objavljenih takmicenja pri startu`

### Task 5: Klijent objave

**Files:**
- Create: `electron/objava.cjs`, `electron/objava-adresa.cjs`
- Modify: `electron/modeli/objava.cjs` (`izvezi`)
- Test: `tests/objava-klijent.test.cjs`

**Interfaces:**
- Consumes: `napraviObjavu`, `NAJVECA_VELICINA` (Task 2), `redoviTakmicenja` (Task 2).
- Produces:
  - `objava-adresa.cjs`: `module.exports = { OBJAVA_ADRESA: '' }` (Bojan upisuje adresu Worker-a).
  - `modeli/objava.cjs`: `izvezi(tid, { verzija, sad }) -> objekat`; prvi put postavlja `takmicenja.uid = crypto.randomUUID()`.
  - `objava.cjs`: `napravi({ baza, model, adresa, fasciklaPodataka, dnevnik, verzija, fetch, sad, istekMs = 15000 }) -> { stanje(tid), objavi(tid), posaljiNaCekanju() }`.
    - `stanje(tid) -> { moze: boolean, razlog: string, stanje: 'nije'|'ceka'|'poslato', poslato: string|null, poruka: string }`. `moze = false` sa razlogom: `'Adresa za objavu nije podešena.'` (prazna adresa) ili `'Takmičenje je dodato iz ažuriranja i ne objavljuje se ponovo.'` (red u `uvezene_objave` sa tim `takmicenje_id` i `stanje = 'uvezeno'`; red `postoji` pokazuje na korisnikovo sopstveno takmičenje i ne blokira objavu).
    - `objavi(tid)`: proveri `moze`; napravi objavu; upiši `<fasciklaPodataka>/objave/<uid>.json`; red u `objave` = `ceka`; `POST {adresa}/objave` sa `Content-Type: application/json; charset=utf-8` i `X-Gimnastika-Verzija`, bez `Authorization`. `200` sa `{"ok":true}`: `poslato` + vreme. Mreža/istek: ostaje `ceka`, poruka `'Biće poslato kad bude interneta.'`. `400`/`413`/drugo: ostaje `ceka`, poruka `Server je javio grešku <kod>.` Vraća `stanje(tid)`.
    - Jedno slanje u toku po `tid`; drugi poziv dobija isti promise (Review Focus 4).
    - `posaljiNaCekanju()`: za svaki red `ceka` šalje postojeći fajl (ne pravi novu objavu); greške samo u dnevnik.
    - Objava veća od `NAJVECA_VELICINA`: `GreskaKorisnika('Takmičenje je preveliko za objavu.')`.
- [ ] **Step 1: Testovi** sa lažnim `fetch`: `fajl postoji pre slanja` (fetch proverava `fs.existsSync`); `uspeh: poslato`; `bez mreze: ceka i poruka`; `ponovna objava koristi isti uid`; `uvezeno takmicenje: moze false`; `prazna adresa: moze false, fetch se ne zove`; `dupli klik: jedan fetch`; `posaljiNaCekanju salje ceka redove`; `zaglavlje nema Authorization`.
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj (obrazac zahteva kao `zahtev()` u `sinhro.cjs`, sa `AbortController` i `unref`).
- [ ] **Step 4:** `npm test` prolazi.
- [ ] **Step 5: Commit** `feat(objava): slanje objave na server sa cekanjem bez interneta`

### Task 6: IPC, Pregled takmičenja i Početna

**Files:**
- Modify: `electron/api.cjs`, `electron/moduli.cjs`, `electron/main.cjs`, `electron/pregled-paket.cjs`, `src/ekrani/Takmicenje.jsx`, `src/ekrani/Pocetna.jsx`
- Test: `tests/ipc-objava.test.cjs`

**Interfaces:**
- Consumes: `objava.napravi(...)` (Task 5), `uvezene_objave.prikazano` (Task 1).
- Produces:
  - `MODULI.objava = ['stanje', 'objavi']`; `MODULI.pocetna = ['podaci', 'potvrdiUvoz']`.
  - `objava.stanje(id)` i `objava.objavi(id)`: id kroz `takmicenjeDela` (drugi deo = greška kao svuda).
  - `pocetna.podaci()` dobija `iz_azuriranja: [{ takmicenje_id, naziv, datumTekst, stanje, poruka }]` (redovi `prikazano = 0` sa `pol` = aktivni pol ili `pol = ''`; `naziv` iz `uvezene_objave.naziv`); `pocetna.potvrdiUvoz()` postavlja `prikazano = 1` za sve.
  - `main.cjs`: 10 s posle `did-finish-load`, `objavaKlijent.posaljiNaCekanju()` u `try/catch` sa dnevnikom; `napraviModule` dobija opciju `objavaSpremna` po obrascu `sinhroSpreman`.
- UI (izgled po `docs/VIZUELNI-SISTEM.md`, dugmad `dugme dugme-tekst dugme-malo`):
  - Pregled: dugme „Objavi takmičenje“ u zaglavlju kartice pored „Izmeni podatke“; ispod reda „Rezultati uživo“ red `Objava: <Poslato dd.mm.gggg. HH:MM | Čeka internet | Nije objavljeno>`; kad `moze = false`, dugme onemogućeno sa `title = razlog`.
  - Klik otvara postojeći `DijalogPotvrda`: „Šalje se: rezultati, imena, klubovi i godine rođenja. Ne šalje se: kontakt roditelja, lekarski, broj licence, trener.“ i, ako `zavrseno = 0`, dodatna rečenica „Takmičenje još nije označeno kao završeno.“ Dugme dijaloga „Objavi“. Dok je slanje u toku dugme je onemogućeno. Rezultat ide u `obavesti` (uspeh ili poruka).
  - Početna: kartica „Iz ažuriranja dodata takmičenja“ sa linkovima `#/takmicenja` i listom odbijenih sa porukom; dugme „U redu“ zove `potvrdiUvoz` i sakriva karticu.
- [ ] **Step 1: Test IPC:** `objava.stanje` za takmičenje drugog dela baca; `pocetna.podaci` vraća `iz_azuriranja` dok se ne pozove `potvrdiUvoz`; `MODULI` i handleri se poklapaju (`registruj` ne baca).
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj IPC i ekrane.
- [ ] **Step 4:** `npm test` prolazi; `npm run build` bez greške.
- [ ] **Step 5: QA kroz pravu aplikaciju** (CDP obrazac iz memorije: `GIM_PODACI` i `LOCALAPPDATA` u scratchpad, `GIM_DEBUG=1`, primer podaci): na 1366x768 Pregled bez vodoravnog skrola, dugme dostupno tastaturom (Tab, Enter), fokus vidljiv; sa praznom adresom dugme onemogućeno sa razlogom; sa adresom lažnog lokalnog servera objava daje „Poslato“; Početna posle uvoza probnog fajla pokazuje karticu, „U redu“ je sakriva.
- [ ] **Step 6: Commit** `feat(objava): dugme za objavu na pregledu i kartica uvoza na pocetnoj`

### Task 7: Cloudflare Worker i uputstvo

**Files:**
- Create: `server/objave-worker.mjs`, `docs/OBJAVE-SERVER.md`
- Test: `tests/objave-worker.test.mjs`

**Interfaces:**
- Worker je samostalan fajl (ne uvozi `objava-format.mjs`); ponavlja samo proveru `verzija_formata === 1`, UUID oblik `uid`, neprazni `takmicenje.naziv` i `takmicenje.datum`.
- Produces: `export default { async fetch(request, env) }`, `env.OBJAVE` (KV), `env.KLJUC` (tajna).
  - `POST /objave`: `Content-Length` ili pročitano telo > 2097152 → `413`; loš JSON ili provera → `400 {"ok":false,"greska":...}`; inače `env.OBJAVE.put('objava:' + uid, telo, { metadata: { naziv, datum, pol, objavljeno, verzija } })` → `200 {"ok":true}`.
  - `GET /objave` → `{"ok":true,"objave":[{uid, ...metadata}]}` (sve stranice `list` sa `cursor`); `GET /objave/<uid>` → telo ili `404`; `DELETE /objave/<uid>` → `{"ok":true}`. Sva tri samo uz `Authorization: Bearer <env.KLJUC>` (poređenje stalnog trajanja), inače `401`. Prazan `env.KLJUC` → uvek `401`.
  - Ostale putanje `404`, ostale metode `405`.
- `docs/OBJAVE-SERVER.md` (srpski, koraci za Bojana): nalog, Workers i KV namespace `OBJAVE`, nalepi `server/objave-worker.mjs`, veži KV kao `OBJAVE`, tajna `KLJUC` (dugačak slučajan tekst, isti u `~/.config/gimnastika-objave-kljuc.txt`), adresa Worker-a u `electron/objava-adresa.cjs`, provera `curl` komandom za `GET /objave`.
- [ ] **Step 1: Testovi** sa lažnim KV (`Map` + `list` sa `cursor`): POST ispravne objave pa GET sa ključem vraća je; GET bez ključa `401`; pogrešan ključ `401`; prazan `KLJUC` `401`; telo veće od 2 MB `413`; loš uid `400`; ponovni POST istog uid prepisuje; DELETE briše; nepoznata putanja `404`.
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj Worker i uputstvo.
- [ ] **Step 4:** `npm test` prolazi.
- [ ] **Step 5: Commit** `feat(objava): cloudflare worker za prijem objava i uputstvo`

### Task 8: Bojanova skripta za preuzimanje

**Files:**
- Create: `alati/preuzmi-objave.cjs`
- Test: `tests/alati-preuzmi-objave.test.cjs`

**Interfaces:**
- Consumes: Worker API (Task 7), `OBJAVA_ADRESA` (Task 5).
- Produces: `main(argv, { fetch, fascikla, kljuc, adresa, ispis }) -> Promise<number>` (izlazni kod) i CLI `node alati/preuzmi-objave.cjs [--sve] [--obrisi <uid>]`.
  - Ključ iz `~/.config/gimnastika-objave-kljuc.txt` (trim); nema fajla ili prazna adresa: poruka i kod 1. Ključ se nikad ne ispisuje.
  - Ispis po objavi: `naziv | dd.mm.gggg. | MSG/ŽSG | objavljeno dd.mm.gggg. HH:MM | novo/ima`.
  - Bez `--sve` skida samo `uid` kojih nema u `takmicenja/<uid>.json`; sa `--sve` prepisuje i postojeće. Pre upisa proverava JSON kroz `proveriObjavu` (dinamički `import` sa `pathToFileURL`); loš fajl se ne upisuje.
  - `--obrisi <uid>` zove `DELETE` i ispisuje rezultat; ništa lokalno ne briše.
- [ ] **Step 1: Testovi** sa lažnim fetch i scratch fasciklom: skida samo nove; `--sve` prepisuje; loš JSON se ne upisuje; bez ključa kod 1; ispis ne sadrži ključ.
- [ ] **Step 2:** `npm test` pada.
- [ ] **Step 3:** Implementiraj.
- [ ] **Step 4:** `npm test` prolazi.
- [ ] **Step 5: Commit** `feat(objava): skripta za preuzimanje objava u takmicenja/`

---

## Posle svih zadataka

- `npm test` (svi), `npm run installer`; `git diff --stat main` bez fantomskih CRLF izmena.
- Nije provereno ovim planom i ide u izveštaj Bojanu: pravi Cloudflare nalog i Worker, slanje sa pravog laptopa bez i sa internetom, instalacija i ažuriranje 1.2.8 na novu verziju sa fajlom u `takmicenja/`.
- Podizanje verzije, beleške, tag i release: samo na Bojanov znak.
