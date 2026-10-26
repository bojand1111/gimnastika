# Faza 6: Rang liste, rezultati takmičara, štampa, bilten, PDF

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran Rang liste (tabovi po spravi, Višeboj, Ekipno; filteri pol, kategorija, program), ekran Rezultati takmičara (ocene po spravama sa precrtanim odbačenim E, sva takmičenja), list za štampu rang liste (A4, prelom na strane) i bilten (ŽSG uspravno, MSG položeno) sa štampom kroz sistemski dijalog i čuvanjem PDF-a; sve kao u PHP verziji 1.2.0, nad SQLite bazom, sa testovima.

**Architecture:** Model `electron/modeli/rezultati.cjs` čita prijave i ocene i predaje ih čistim funkcijama iz `electron/racun/plasman.mjs` (faza 1), kao PHP `Rezultati.php`. Prelamanje strana za štampu i bilten je čista funkcija (`electron/racun/prelom.mjs`). IPC modul `rang` vraća ceo paket po ekranu jednim pozivom; modul `stampa` radi `webContents.print` i `printToPDF` (`electron/stampa.cjs`). Štampa i bilten su ekrani cele strane bez menija i trake (`App.jsx` skup `CELA_STRANA`), sa prenetim `stampa.css` i `@page` stilom koji ekran postavlja.

**Tech Stack:** Electron 44 (`webContents.print`, `printToPDF`, `dialog.showSaveDialog`), React 19, `node:sqlite`, node:test. Bez novih zavisnosti.

**Spec:** Dizajn `docs/superpowers/specs/2026-10-20-gimnastika-electron-design.md` (štampa: `webContents.print()` + `printToPDF`). Ponašanje, doslovni tekstovi, raspored i testovi: `docs/superpowers/specs/2026-10-26-faza-6-popis-php.md` (dalje: POPIS). Slike `PHP projekat\dizajn\slike\09-rang-liste.png`, `09b-stampa-rang-lista.png`, `09c-rezultati-takmicara.png`, `09d-bilten-zsg.png`, `09e-bilten-msg.png` odgovaraju kodu (razlike u uvodu POPIS-a). PHP projekat = `C:\Users\bojan\Desktop\Takmicarski program` (samo čitanje).

## Global Constraints

- Repo `C:\Posao\gimnastika`, grana `faza-6` od `main`. Commit po zadatku lokalno; push i merge samo na Bojanov znak. Bez AI atribucije.
- Tekst interfejsa srpski latinicom sa dijakriticima doslovno kao u POPIS-u (navodnici „ “, ` · `, minus `−` U+2212 u „D + E − odbitak“ i ispred odbitka na listu, strelica `←` u dugmetu „Rang liste“ je ikona `strelica-levo`); bez em crte (U+2014) igde. Nazivi u kodu srpski bez kvačica; LF.
- Brojevi: celi hiljaditi, prikaz kroz `prikaz`/`prikazD` iz `electron/racun/broj.mjs`; račun plasmana samo kroz `electron/racun/plasman.mjs` (ne duplirati); `odbaceniIndeksi` iz `ocena.mjs`.
- Modeli bacaju `GreskaKorisnika` sa doslovnim porukama; rezultati IPC poziva su obični objekti (grb kao file URL sa `?v=`, kao faza 3 `grbUrl`).
- CSS: `src/stil/app.css` već ima `.rang-*`, `.mesto-*`, `.precrtano`, `.sivo-red`, `.ne-stampaj`, `@media print`; `public/assets/css/stampa.css` se prenosi netaknut kao `src/stil/stampa.css` (POPIS 6); inline stilovi samo gde zavise od podataka (širine kolona po broju sprava, grid kolone lista).
- Tastatura pre miša, fokus vidljiv; Rang liste `sadrzaj-fiksno`; štampa i bilten su cela strana (bez menija), Esc vraća na Rang liste; 1366x768 bez vodoravnog skrola za ŽSG i MSG (višeboj MSG sa 6 sprava koristi skraćenice i 92 px kolone).
- Testovi: `npm test` čist; model nad `otvori(':memory:')` + `migriraj()` + `tokSeme` (`ekipno_broji` 1, sprave PR i GR za Ž, 4 E sudije) i nad primer podacima (`alati/primer-podaci.cjs uvezi` nad in-memory bazom: 100 ocena, očekivana mesta u JSON-u).
- Bez aktivnog takmičenja: `obradiNemaAktivnog` (`src/ekrani/aktivno.js`) na Rang listama, štampi i biltenu; Rezultati takmičara rade i bez aktivnog.

## Review Focus

- Primer podaci kroz MODEL: mesta po spravi, višeboj zbirovi i mesta, ekipe i ukupno jednaki `ocekivano_*` iz JSON-a za ŽSG i MSG, uključujući VK (Stojanović Nina na mestu koje joj pripada, bez pomeranja) i odustalu (Đorđević Sara bez zbira na dnu, njene ocene važe po spravi i za ekipu) (Task 1 test).
- Deljeno mesto i preskakanje (1, 1, 3) i pravilo `visa_e_pa_d` kroz model (Task 1 test po POPIS 8.1).
- `viseboj_nepotpun = ne_ulazi`: takmičar sa manje sprava nije u višeboju, ali jeste po spravi i u ekipi (Task 1 test).
- Prelom strana: 31 red na spravi daje 2 strane, ekipa od 5 redova se ne deli, bilten sa dugim višebojem ponavlja zaglavlje sekcije na sledećoj strani (Task 1 test čistog `prelom.mjs`, Task 4 ručno).
- PDF: sačuvan fajl postoji, nije prazan, ima očekivani broj strana (Task 2 test sa `printToPDF` nad pravim prozorom je skupo: Task 4 QA proverava u aplikaciji; Task 2 test proverava samo IPC ugovor sa stub `webContents`).

---

### Task 1: Model Rezultati i prelom strana

**Files:**
- Create: `electron/modeli/rezultati.cjs`, `electron/racun/prelom.mjs`
- Test: `tests/modeli-rezultati.test.cjs`, `tests/racun-prelom.test.mjs`
- Reference: POPIS 0.2, 0.3, 1 (1.1 do 1.3), 4.1 (prelom štampe), 5.1 (prelom biltena), 8; `PHP projekat\app\Modeli\Rezultati.php`, `app\Kontroleri\stampa.php` (prelamanje), `app\Kontroleri\bilten.php` (prelamanje), `testovi\TokTest.php`

**Interfaces:**
- `rezultati.cjs` produces `napravi(baza, podesavanja) → { kombinacije(takmicenjeId, pol = null): [{pol, kategorija_id, kategorija, program_id, program, broj}] (null id-jevi ostaju null; redosled pol Z pa M, kat.redosled, pr.redosled null-first), izbor(takm, pol, kat, prog): {ima, pol, kat, prog, kategorije: [{id, naziv}], programi: [{id, naziv}], kat_naziv, prog_naziv} (POPIS 1.2; `kategorije` i `programi` kao nizovi parova jer id može biti null; `'–'` za null naziv), izracunaj(takm, pol, kategorijaId|null, programId|null): {sprave, prijave: {pid: red}, po_spravi: {sid: red[]}, viseboj: red[], ekipno: red[]} (oblici POPIS 1.3 doslovno; `broji` kao objekat `{sid: boolean}`; `mesta` kao `{sid: oznaka}`) }`.
- `prelom.mjs` produces: `straneSprava(redovi, poStrani = 30)`, `straneEkipno(ekipe, poStrani = 30)` (ekipa = `1 + clanovi.length` redova, ne deli se, sama ekipa veća od strane ide na svoju stranu), `straneViseboj(redovi, polozeno)` (11 ili 6), `straneBilten(stavke, {polozeno, organizator, zaglavlje, domacin})` → `[[stavka]]` po POPIS 5.1 (visine 24/23/37, kapaciteti, zaglavlje sekcije 64/86, ponavljanje sekcije), `stavkeBiltena(rez)` → stavke (ekipa, clan, red). Prazno → `[[]]`.
- Consumes: `racun/plasman.mjs` (`mesta`, `viseboj`, `ekipno`, `ISTI_DELI`), `racun/ocena.mjs` (`odbaceniIndeksi`), `racun/broj.mjs`, `modeli/ocene.cjs` (`zaTakmicenje`), `podesavanja.cjs` (`daj`), `sortiranje.cjs` (`KOLATOR`, `poredi` kao u `grupe.cjs`), `baza.cjs`.

- [ ] **Step 1: Testovi**: `modeli-rezultati`: port POPIS 8.1 u celini (iste tvrdnje: VK/1/1/3, pozicije u višeboju, JED 24500, DVA 11000 sa 1 članom, `visa_e_pa_d` posle ispravke Bee); plus 8.3: `kombinacije` sa null kombinacijom i redosledom, `izbor` bez parametara → Z/prva kategorija/prvi program, sa nepostojećim `kat` → podrazumevano, `ima false` bez prijava; `nacrt` se ne računa; prijava bez ocena nije u višeboju; `ne_ulazi` isključuje iz višeboja a ne iz po spravi/ekipe; `detalji.odbacene`; ekipa bez kluba ne postoji; nad primer podacima (`uvezi` iz `alati/primer-podaci.cjs` u in-memory bazu): za ŽSG i MSG svaka `ocekivano_mesto` po spravi, `viseboj` zbir i `ocekivano_mesto_viseboj`, ekipe redom sa `ocekivano_mesto` i `ukupno` jednaki JSON-u kroz `izracunaj`. `racun-prelom`: 30/31 redova, ekipe 1+5 i 1+28 (sama na strani), višeboj 11/6, bilten sa 3 ekipe × 4 člana + 25 redova višeboja → više strana sa ponovljenom sekcijom, prazno `[[]]`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi. Step 5: Commit `feat(modeli): rezultati i prelom strana`.**

### Task 2: IPC `rang` i `stampa`, modul `electron/stampa.cjs`

**Files:**
- Create: `electron/stampa.cjs`
- Modify: `electron/api.cjs` (MODULI `rang: ['podaci','rezultati','stampa','bilten']`, `stampa: ['stampaj','pdf']`), `electron/moduli.cjs`, `electron/main.cjs` ako `napraviModule` treba `prozor()`/`webContents` (prosledi funkciju kao `roditelj`)
- Test: `tests/ipc-faza6.test.cjs`
- Reference: POPIS 2.1, 3.1, 4.1, 5.1, 7, 9.2, 9.4

**Interfaces:**
- `rang.podaci(pol, kat, prog, tab)` → `{takm: {id, naziv, ekipno_broji, pravilo_e}, izbor, rez|null, tab}` (tab proveren kao POPIS 2.1; `rez.sprave` sa `ikona`, `skracenica`).
- `rang.rezultati(takmicarId, tk)` → `{takmicar (sa klub_ime), sva: [{prijava, takm, sprave, red}], izabranoId|null}` po POPIS 3.1 (bez aktivnog takmičenja i dalje radi; `Takmičar ne postoji.` kao GreskaKorisnika).
- `rang.stampa(pol, kat, prog, tab)` → `{takm, izbor, rez, tab, sprava|null, polozeno, strane, naziv, grb (URL ili '')}`; bez prijava → GreskaKorisnika `Nema prijava za štampu.`.
- `rang.bilten(pol, kat, prog)` → `{takm, izbor, rez, polozeno, strane, disciplina, organizator, grbLevo, grbDesno}`; bez prijava → `Nema prijava za bilten.`.
- `stampa.stampaj({polozeno})` → `{ok}` (poziva `webContents.print({silent: false, printBackground: true, landscape: !!polozeno, pageSize: 'A4', margins: {marginType: 'none'}}, callback)` nad prozorom; greška printera → GreskaKorisnika `Štampa nije uspela: {razlog}`); `stampa.pdf({polozeno, ime})` → `{putanja}` ili `null` kad je dijalog otkazan (`dialog.showSaveDialog` sa `defaultPath` = `ime` u fascikli Dokumenti, filter PDF; `printToPDF({landscape, pageSize: 'A4', margins: {marginType: 'none'}, printBackground: true})`; upis fajla; greška → GreskaKorisnika `PDF nije sačuvan: {razlog}`).
- `electron/stampa.cjs` produces `napravi({prozor, dialog, fs}) → {stampaj, pdf}` (zavisnosti ubrizgane radi testa).
- Consumes: Task 1, `grbUrl` iz moduli.cjs, `takmicari.cjs` (`nadji`), `podesavanja.cjs`.

- [ ] **Step 1: Testovi**: guard; `podaci()` nad primer podacima (uvezi u in-memory): podrazumevani izbor Ž/Kadet/C program, `tab` nepoznat → `viseboj`, `rez.viseboj[0]` Petrović; `rezultati(id Petrović)` → `sva` 1 stavka, `red.zbir` 50300, `izabranoId` aktivno; nepostojeći takmičar baca; `stampa` bez prijava baca, sa prijavama vraća `strane` (višeboj ŽSG 10 redova → 1 strana; MSG `polozeno true`, 10 redova → 2 strane po 6), `naziv` doslovno; `bilten` → `polozeno` po polu, `disciplina`, prve strane stavke počinju ekipom; `stampa.stampaj` i `pdf` nad stub `prozor.webContents` (print poziva callback, printToPDF vraća Buffer) → `{ok}` i fajl upisan u temp; otkazan dijalog → `null`; structuredClone.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_DEBUG=1` start bez greške guard-a. Step 5: Commit `feat(ipc): rang liste, rezultati, stampa i pdf`.**

### Task 3: Ekrani Rang liste i Rezultati takmičara

**Files:**
- Create: `src/ekrani/Rang.jsx`, `src/ekrani/rang/{RangTraka,TabSprava,TabViseboj,TabEkipno,Mesto}.jsx`, `src/ekrani/Rezultati.jsx`, `src/ekrani/rangStanje.js` (čisto: `hashRang(pol, kat, prog, tab)`, `tekstPodnozja(...)`, `mestoPodaci(mesto, oznaka)` → `{vrsta: 'vk'|'prazno'|'plocica'|'obicno', tekst}`, `sirinaKolone(brojSprava, vrsta)`, `nazivKolone(sprava, brojSprava)`, `odustaoRec`, `mnozina`)
- Modify: `src/App.jsx` (`rang`, `rezultati` u EKRANI; `rang` u FIKSNO), `src/okvir/Meni.jsx` (naslov `Rezultati takmičara` za `rezultati`; meni ističe Rang liste), `src/ekrani/Takmicari.jsx` (POPIS 9.7: `?id` otvara karton tog takmičara), `src/stil/app.css` (samo klase koje fale: zaglavlje tabova, filter red, podnožje; `.rang-*` postoje)
- Test: `tests/rang-stanje.test.mjs`
- Reference: POPIS 2, 3, 9.1, 9.5, 9.6, 9.7, 9.10; slike `09-rang-liste.png`, `09c-rezultati-takmicara.png`; `PHP projekat\app\Pogledi\rang.php`, `rezultati.php`

**Interfaces:**
- Consumes Task 2 (`gim.rang.podaci`, `gim.rang.rezultati`), `Ikona` (`stampac`, `strelica-levo`, `iks`, `meni-takmicari`, `sprava-*`), `datumPrikaz`, `prikaz`, `najavi`/`obavesti`, `obradiNemaAktivnog`, `razlozi(hash).parametri`.
- Ponašanje po POPIS 2.2 i 3.2 doslovno: tabovi kao linkovi na hash, dugmad „Bilten takmičenja“ (`#/bilten?…`) i „Pregled za štampu“ Ctrl+P (`#/stampa?…`; ekran presreće globalnu `stampa` radnju: sluša `keydown` pre App-a ili App emituje `app:stampa` koji ekran hvata i `preventDefault`; izabrati ono što ne menja postojeće ponašanje drugih ekrana), filteri (pol linkovi, select kategorije resetuje program, select programa), legenda, tri tabele sa kolonama i tekstovima, prazna stanja, podnožje; ime je link na `#/rezultati?t&pol&kat&prog`. Rezultati: zaglavlje sa „Rang liste“ (nazad sa filterima), „Otvori karton“ (`#/takmicari?id=`), „Štampaj“ (`window.print()`), tabela po spravama sa precrtanim odbačenim E, red Višeboj, kartica „Sva takmičenja“ sa linkovima `#/rezultati?t&tk` i `izabran` redom; prazno stanje; `ne-stampaj` klase.

- [ ] **Step 1: Testovi** za `rangStanje.js` (hash sa i bez tab, `mestoPodaci` 4 slučaja, širine 92/116 i 100/124 po broju sprava, naziv/skraćenica, podnožje sa i bez ekipno teksta, množina).
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `npm run build`; u aplikaciji nad primer podacima: Rang liste ŽSG višeboj kao slika 09 (Petrović 1, Nikolić 2, Stojanović VK, Jovanović 3, Đorđević na dnu bez zbira), tab sprave, ekipno sa zagradama, MSG sa 6 sprava bez vodoravnog skrola, klik na ime → Rezultati (precrtane E kod Petrović), „Rang liste“ nazad, „Otvori karton“. Step 5: Commit `feat(ekrani): rang liste i rezultati takmicara`.**

### Task 4: Ekrani štampe i biltena, PDF, QA

**Files:**
- Create: `src/stil/stampa.css` (kopija PHP `stampa.css`), `src/ekrani/Stampa.jsx`, `src/ekrani/Bilten.jsx`, `src/ekrani/stampa/{StampaAlat,ListZaglavlje,ListSprava,ListEkipno,ListViseboj,ListDno,BiltenZaglavlje,BiltenTabele}.jsx`, `src/ekrani/stampaStanje.js` (čisto: `kolone(brojSprava, polozeno)`, `mestoTekst(mesto, oznaka)`, `gdeKada(takm)`, `vremeStampe(d)` → `dd.mm.gggg. HH:mm` i `dd.mm. HH:mm`, `imePdf(vrsta, naziv, pol)`, `legendaStampe(takm, tab, pol)`, `legendaBiltena(takm)`)
- Modify: `src/App.jsx` (`stampa`, `bilten` u EKRANI i u novom skupu `CELA_STRANA`: bez `Meni`/`Traka`, `body.stampa` klasa dok je otvoren, `<style>@page{size:A4 landscape;margin:0}</style>` kad je `polozeno`; Ctrl+P po POPIS 9.6: na `rang` → `#/stampa?…`, na `CELA_STRANA` → `app:stampa` koji ekran hvata i zove `gim.stampa.stampaj`, inače `window.print()`), `src/main.jsx` ili `App.jsx` uvozi `src/stil/stampa.css` globalno (POPIS 9.1)
- Test: `tests/stampa-stanje.test.mjs`
- Reference: POPIS 4, 5, 6, 7, 9.1 do 9.4, 9.8; slike `09b-stampa-rang-lista.png`, `09d-bilten-zsg.png`, `09e-bilten-msg.png`; `PHP projekat\app\Pogledi\stampa.php`, `bilten.php`, `okvir_stampa.php`, `public\assets\css\stampa.css`

**Interfaces:**
- Consumes Task 2 (`gim.rang.stampa`, `gim.rang.bilten`, `gim.stampa.stampaj`, `gim.stampa.pdf`), Task 3 `rangStanje` gde se poklapa (`odustaoRec`).
- Ponašanje po POPIS 4.2, 4.3, 5.2 doslovno: alat (Nazad Esc, naslov, „A4 položeno|uspravno · u dijalogu za štampu isključite zaglavlja i podnožja browsera“, „Štampaj Ctrl+P“ → `gim.stampa.stampaj`, plus novo dugme „Sačuvaj PDF“ → `gim.stampa.pdf` → toast „PDF je sačuvan: {putanja}“ ili ništa kad je otkazano); listovi `div.list` sa zaglavljem, tabelama/gridom, legendom na poslednjoj strani, potpisima (štampa), podnožjem; bilten sa velikim zaglavljem na prvoj i malim na ostalim stranama, sekcije sa ponovljenim zaglavljem po `strane`. Esc → `#/rang?…`. Štampa koristi `@media print` iz `stampa.css` (alat sakriven, listovi bez margine).

- [ ] **Step 1: Testovi** za `stampaStanje.js` (kolone za 4/6 sprava uspravno/položeno, mestoTekst, gdeKada sa i bez mesta, vreme, ime PDF-a bez nedozvoljenih znakova, legende sa oba pravila i ekipno dodatkom).
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `npm run build`.**
- [ ] **Step 5: QA kroz aplikaciju** (CDP obrazac): A Rang liste (sva tri taba, filteri, MSG, podnožje), B Rezultati (precrtane E, sva takmičenja, nazad, karton), C Štampa: ŽSG višeboj 1 strana kao slika 09b (zaglavlje, ZVANIČNO, blokovi sa (mesto) D E Odb., legenda, potpisi), sprava, ekipno, MSG položeno 2 strane; „Sačuvaj PDF“ sa patch-ovanim `dialog.showSaveDialog` → PDF fajl postoji, veličina > 10 KB, broj strana (prebroj `/Type /Page` u fajlu); D Bilten ŽSG kao 09d i MSG položen kao 09e, prelom sa ponovljenim zaglavljem (privremeno više prijava ili manji kapacitet nije dozvoljen: proveriti sa primer podacima i zabeležiti broj strana); E Esc i Ctrl+P na ta tri ekrana; F 1366x768 bez vodoravnog skrola na Rang listama i Rezultatima.
- [ ] **Step 6: Commit `feat(ekrani): stampa rang liste, bilten i pdf`.**

---

## Self-review (urađen pri pisanju)

- Pokrivenost POPIS-a: 1 → Task 1; 2.1, 3.1, 4.1, 5.1, 7 → Task 2 (+ prelom u Task 1); 2.2, 3.2, 9.5 do 9.7 → Task 3; 4.2, 4.3, 5.2, 6, 9.1 do 9.4, 9.8 → Task 4; 8 → Task 1 i 2.
- Imena: `izracunaj(takm, pol, kategorijaId, programId)` isto u modelu i IPC-u; `strane` oblik iz `prelom.mjs` isti za IPC i ekrane; `polozeno` svuda boolean.
- Odluke koje nisu iz PHP-a (POPIS 9): ekrani cele strane umesto posebne HTML strane; „Sačuvaj PDF“ dugme (dizajn traži PDF); `izbor` vraća nizove parova umesto PHP mapa (null id); Ctrl+P ostaje `window.print()` osim na Rang listama; Takmičari dobijaju `?id`.
