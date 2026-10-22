# Faza 4: Rotacije (grupe i redosled po rotaciji)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran Rotacije aktivnog takmičenja: kolone „Neraspoređeni“ i po jedna za svaku grupu, prevlačenje i Alt+strelice za premeštanje, redosled po rotaciji sa pravilima iz TOK-PRIPREME (promena važi samo za izabranu rotaciju), nova/izmena/brisanje grupe, pomeranje redosleda, „Završi pripremu“; sve kao u PHP verziji 1.2.0, nad SQLite bazom, sa testovima.

**Architecture:** Čiste funkcije rasporeda (`pozicijaURotaciji`, `redosledURotaciji`, `grupaNaSpravi`) idu u `electron/racun/grupe.mjs` da ih faza 5 (Unos ocena) uveze bez baze. Model `electron/modeli/grupe.cjs` (uzorak faze 2 i 3: `napravi(baza)`, `GreskaKorisnika` sa doslovnim porukama, transakcija za `premesti`). IPC modul `rotacije` vraća ceo paket ekrana jednim pozivom (`podaci(pol, rot)`), kao `prijave.podaci`. Ekran je optimističan kao PHP JS: lokalno stanje se menja odmah (čista funkcija `premestiLokalno`), IPC ide u pozadini, greška vraća podatke sa servera; u rotaciji 2+ posle premeštaja se podaci ponovo učitavaju (dugme „Preuzmi redosled iz rotacije 1“ i slučaj „ne pamti se“). `window.prompt` ne postoji u Electron-u, pa izmena grupe ide kroz `<dialog>`.

**Tech Stack:** Electron 44, React 19, `node:sqlite`, node:test. Bez novih zavisnosti.

**Spec:** Dizajn `docs/superpowers/specs/2026-10-20-gimnastika-electron-design.md`. Ponašanje, doslovne poruke, raspored, tastatura i testovi za prenos: `docs/superpowers/specs/2026-10-22-faza-4-popis-php.md` (dalje: POPIS; zadaci navode odeljke). Slika `PHP projekat\dizajn\slike\07-rotacije.png` prikazuje raspored kolona i kartica; razlike prema kodu su u uvodu POPIS-a. PHP projekat = `C:\Users\bojan\Desktop\Takmicarski program` (samo čitanje).

## Global Constraints

- Repo `C:\Posao\gimnastika`, grana `faza-4` od `main` (f0c1189). Commit po zadatku lokalno; push i merge samo na Bojanov znak. Bez AI atribucije.
- Tekst interfejsa srpski latinicom sa dijakriticima doslovno kao u POPIS-u (navodnici „ “, srednja tačka ` · `); bez em crte (U+2014) igde. Nazivi u kodu srpski bez kvačica, camelCase; kolone snake_case. Fajlovi LF.
- Bez novih zavisnosti. Modeli bacaju `GreskaKorisnika` sa porukama iz POPIS 2.3 i 4.1. Svaka promena se upisuje odmah; rezultati IPC poziva su obični objekti.
- Booleani u SQLite 0/1; pol `M`/`Z`, prikaz `MSG`/`ŽSG`. Sortiranje teksta kolatorom iz `electron/modeli/sortiranje.cjs` (`KOLATOR`), null prvi kao MySQL (POPIS 10.8).
- Tastatura pre miša, fokus vidljiv; ekran `sadrzaj-fiksno` (kolone skroluju, strana ne); staje na 1366x768 bez vodoravnog skrola.
- Testovi: `npm test` čist; modeli nad `otvori(':memory:')` + `migriraj()` + `tokSeme` (`tests/pomoc/seme.cjs`: 2 ženske sprave PR, GR; 1 muška PA; Ana, Bea, Ceca, Dona Ž; Marko M).
- Poruke koje u PHP-u prežive redirect idu kroz `najavi(tekst, vrsta)` (`src/okvir/Poruke.jsx`, flush na hashchange, 6 s); bez aktivnog takmičenja: `obradiNemaAktivnog` iz `src/ekrani/aktivno.js`.

## Review Focus

- Premeštaj unutar iste grupe u rotaciji 1 kad rotacija 2 nema svoj redosled: rotacija 2 mora da ostane kako je bila (zamrzne se), i sa pomeranjem i bez njega (Task 2 test po POPIS 8.3).
- Premeštaj u rotaciji 2 koji vrati redosled na „bez ručnog“ (osnovni uz pomeranje): ručni redosled te rotacije se briše, dugme „Preuzmi redosled iz rotacije 1“ nestaje (Task 2 test po POPIS 8.2, Task 4 ručno).
- Odlazak takmičara u drugu grupu ili u Neraspoređene: nestaje iz svih ručnih redosleda stare grupe, stara grupa se prenumeriše, u novoj je na kraju osnovnog redosleda (Task 2 test).
- Brisanje prijave na ekranu Prijave posle raspoređivanja: kaskada briše `grupa_clanovi` i `grupa_redosled`, `nerasporedjeni` se ne menja (Task 2 test).
- Kartica sakrivena filterom kategorije i dalje zauzima mesto u redosledu: Alt+↓ preko sakrivene kartice i `pozicija` koja se šalje računaju sve kartice (Task 4 test čiste funkcije `premestiLokalno` + ručno).

---

### Task 1: Čiste funkcije rasporeda

**Files:**
- Create: `electron/racun/grupe.mjs`
- Test: `tests/racun-grupe.test.mjs`
- Reference: POPIS 2.1; `PHP projekat\app\Modeli\Grupe.php` (statičke metode), `testovi\TokTest.php` (`test_grupe_i_rotacije` čisti deo, `test_redosled_po_rotaciji` čisti deo)

**Interfaces:**
- Produces: `pozicijaURotaciji(pocetna, rotacija, brojSprava): number`; `redosledURotaciji(clanovi, rotacija, pomeraj, rucni = null): clanovi[]` (ne menja ulaz; `clanovi` bilo koje vrednosti bez `rucni`, sa `rucni` objekti sa `prijava_id`; `rucni` niz brojeva ili null); `grupaNaSpravi(grupe, pozicijaSprave, rotacija, brojSprava, pomeraj): grupa|null` (kopija grupe sa `clanovi` zamenjenim redosledom za tu rotaciju; `grupe[i].rucni` je objekat `{rotacija: id[]}`).
- Consumes: ništa (ESM, bez uvoza).

- [ ] **Step 1: Testovi**: 4 slučaja `pozicijaURotaciji` i `brojSprava 0 → 1`; `redosledURotaciji` 4 slučaja bez ručnog + 3 sa ručnim (POPIS 2.1 doslovno, uključujući poruke „prvi ide na kraj“, „nepoznat id se preskace…“, „prazan rucni redosled…“); `n < 2` vraća kopiju; `grupaNaSpravi` nad dve grupe (`pocetna 1` i `2`, 2 sprave): u rotaciji 2 pozicija 2 → prva grupa sa pomerenim članovima, pozicija 1 → druga grupa, pozicija 3 → null; ručni redosled rotacije 2 ima prednost.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi. Step 5: Commit `feat(racun): raspored grupa po rotaciji`.**

### Task 2: Model Grupe i pomeranje takmičenja

**Files:**
- Create: `electron/modeli/grupe.cjs`
- Modify: `electron/modeli/takmicenja.cjs` (dodaj `postaviPomeraj(id, vrednost)`: `UPDATE takmicenja SET pomeraj_redosled = vrednost ? 1 : 0, izmenjeno`; `Takmičenje ne postoji.` za nepoznat id)
- Test: `tests/modeli-grupe.test.cjs`
- Reference: POPIS 1, 2.2, 2.3, 2.4, 8.1 do 8.4; `PHP projekat\app\Modeli\Grupe.php`, `testovi\TokTest.php`

**Interfaces:**
- Produces `napravi(baza) → { nadji(id), lista(takmicenjeId, pol): grupa[] (svaka sa clanovi: red[], rucni: {rotacija: number[]}), rucniRedosledi(grupaId), clanovi(grupaId): red[] (polja POPIS 2.2), nerasporedjeni(takmicenjeId, pol): red[] (sortirano POPIS 10.8), brojSprava(pol): number (max(1, COUNT)), dodaj(takmicenjeId, pol): number, izmeni(takmicenjeId, id, naziv, pocetnaPozicija): void, obrisi(takmicenjeId, id): void, premesti(takmicenjeId, prijavaId, grupaId|null, pozicija, rotacija = 1): void, vratiRedosled(takmicenjeId, grupaId, rotacija): void }` sa porukama POPIS 2.3 doslovno (`Nepoznat pol.`, `Grupa ne postoji.`, `Naziv grupe je obavezan.`, `Početna sprava mora biti između 1 i {n}.`, `Grupa ima {n} takmičara. Prvo je ispraznite.`, `Prijava ne postoji.`, `Grupa ne postoji ili nije za taj pol.`, `Rotacija mora biti između 1 i {n}.`). `premesti` koristi `redosledURotaciji` iz Task 1; `.mjs` se iz CJS učitava sa `require('../racun/grupe.mjs')` kao `priprema.mjs` u `prijave.cjs` (Node 22.12+ require(esm)).
- Consumes: Task 1; `baza.cjs` (`transakcija`, `svi`, `jedan`, `vrednost`, `izvrsi`, `ubaci`, `izmeni`, `Baza.sad()`), `sortiranje.cjs`, `tests/pomoc/seme.cjs`, `prijave.cjs` (`dodajVise` u testovima).

- [ ] **Step 1: Testovi**: port POPIS 8.1 (deo nad bazom), 8.2 i 8.3 u celini, sa istim očekivanim nizovima (pomoćna `uRot(grupaId, rot, pomeraj)` kao u PHP-u); plus 8.4: naziv sa brojem kad je slovo zauzeto (dodaj A, B; obrisi A; dodaj → `n = 1` → slovo B zauzeto → „Grupa B2“), treća grupa uz 2 sprave ima `pocetna_pozicija 1`; `izmeni` tri greške i uspeh sa trim-om; `redosled` nove grupe je `n + 1` (posle brisanja može da ponovi vrednost; `lista` ostaje stabilna po `redosled, id`); `premesti` greške: prijava tuđeg takmičenja, grupa drugog pola (Marko u žensku grupu), rotacija 0 i 3; `pozicija` 99 → na kraj, −5 → na početak; premeštaj u rotaciji 1 u DRUGU grupu ne zamrzava rotaciju 2 (POPIS 2.4); zamrzavanje upisuje redosled i kad je jednak pomerenom, pa kasnija promena `pomeraj_redosled` ne menja zamrznutu rotaciju; `nerasporedjeni` redosled sa null kategorijom prvom; brisanje prijave (`prijave.obrisi`) briše iz `grupa_clanovi` i `grupa_redosled`; `takmicenja.postaviPomeraj` menja polje i `izmenjeno`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi. Step 5: Commit `feat(modeli): grupe i redosled po rotaciji`.**

### Task 3: IPC `rotacije`

**Files:**
- Modify: `electron/api.cjs` (MODULI `rotacije: ['podaci','dodaj','izmeni','obrisi','premesti','vrati','pomeraj','zavrsi']`), `electron/moduli.cjs`
- Test: `tests/ipc-faza4.test.cjs` (guard + oblici rezultata, kao `tests/ipc-faza3.test.cjs`)
- Reference: POPIS 3, 4.1, 4.2, 10.2, 10.6, 10.7

**Interfaces:**
- Produces (sve nad aktivnim takmičenjem, `Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.` kad ga nema; id-jevi kroz `broj()`):
  - `podaci(pol, rot)` → `{ takm: {id, naziv, pomeraj_redosled}, pol ('Z' podrazumevano, sve osim M/Z → Z), rot (clamp 1..brojSprava), brojSprava, sprave: [{id, naziv, skracenica, redosled}], kombinacije: [{kid, kat, pid, prog}] (null → null, ključ `kp` = `${kid|0}-${pid|0}` računa renderer), pomeraj: boolean, grupe: [{id, naziv, redosled, pocetna_pozicija, sprava: {id, naziv}|null, clanovi (osnovni redosled), redosled_rot: red[] (za izabranu rotaciju), rucni_rot: boolean, rucni_rotacije: number[]}], nerasporedjeni: red[], stanje: stanjePripreme }`.
  - `dodaj(pol)` → `{grupa}`; `izmeni(id, naziv, pocetnaPozicija)`; `obrisi(id)`; `premesti(prijavaId, grupaId (0|null = neraspoređeni), pozicija, rotacija)` (`max(1, Number(rotacija))`); `vrati(id, rotacija)`; `pomeraj(vrednost)` (truthy kao PHP `!empty`: `'0'`, `''`, `0`, `false`, `null` → 0); `zavrsi()` → `{stanje, poruka: {tekst, vrsta}|null, ide: 'prijave'|'takmicenje'}` po POPIS 4.1 (renderer radi `najavi` i hash).
- Consumes: Task 1, Task 2, `prijave.cjs` (`stanjePripreme`), `sifarnici.cjs` (`sprave(pol)` ili lista sprava po polu: proveri ime), `podesavanja.cjs` (`aktivno`).

- [ ] **Step 1: Testovi**: guard prolazi sa novim modulom; `podaci('X', 9)` nad semenom sa 2 grupe → `pol 'Z'`, `rot 2`, `brojSprava 2`, grupe sa `sprava` po `pozicijaURotaciji`, `redosled_rot` i `rucni_rot`; `kombinacije` sa null parom; `premesti` sa string id-jevima; `pomeraj('0')` → 0, `pomeraj(true)` → 1; `zavrsi` tri slučaja (0 prijava → `ide 'prijave'` + poruka upozorenje; neraspoređeni > 0 → poruka upozorenje + `ide 'takmicenje'`; svi raspoređeni → poruka ok); bez aktivnog → poruka; `structuredClone(podaci)` radi.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_DEBUG=1` start bez greške guard-a. Step 5: Commit `feat(ipc): rotacije`.**

### Task 4: Ekran Rotacije

**Files:**
- Create: `src/ekrani/Rotacije.jsx` (kontejner: učitavanje, IPC, tastatura), `src/ekrani/rotacije/RotTraka.jsx` (pol, filter, rotacija, pomeraj, Nova grupa), `src/ekrani/rotacije/RotKolona.jsx` (zaglavlje grupe/neraspoređenih + lista), `src/ekrani/rotacije/RotKartica.jsx`, `src/ekrani/rotacije/DijalogGrupa.jsx`, `src/ekrani/rotacijeStanje.js` (čisto)
- Modify: `src/App.jsx` (`rotacije` u EKRANI i u FIKSNO), `src/stil/app.css` samo ako nedostaje klasa (`.rot-*` postoje, POPIS 5.3; dodaj pravila za `#rot-traka` i podnožje umesto inline stilova iz PHP-a)
- Test: `tests/rotacije-stanje.test.mjs`
- Reference: POPIS 4.2, 5, 6, 7, 10; `PHP projekat\app\Pogledi\rotacije.php`, `public\assets\js\rotacije.js`; slika `07-rotacije.png`

**Interfaces:**
- `rotacijeStanje.js` produces: `kp(c): string` (`${kategorija_id|0}-${program_id|0}`), `imeKartice(c): string` (`Prezime P.` sa prvim kodnim znakom imena), `naslovKartice(c)`, `premestiLokalno(stanje, prijavaId, grupaId (0 = neraspoređeni), pozicija): stanje` (nova kopija: kartica ide iz svoje kolone na indeks `pozicija` među svim karticama ciljne kolone; brojevi se ne čuvaju, renderer numeriše), `indeksZaAltStrelice(stanje, prijavaId, taster): {grupaId, pozicija}|null` (↑/↓ unutar kolone, ←/→ na kraj susedne kolone, Neraspoređeni su kolona 0), `hashRotacija(pol, rot, kp): string` (`#/rotacije?pol=Z&rot=2&kp=1-2`, prazan `kp` se izostavlja).
- Ekran consumes Task 3 (`gim.rotacije.*`), `Koraci`, `najavi`/`obavesti`, `obradiNemaAktivnog`, `razlozi(hash).parametri` (`pol`, `rot`, `kp`).
- Ponašanje (POPIS 5 i 6 doslovno): pol i rotacija su linkovi na hash; `#filter-kp` menja hash `kp`; kartica `li.rot-kartica[draggable][tabindex=0]` sa `hvataljka`, brojem (samo u grupi), `imeKartice` (+ čip `VK`), `klub_skr`, `title`, klasa `sakriveno` po filteru; HTML5 drag and drop sa senkom (`rot-senka`) i `rot-cilj` na ciljnoj koloni, `drop` računa `pozicija` kao PHP (broj kartica pre senke bez vučene); klik/fokus bira karticu (`izabran`); Alt+strelice kroz `indeksZaAltStrelice` → `premesti`; posle `premesti`: lokalno stanje odmah (`premestiLokalno`), IPC; uspeh u rotaciji 1 → samo `stanje` (Koraci), u rotaciji 2+ → `podaci` ponovo i fokus na istu karticu; greška → toast (ostaje vidljiv, za razliku od PHP `reload`-a) + `podaci` ponovo. Kao PHP, IPC se zove i kad mesto nije promenjeno (bez prečice). `stanje.nerasporedjeni` u Koracima broji oba pola, brojač kolone samo izabrani pol (POPIS 7). Zaglavlje grupe: naziv (`title="Dupli klik za izmenu"`, dupli klik otvara dijalog), brojač, olovka (dijalog), kanta samo kad je grupa prazna (`confirm('Obrisati grupu „{naziv}“?')`), čip sprave (`status-info`) ili `–`, dugme `vracanje` kad `rucni_rot` (`confirm('Preuzeti redosled iz rotacije 1 za grupu „{naziv}“ u rotaciji {rot}? Sadašnji redosled te rotacije se briše.')`). `DijalogGrupa`: naslov „Grupa“, polje „Naziv grupe“ (autofokus, selektovan tekst), „Početna sprava u rotaciji 1“ kao `select` 1..brojSprava sa tekstom `"{r} · {naziv sprave}"`, dugmad „Sačuvaj“ kbd Enter i „Otkaži“ kbd Esc, greška modela u dijalogu; posle uspeha `podaci` ponovo. Kućica pomeranja → `pomeraj` → `podaci` ponovo. „Nova grupa“ → `dodaj(pol)` → `podaci` ponovo; fokus ostaje na dugmetu (PHP ne fokusira novu grupu). Podnožje: legenda doslovno (sa `rot` u tekstu) i „Završi pripremu“ → `zavrsi()` → `najavi(poruka)` ako je ima → hash `#/prijave` ili `#/takmicenje`. Bez toasta „Sačuvano.“ na ovom ekranu.

- [ ] **Step 1: Testovi** za `rotacijeStanje.js`: `kp` sa null → `0-0`; `imeKartice` (`Laudis Nanaši`, `Dragan` → `Laudis Nanaši D.`; prazno ime → `Prezime .`, isto kao PHP `mb_substr('', 0, 1)`); `premestiLokalno` unutar kolone gore/dole, u drugu kolonu na kraj, iz Neraspoređenih na indeks 0, pozicija preko kraja → na kraj, sakrivene kartice se broje; `indeksZaAltStrelice` 4 tastera na krajevima (ništa) i u sredini; `hashRotacija`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `npm run build`; u aplikaciji nad primer podacima (Task 5 ili ručne grupe): kolone se vide, Alt+strelice rade, prevlačenje radi, dijalog grupe radi, Završi pripremu vodi dalje; uporedi sa `07-rotacije.png` na 1366x768. Step 5: Commit `feat(ekrani): rotacije`.**

### Task 5: Primer podaci (grupe) i QA

**Files:**
- Modify: `alati/primer-podaci.cjs` (za `Jesenji kup 2026`: po polu dve grupe `Grupa A`/`Grupa B` kroz model, članovi po startnom broju naizmenično; idempotentno: preskače ako takmičenje već ima grupe tog pola), `README.md` (jedan red)
- Test: `tests/alati-primer.test.cjs` (dopuna: grupe po polu, svi raspoređeni, drugi prolaz ne duplira)
- Reference: Task 2 model

- [ ] **Step 1: Test. Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_PODACI=<temp> node alati/primer-podaci.cjs` dva puta. Step 5: Commit `feat(alati): primer grupe`.**
- [ ] **Step 6: QA kroz aplikaciju** (CDP obrazac iz faze 3, `qa-app.md`): scenariji A (prikaz i filter), B (Alt+strelice u rotaciji 1 i 2, provera „Preuzmi redosled“ dugmeta), C (prevlačenje preko `Input.dispatchDragEvent` ili, ako ne radi, zabeležiti kao neizvedeno), D (nova grupa, izmena kroz dijalog, brisanje prazne i pune), E (pomeranje redosleda), F (Završi pripremu u tri stanja), G (1366x768 bez vodoravnog skrola, kolone skroluju).

---

## Self-review (urađen pri pisanju)

- Pokrivenost POPIS-a: 2.1 → Task 1; 1, 2.2 do 2.4, 8 → Task 2; 3, 4.1, 4.2 → Task 3; 5, 6, 7, 10 → Task 4; 9 (faza 5 i 7 korisnici) samo kroz `racun/grupe.mjs` javni API. Nema zadatka za migracije: tabele već postoje (POPIS 1).
- Imena: `premesti(takmicenjeId, prijavaId, grupaId|null, pozicija, rotacija)` isto u modelu i IPC-u (IPC prima 0 za neraspoređene i pretvara u null); `vratiRedosled` u modelu, `vrati` u IPC-u; `postaviPomeraj` u modelu, `pomeraj` u IPC-u.
- Odluke koje nisu iz PHP-a: dijalog umesto `prompt` (POPIS 10.1); `select` sprava umesto broja u dijalogu (čitljivije; vrednost koja se šalje je isti redni broj); primer podaci dobijaju grupe (PHP alat ih nema) radi probe faze 4 i 5.
