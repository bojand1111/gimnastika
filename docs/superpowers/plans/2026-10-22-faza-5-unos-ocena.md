# Faza 5: Unos ocena

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran Unos ocena aktivnog takmičenja: izbor pola, sprave i rotacije (podrazumevano „gde se stalo“), grupa na spravi redom nastupa, red po takmičaru sa D, E1..EN, E, odbitak, konačna i statusom; nacrt se čuva pri napuštanju polja, Enter na odbitku potvrđuje, ispravka sa razlogom i zapisom, odustajanje i vraćanje, kartica poslednjih izmena; sve kao u PHP verziji 1.2.0, nad SQLite bazom, sa testovima.

**Architecture:** Model `electron/modeli/ocene.cjs` (uzorak faza 2 do 4: `napravi(baza, podesavanja)`, `GreskaKorisnika` sa doslovnim porukama, transakcija za upis) nad celim brojevima iz `electron/racun/{broj,ocena}.mjs` (faza 1). Čista funkcija `opisIzmene` i `napredak` logika idu u `electron/racun/izmene.mjs` i `electron/racun/napredak.mjs` da ih faze 6 i 7 uvezu bez baze. IPC modul `unos` vraća ceo paket ekrana jednim pozivom (`podaci(pol, spravaId, rot)`) i izvršava kontrolerov izbor „gde se stalo“. Ekran drži redove u lokalnom stanju (tekst polja, status, ispravlja), računa E i konačnu odmah čistim funkcijama, čuva nacrt IPC-om sa odlaganjem 300 ms, a potvrda primenjuje `prikaz` iz odgovora; razlog ispravke ide kroz `<dialog>` (nema `window.prompt`).

**Tech Stack:** Electron 44, React 19, `node:sqlite`, node:test. Bez novih zavisnosti.

**Spec:** Dizajn `docs/superpowers/specs/2026-10-20-gimnastika-electron-design.md`. Ponašanje, doslovne poruke, raspored, tastatura i testovi za prenos: `docs/superpowers/specs/2026-10-22-faza-5-popis-php.md` (dalje: POPIS; zadaci navode odeljke). Slika `PHP projekat\dizajn\slike\08-unos-ocena.png` odgovara kodu (razlike u uvodu POPIS-a). PHP projekat = `C:\Users\bojan\Desktop\Takmicarski program` (samo čitanje).

## Global Constraints

- Repo `C:\Posao\gimnastika`, grana `faza-5` od `main`. Commit po zadatku lokalno; push i merge samo na Bojanov znak. Bez AI atribucije.
- Tekst interfejsa srpski latinicom sa dijakriticima doslovno kao u POPIS-u (navodnici „ “, srednja tačka ` · `, strelica `→` u opisu izmene, minus `−` u „D + E − odbitak“); bez em crte (U+2014) igde. Nazivi u kodu srpski bez kvačica, camelCase; kolone snake_case. Fajlovi LF.
- Ocene su celi brojevi u hiljaditim delovima (`broj.mjs`), nikad float; u SQLite INTEGER; JSON snimci u `izmene_ocena` sadrže cele brojeve (POPIS 0.1). Računanje samo kroz `electron/racun/{broj,ocena}.mjs` (`izUnosa`, `prikaz`, `izBaze`, `konacnaE`, `konacna`); renderer uvozi iste funkcije, ne duplira ih.
- Modeli bacaju `GreskaKorisnika` sa porukama iz POPIS 2.2 do 2.4 doslovno. Svaka promena se upisuje odmah; rezultati IPC poziva su obični objekti.
- Status ocene: `nacrt`, `uneto`, `ispravljeno`, `odustao`; `ne_radi` postoji samo u prikazu.
- Tastatura pre miša, fokus vidljiv; ekran `sadrzaj-fiksno` (tabela skroluje, strana ne); staje na 1366x768 bez vodoravnog skrola sa 6 E sudija.
- Testovi: `npm test` čist; modeli nad `otvori(':memory:')` + `migriraj()` + `tokSeme` (`tests/pomoc/seme.cjs`: 4 E sudije, `pravilo_e odbaci_krajnje`, sprave PR i GR za Ž, PA za M); prijave preko `prijave.dodajVise`, grupe preko `grupe.dodaj/premesti`.
- Poruke koje u PHP-u prežive reload idu kroz `obavesti` (ekran se ne menja) ili `najavi` kad se menja hash; bez aktivnog takmičenja: `obradiNemaAktivnog` iz `src/ekrani/aktivno.js`.

## Review Focus

- Nacrt poslat preko unete ocene (zakasneli `focusout` posle potvrde): model vraća postojeću ocenu nepromenjenu, red ostaje `uneto` (Task 1 test; Task 4 ručno: potvrdi pa odmah Tab).
- Potvrda sa `8,3` i `8.3` u istom redu: oba postaju `8,300`, E i konačna po pravilu takmičenja, prazan odbitak upisan kao 0 (Task 1 test, Task 3 test `proveriPolje`).
- Ispravka unete ocene: bez razloga odbijena, sa razlogom `status ispravljeno`, `broj_ispravki` 1, zapis sa opisom `E2 8,100 → 7,900 · konačna 13,050 → 12,950` (Task 1 test, Task 4 ručno kroz dijalog).
- Odustajanje nad unetom ocenom briše brojeve, pravi zapis „Označeno odustajanje“; „Vrati“ vraća u nacrt sa praznim poljima (Task 1 test, Task 4 ručno).
- Takmičar koji ne radi spravu: prugasti red bez polja, ne broji se u napredak, strelice ga preskaču, model odbija ocenu porukom `{Prezime} {Ime} nije prijavljen/a na ovu spravu.` (Task 1 test, Task 2 test redova, Task 4 ručno).

---

### Task 1: Model Ocene i čiste funkcije izmena i napretka

**Files:**
- Create: `electron/modeli/ocene.cjs`, `electron/racun/izmene.mjs` (`opisIzmene(staro, novo)`, `snimak(o)`), `electron/racun/napredak.mjs` (`napredak(ocene, grupe, sprave, radiSpravu)`: čisto, bez baze; `radiSpravu(prijavaId, spravaId)` je funkcija)
- Test: `tests/modeli-ocene.test.cjs`, `tests/racun-izmene.test.mjs`, `tests/racun-napredak.test.mjs`
- Reference: POPIS 0.1, 0.2, 1, 2 (2.1 do 2.5), 8.1, 8.3; `PHP projekat\app\Modeli\Ocene.php`, `testovi\TokTest.php`

**Interfaces:**
- `izmene.mjs` produces: `snimak(o) → {d, e, odbitak, konacna, status, e_sudije: {sudija: vrednost}}` (celi brojevi ili null), `opisIzmene(staro, novo) → string` (POPIS 2.1; prazna vrednost se prikazuje kao `''`).
- `napredak.mjs` produces: `napredak(ocene, grupe, sprave, radiSpravu) → {rotacija, ukupno_rotacija, obradjeno, ukupno, gotovo}` gde je `ocene = {prijava_id: {sprava_id: {status}}}`, `grupe` iz `grupe.lista` (sa `clanovi` i `pocetna_pozicija`), `sprave` po redosledu; koristi `pozicijaURotaciji` iz `racun/grupe.mjs`.
- `ocene.cjs` produces `napravi(baza, podesavanja) → { nadji(prijavaId, spravaId), zaSpravu(spravaId, prijavaIds): {pid: ocena}, zaTakmicenje(takmicenjeId): {pid: {sid: ocena}}, izmeneNaSpravi(takmicenjeId, spravaId, limit = 5): red[] (sa ime, prezime, staro, novo, opis), napredak(takmicenjeId, pol, grupe, sprave): rezultat napredak.mjs (čita prijava_sprave), sacuvaj(takmicenjeId, prijavaId, spravaId, ulaz, potvrdi, razlog = ''): {ocena, prikaz}, odustao(takmicenjeId, prijavaId, spravaId): {ocena, prikaz}, vrati(takmicenjeId, prijavaId, spravaId): {ocena, prikaz}, radiSpravu(prijavaId, spravaId): boolean }` sa porukama POPIS 2.2 do 2.4 doslovno (`Takmičenje ne postoji.`, `Prijava ne postoji na ovom takmičenju.`, `{Prezime} {Ime} nije prijavljen/a na ovu spravu.`, `{naziv}: neispravna vrednost „{tekst}“ (0 do 20, najviše tri decimale).`, `Unesite D ocenu.`, `Unesite sve E ocene ({n}).`, `Za ispravku unete ocene obavezan je razlog.`, `Nema šta da se vrati.`). `prikaz` = `{d, e, odbitak, konacna: tekst ili '', e_sudije: tekst[] po sudiji 1..N, status, broj_ispravki}`. Vrednosti u bazi su celi brojevi (bez `uBazu`).
- Consumes: `racun/{broj,ocena,grupe}.mjs`, `podesavanja.cjs` (`daj('e_zaokruzivanje')`), `baza.cjs`, `greska.cjs`; testovi koriste `prijave.cjs` (`dodajVise`, `postaviSpravu`) i `grupe.cjs`.

- [ ] **Step 1: Testovi**: `racun-izmene`: `opisIzmene` za primer iz 8.1 (`E2 8,100 → 7,900 · konačna 13,050 → 12,950`), D i odbitak promena, `označeno odustajanje`, obrisana vrednost (`E1 8,300 → `), bez razlike → `''`; `racun-napredak`: 2 grupe, 2 sprave, rotacija u toku 1 pa 2, `gotovo` tek kad je sve uneto i `ukupno > 0`, neraspoređeni i članovi koji ne rade spravu se ne broje, `odustao` se broji kao obrađeno; `modeli-ocene`: port POPIS 8.1 u celini (iste tvrdnje, `konacna` u bazi 13050), plus 8.3: nacrt nad `odustao` ostavlja status `odustao` i upisuje brojeve; `odustao` nad unetom pravi zapis sa opisom koji sadrži `označeno odustajanje`; `vrati` bez ocene baca; prijava drugog takmičenja baca; `zaSpravu([])` = `{}`; `izmeneNaSpravi` vraća najviše 5, najnovije prvo; `zaTakmicenje` oblik; `napredak` modela nad semenom.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi. Step 5: Commit `feat(modeli): ocene, izmene i napredak`.**

### Task 2: IPC `unos`

**Files:**
- Modify: `electron/api.cjs` (MODULI `unos: ['podaci','nacrt','potvrdi','odustao','vrati']`), `electron/moduli.cjs`
- Test: `tests/ipc-faza5.test.cjs` (guard + oblici rezultata, kao `tests/ipc-faza4.test.cjs`)
- Reference: POPIS 3, 4, 10.4, 10.6

**Interfaces:**
- Produces (sve nad aktivnim takmičenjem, `Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.`; id-jevi kroz `broj()`):
  - `podaci(pol, spravaId, rot)` → `{ takm: {id, naziv, broj_e_sudija, pravilo_e, pomeraj_redosled}, pol, sprave: [{id, naziv, skracenica, ikona}], sprava: {id, naziv, ikona}|null, rot, brojSprava, grupa: {id, naziv}|null, redovi: [{rb, prijava_id, startni_broj, ime, pol, opis, vk, radi, status, d, e_sudije: tekst[], e, odbitak, konacna}], napredak: {obradjeno, ukupno, odustalo}, izmene: [{id, vreme, razlog, ime, prezime, opis}], bezGrupa, brojSudija, pravilo, zaokruzivanje, prvi: prijava_id|null }` tačno po POPIS 4 (podrazumevani pol, rotacija iz `napredak`, sprava „gde se stalo“, `bezGrupa` lista svih prijavljenih sa redosledom POPIS 4.7 sortiranim u JS null-last po startnom broju pa prezime, ime kolatorom). Kad pol nema sprava: `sprava null`, `sprave []`, `rot 1`, `brojSprava 1`, `redovi []`, `napredak {0,0,0}`, `izmene []`, `bezGrupa true`.
  - `nacrt(prijavaId, spravaId, ulaz)` → `{ocena, prikaz}` (`ulaz = {d, e: tekst[], odbitak}`); `potvrdi(prijavaId, spravaId, ulaz, razlog)` → isto; `odustao(prijavaId, spravaId)`; `vrati(prijavaId, spravaId)`.
- Consumes: Task 1, `grupe.cjs` (`lista`), `racun/grupe.mjs` (`grupaNaSpravi`), `sifarnici.cjs` (`sprave(pol)`), `podesavanja.cjs`, `prijave.cjs` nije potreban.

- [ ] **Step 1: Testovi**: guard; `podaci()` bez parametara nad semenom sa grupom A (Ana, Bea, Ceca) i prijavom Dona bez grupe: `pol 'Z'`, `rot 1`, `sprava` = PR (prva sa grupom), `redovi` 3 sa `rb 1..3`, `status 'nacrt'`, `e_sudije` 4 prazna, `prvi` = prva prijava; posle unosa svih na PR: `podaci()` bira GR (prva sprava sa nezavršenim); `podaci('M')` bez grupa i sa prijavom Marko: `bezGrupa true`, `grupa.naziv 'Svi prijavljeni'`; `podaci('Z', 999, 9)`: sprava PR, `rot` iz napretka; član koji ne radi spravu: `radi false`, `status 'nacrt'`, `napredak.ukupno` bez njega; `nacrt`/`potvrdi`/`odustao`/`vrati` prolaze sa string id-jevima i vraćaju `prikaz`; greške modela stižu kao GreskaKorisnika; `structuredClone(podaci)`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_DEBUG=1` start bez greške guard-a. Step 5: Commit `feat(ipc): unos ocena`.**

### Task 3: Čista logika ekrana

**Files:**
- Create: `src/ekrani/unosStanje.js`
- Test: `tests/unos-stanje.test.mjs`
- Reference: POPIS 6 (preracunaj, proveriPolje, sledeciOtvoren, polja, početni fokus, napredak), 10.3, 10.6

**Interfaces:**
- Produces: `polja(brojSudija) → ['d','e1',...,'odbitak']`; `proveriPolje(tekst) → {ok: boolean, vrednost: number|null, prikaz: string}` (prazno → ok, null, ''; neispravno → ok false); `preracunaj(red, brojSudija, pravilo, zaokruzivanje) → {e: string, konacna: string}` (`'–'` kad nema; prazan odbitak = 0; koristi `izUnosa`, `konacnaE`, `konacna` iz `electron/racun`); `podaciReda(red, brojSudija) → {d, e: tekst[], odbitak}` (trim); `sledeciOtvoren(redovi, i) → indeks|null` (kružno po `status === 'nacrt'`); `sledecePolje(polja, ime, smer) → ime|null`; `sledeciRedSaPoljem(redovi, i, ime, smer) → indeks|null` (preskače redove bez polja ili sa zaključanim poljem: `ne_radi`, `odustao`, `uneto`/`ispravljeno` bez `ispravlja`); `prvoPraznoPolje(red, polja) → ime` (ili `'d'`); `pocetniFokus(redovi, pamtiPrijava) → indeks|null`; `napredakIzRedova(redovi) → {obradjeno, ukupno, odustalo}`; `tekstOdustalo(n, pol) → ' · n odustala|odustao'|''`; `procenat(obradjeno, ukupno)`; `hashUnos(pol, spravaId, rot)`; `odustaoRec(pol)`.
- Red u stanju ekrana: `{prijava_id, status ('nacrt'|'uneto'|'ispravljeno'|'odustao'|'ne_radi'), ispravlja: boolean, greskaCuvanja: boolean, vrednosti: {d, e1.., odbitak} tekst, greske: Set polja, e, konacna, ...prikazni podaci}`; `primeniPrikaz(red, prikaz) → red` (iz odgovora IPC-a).

- [ ] **Step 1: Testovi** za svaku funkciju sa vrednostima iz POPIS-a: `proveriPolje('8,3')` → `8,300`; `'25'` → ok false; `preracunaj` sa primerom 4,800 + (8,300 8,100 8,400 8,200) → `e '8,250'`, `konacna '13,050'`; nepotpune E → `'–'`; odbitak prazan = 0, `'0,1'` → `12,950`; `sledeciOtvoren` kružno; `sledeciRedSaPoljem` preskače `ne_radi` i zaključane; `pocetniFokus` sa pamćenjem i bez; `napredakIzRedova` bez `ne_radi`; `tekstOdustalo(1, 'Z')` → `' · 1 odustala'`; `hashUnos`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi. Step 5: Commit `feat(ekrani): logika unosa ocena`.**

### Task 4: Ekran Unos ocena

**Files:**
- Create: `src/ekrani/Unos.jsx` (kontejner: učitavanje, IPC, globalne F8/F9/Esc, nacrt sa odlaganjem), `src/ekrani/unos/UnosTraka.jsx` (pol, sprave, rotacije, napredak), `src/ekrani/unos/UnosRed.jsx` (jedan red: polja, status, dugmad), `src/ekrani/unos/UnosIzmene.jsx` (Prečice + Izmene kartice), `src/ekrani/unos/DijalogRazlog.jsx`
- Modify: `src/App.jsx` (`unos` u EKRANI i FIKSNO), `src/okvir/Meni.jsx` samo ako naslov nedostaje (`Unos ocena` postoji), `src/stil/app.css` (klase za traku, zaglavlje kartice, napredak i dve donje kartice umesto inline stilova; `.unos-*` postoje), `src/precice.js` + `tests/precice.test.mjs` (F2 i F4 rade i kad je fokus u polju, POPIS 7 i 10.15; ostale prečice nepromenjene)
- Reference: POPIS 4, 5 (5.1 do 5.4), 6, 7, 10; `PHP projekat\app\Pogledi\unos.php`, `public\assets\js\unos.js`; slika `08-unos-ocena.png`

**Interfaces:**
- Consumes Task 2 (`gim.unos.*`), Task 3, `Koraci` NE (ovaj ekran nema traku koraka), `obavesti`, `najavi`, `obradiNemaAktivnog`, `razlozi(hash).parametri` (`pol`, `sprava`, `rot`), `Ikona` (ikone `sprava-*`, `kvacica`, `olovka`, `iks`).
- Ponašanje (POPIS 5 i 6 doslovno): hash bez parametara → `podaci()` bira i renderer upiše `hashUnos(pol, sprava.id, rot)` sa `history.replaceState` (bez novog učitavanja); linkovi pola/sprave/rotacije menjaju hash (pol bez sprave i rotacije); grid kolone iz formule POPIS 5; redovi po tipu (`ne_radi` pruga, `odustao` pruga + čip + „Vrati“, inače polja); zaključana polja `readOnly tabIndex −1` i u njima se Enter/Tab ne obrađuju (POPIS 10.11); trenutni red (`trenutni`) po fokusu, sa dugmetom „Odustala|Odustao F8“ u statusu dok je `nacrt` ili `ispravlja`; `input` → `preracunaj`; `focusout` → `proveriPolje` + nacrt (300 ms po redu, samo `status nacrt`; greška → `greskaCuvanja`, toast `Nije sačuvano: …`, dugme „Pokušaj ponovo“); tastatura u polju tačno po POPIS 6 (Enter/Tab/Shift+Tab/strelice, Enter na odbitku = potvrdi, Tab na odbitku = D sledećeg otvorenog); `potvrdi`: provera svih polja („Ispravite crveno označena polja.“), za `ispravlja` otvori `DijalogRazlog` („Razlog ispravke (obavezno):“, prazno → „Razlog je obavezan.“), IPC `potvrdi` → `primeniPrikaz`; sa razlogom → ponovo `podaci` (osvežava Izmene) i fokus ostaje na tom redu; bez razloga → fokus na D sledećeg otvorenog ili toast „Svi redovi u ovoj grupi su obrađeni.“; greška → toast + fokus D; „Ispravi“/F9 → `ispravlja` (polja otključana, čip „Ispravka“, fokus D); Esc u `ispravlja` → odustani od ispravke (ponovo `podaci`); „Vrati“ → IPC → ponovo `podaci`; F8/dugme → `confirm('{Prezime Ime} je odustala|odustao na ovoj spravi?')` → IPC → ponovo `podaci` sa fokusom na sledećem otvorenom; napredak u traci iz `napredakIzRedova` posle svake promene; kartica Izmene sa vremenom `HH:mm` lokalno; prazna stanja POPIS 5.2; naslov kartice sa ikonom sprave.

- [ ] **Step 1: Testovi**: Task 3 pokriva čistu logiku; ovde dodaj `tests/unos-stanje.test.mjs` slučaj za `primeniPrikaz` ako nije u Task 3.
- [ ] **Step 2: Napiši. Step 3: `npm test` i `npm run build` prolaze; u aplikaciji nad primer podacima (Task 5 ili ručno): unos jednog reda do potvrde, Tab/Enter tok, strelice, F8 odustajanje i Vrati, F9 ispravka sa dijalogom i zapis u kartici Izmene, promena sprave i rotacije, 1366x768 sa 4 sudije; uporedi sa `08-unos-ocena.png`. Step 4: Commit `feat(ekrani): unos ocena`.**

### Task 5: Primer podaci (ocene) i QA

**Files:**
- Modify: `alati/primer-podaci.cjs` (ocene iz JSON-a: za svaku prijavu `Jesenji kup 2026` bez reda u `ocene` na toj spravi: `odustao` → `ocene.odustao`; inače `sacuvaj(..., potvrdi true)` sa `d`, `odbitak` i E sudijama = `e_sudije_primer.po_spravi` za tog takmičara, a za ostale sve četiri sudije jednake `e` (prosek i odbaci_krajnje daju isto `e`, pa `konacna` iz JSON-a mora da se poklopi); idempotentno; `rez.ocena`, `rez.ocena_novih`; izlaz CLI), `README.md` (jedan red)
- Test: `tests/alati-primer.test.cjs` (dopuna: broj ocena = broj parova (prijava, sprava) iz JSON-a, `konacna` svake jednaka JSON `konacna` u hiljaditim, Petrović E iz sudija = 8,250 na GR, odustali imaju `status odustao`, drugi prolaz ne menja ništa)
- Reference: Task 1 model; JSON `docs/proizvod/dizajn/primer-podaci.json` (`zsg_kadet_c.takmicari[].ocene[SKR]`, `e_sudije_primer`)

- [ ] **Step 1: Test. Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; CLI dva puta. Step 5: Commit `feat(alati): primer ocene`.**
- [ ] **Step 6: QA kroz aplikaciju** (CDP obrazac): A prikaz i „gde se stalo“ (sa primer ocenama sve je uneto: proveri izbor sprave/rotacije i čip „Uneto“ na redovima), B nov red: obriši jednu ocenu skriptom ili koristi grupu sa nacrtom, unos D/E/odbitak tastaturom do potvrde (Enter na odbitku), fokus na sledećeg, C nacrt pri Tab i obnova posle ponovnog učitavanja, D neispravan unos (crveni okvir, fokus ostaje), E F8 + Vrati, F F9 ispravka sa dijalogom (prazan razlog odbijen) i kartica Izmene, G promena pola/sprave/rotacije i prazna stanja, H napredak brojevi i traka, I 1366x768 bez vodoravnog skrola, J Tab red i vidljiv fokus.

---

## Self-review (urađen pri pisanju)

- Pokrivenost POPIS-a: 0, 1, 2 → Task 1; 3, 4 → Task 2; 6 (čisti deo) → Task 3; 5, 6, 7, 10 → Task 4; 8 → Task 1 i 2; 9 (faze 6 i 7) kroz javne funkcije `racun/{izmene,napredak}.mjs` i `ocene.zaTakmicenje`.
- Imena: `sacuvaj(takmicenjeId, prijavaId, spravaId, ulaz, potvrdi, razlog)` u modelu; IPC `nacrt`/`potvrdi` ga zovu sa `false`/`true`; `prikaz` oblik isti u modelu, IPC-u i `primeniPrikaz`.
- Odluke koje nisu iz PHP-a: dijalog za razlog (POPIS 10.1); `history.replaceState` za podrazumevane parametre (10.4); lokalno vreme izmene (10.5); primer ocene sa jednakim E sudijama (JSON nema sudije osim za Petrović).
