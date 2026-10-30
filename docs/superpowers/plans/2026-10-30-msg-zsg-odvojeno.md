# Plan: MSG i ŽSG kao dva odvojena dela aplikacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prekidač MSG | ŽSG u bočnom meniju; posle izbora cela aplikacija radi samo sa tim polom.

**Architecture:** Izabrani pol je ključ `aktivni_pol` u `podesavanja` i zna ga glavni proces; svaki IPC ulaz filtrira po njemu, pa
renderer ne šalje pol. Takmičenja, kategorije i programi dobijaju kolonu `pol` (migracija 005); postojeći podaci se dele JS
funkcijom `podeliPolove(baza)` koja se zove posle migracija i posle vraćanja kopije (SQL migracija ne vidi podatke vraćene iz kopije).
Pravila obračuna i štampe čitaju se po polu takmičenja (`dajPol`), sa starom zajedničkom vrednošću kao nasleđem dok se ne promeni.

**Tech Stack:** Electron 44, React 19, Vite 7, `node:sqlite`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-30-msg-zsg-odvojeno-design.md` (odobren 2026-10-30). Izvršilac čita i spec.

## Global Constraints

- Sav tekst interfejsa srpski, latinica; decimalni zarez; identifikatori i ključevi bez dijakritike (`pol`, `aktivni_pol`, `Z`, `M`).
- Ocene u celim brojevima; svaka izmena se čuva odmah; nijedna izmena ne sme da obriše ili pokvari podatke korisnika.
- Šema se menja samo novom numerisanom migracijom (`005_...`); postojeće migracije se ne menjaju.
- Tastatura pre miša: svaka radnja mora bez miša, fokus vidljiv. Ekran staje na 1366x768 bez vodoravnog skrolovanja.
- Bez novih zavisnosti, bez spoljnih URL-ova, LF fajlovi, kratki srpski komentari, bez em crte.
- `npm test` ceo posle svakog zadatka; `npm run build` posle svakog zadatka koji dira `src/`.
- Rad na grani `msg-zsg` od `main`; commit po zadatku (conventional, bez AI potpisa i bez Co-Authored-By); merge, push i verzija
  samo na Bojanov znak. Ništa u `%APPDATA%\Gimnastika`: QA uvek sa `GIM_PODACI` i `LOCALAPPDATA` u scratchpad-u.
- Pol: vrednosti `'M'` i `'Z'`; prikaz „MSG“ i „ŽSG“.

## Review Focus

1. Vraćanje kopije iz 1.1.1 sa takmičenjem oba pola: posle vraćanja dva takmičenja, sve prijave i ocene na mestu (test u T1).
2. Ponovno pokretanje posle prelaza (`podeliPolove` drugi put): nijedan duplikat takmičenja, kategorije ni programa (test u T1).
3. Promena pola takmičaru koji ima prijave: odbija se, jer bi prijava ostala u takmičenju pogrešnog pola (test u T3).
4. Uvoz fajla u kome je postojeći takmičar drugog pola: red je greška, ne upisuje se (test u T3).
5. Brisanje aktivnog takmičenja u jednom delu ne briše aktivno takmičenje drugog dela (test u T4).

---

### Task 1: Migracija 005 i podela postojećih podataka

**Files:**
- Create: `electron/baza/migracije/005_pol_po_delu.sql`, `electron/baza/podela-polova.cjs`, `tests/podela-polova.test.cjs`
- Modify: `electron/main.cjs` (posle `pocetniPodaci(baza)` u `pokreni()`), `electron/modeli/kopija.cjs:80` (podrazumevani `posleVracanja`)
- Test: `tests/podela-polova.test.cjs`, `tests/modeli-kopija.test.cjs` (nov slučaj)

**Interfaces:**
- Produces: `podeliPolove(baza) -> { takmicenja: number, podeljena: number, kategorije: number, programi: number }` (broj obrađenih
  redova; sve nule kad nema šta). Idempotentna: radi samo nad redovima sa `pol = ''`. Jedna transakcija.
- Produces (podaci): `takmicenja.pol`, `kategorije.pol`, `programi.pol` (`'M'|'Z'`); ključevi `aktivno_takmicenje_M`,
  `aktivno_takmicenje_Z`, `aktivni_pol`; stari ključ `aktivno_takmicenje` se briše.

- [ ] **Step 1: Napiši testove** u `tests/podela-polova.test.cjs` (`:memory:` baza, `migriraj()`, ručno ubačeni redovi sa `pol = ''`):
  - `jedan pol: takmicenje dobija pol prijava` → takmičenje sa samo M prijavama ima `pol = 'M'`, broj takmičenja ostaje 1.
  - `grupa drugog pola racuna se kao pol` → M prijave + prazna Z grupa → dva takmičenja; Z takmičenje ima tu grupu, M ima prijave.
  - `oba pola: deli se, ocene idu sa prijavama` → 3 Z i 2 M prijave sa ocenama, `ocene_e`, `izmene_ocena`, grupama oba pola,
    `grupa_redosled` i 2 reda `potvrde_klubova`: posle podele stari id ima pol sa više prijava (`'Z'`), novi red ima ista polja
    (naziv, datum, mesto, `broj_e_sudija`, `pravilo_e`, `ekipno_broji`, `pomeraj_redosled`, `zavrseno`, `zaglavlje_biltena`,
    `organizator`, `domacin`, `grb_levo`, `grb_desno`) i `pol = 'M'`; M prijave i M grupe imaju novi `takmicenje_id`; broj redova u
    `ocene`, `ocene_e`, `izmene_ocena`, `grupa_clanovi`, `grupa_redosled` isti kao pre; `potvrde_klubova` postoje za oba id-a;
    startni brojevi nepromenjeni; `PRAGMA foreign_key_check` prazan.
  - `isti broj prijava: stari id ostaje M` → 2 Z i 2 M.
  - `prazno takmicenje ide u oba dela` → bez prijava i grupa → dva takmičenja (`'M'` stari id, `'Z'` novi).
  - `kategorije i programi u oba dela` → kategorija koju koriste Z i M prijave i nekorišćen program: posle podele po dva reda istog
    naziva i redosleda (`'M'` stari id, `'Z'` novi); Z prijave pokazuju na `'Z'` kategoriju, M na `'M'`.
  - `aktivno po polu` → `aktivno_takmicenje = '7'` (podeljeno) → `aktivno_takmicenje_Z = '7'`, `aktivno_takmicenje_M` = novi id,
    ključ `aktivno_takmicenje` ne postoji, `aktivni_pol = 'Z'` (pol starog id-a); bez aktivnog → `aktivni_pol = 'M'`.
  - `drugi poziv ne menja nista` → drugi `podeliPolove` vraća sve nule, brojevi redova isti.
- [ ] **Step 2: Pokreni** `node --test tests/podela-polova.test.cjs` → FAIL (nema modula).
- [ ] **Step 3: Napiši migraciju** `005_pol_po_delu.sql`: `ALTER TABLE ... ADD COLUMN pol TEXT NOT NULL DEFAULT ''` za `takmicenja`,
  `kategorije`, `programi`; indeksi `ix_takmicenja_pol (pol, datum)`, `ix_kategorije_pol (pol, redosled)`, `ix_programi_pol (pol, redosled)`.
- [ ] **Step 4: Napiši `podeliPolove(baza)`**. Pol takmičenja = unija `takmicari.pol` njegovih prijava i `grupe.pol`. Pravila podele
  su u specu (odeljak 6) i testovima; kopija takmičenja dobija `kreirano`/`izmenjeno = Baza.sad()`. Pozovi je u `main.cjs` posle
  `pocetniPodaci` (upiši u dnevnik `podela polova: ...` kad nije sve nula) i u podrazumevanom `posleVracanja` u `kopija.cjs`.
  Stari ključ `aktivno_takmicenje` se prevodi samo kad postoji i odmah briše (inače bi svako pokretanje vraćalo staro aktivno);
  `aktivni_pol` se upisuje samo kad ga nema. Napomena: od T1 do T2 aplikacija posle pokretanja nema aktivno takmičenje, jer
  `podesavanja.aktivno()` još čita stari ključ; QA kroz aplikaciju tek od T2.
- [ ] **Step 5: Test vraćanja stare kopije** u `tests/modeli-kopija.test.cjs`: `vracanje kopije bez kolone pol deli takmicenje` →
  napravi kopiju-fajl sa šemom do 004 (otvori bazu, primeni samo 001..004 SQL, ubaci takmičenje sa Z i M prijavama i ocenama),
  `kopija.vrati(putanja)` → u živoj bazi dva takmičenja, svi brojevi redova kao u kopiji.
- [ ] **Step 6: Pokreni** `npm test` → PASS (postojeći testovi ne zavise od nove kolone).
- [ ] **Step 7: Commit** `feat(baza): pol takmicenja, kategorija i programa i podela postojecih podataka`

### Task 2: Podešavanja po polu

**Files:**
- Modify: `electron/modeli/podesavanja.cjs`, `electron/modeli/kopija.cjs` (`MESNI_KLJUCEVI`, `ocistiGrbove`, `proveriOciscenje`),
  `electron/modeli/ocene.cjs:128`, `electron/modeli/prijave.cjs:135`, `electron/modeli/rezultati.cjs:92-93`, `electron/rang-paket.cjs:79,86,93,94`,
  `electron/moduli.cjs:391`
- Test: `tests/modeli-podesavanja.test.cjs`, `tests/modeli-kopija-sigurnost.test.cjs`

**Interfaces:**
- Consumes: ključevi iz T1.
- Produces (u objektu iz `podesavanja.napravi`):
  - `POLNI_KLJUCEVI = ['e_zaokruzivanje', 'plasman_isti_rezultat', 'viseboj_nepotpun', 'lekarski_sprecava_prijavu', 'organizator', 'grb_levo', 'grb_desno']` (i export modula)
  - `PODRAZUMEVANO` gubi `aktivno_takmicenje`, dobija `aktivni_pol: 'M'`, `aktivno_takmicenje_M: ''`, `aktivno_takmicenje_Z: ''`
  - `aktivniPol() -> 'M'|'Z'` (nepoznato ili prazno → `'M'`); `postaviPol(pol)` (drugo od M/Z → `GreskaKorisnika('Nepoznat pol.')`)
  - `aktivnoTakmicenjeId(pol = aktivniPol()) -> number|null`; `aktivno(pol = aktivniPol()) -> red|null` (red drugog pola → null)
  - `postaviAktivno(id: number|null, pol)` (null briše)
  - `dajPol(kljuc, pol, podrazumevano = '')`: `${kljuc}_${pol}`, pa stari `kljuc`, pa `PODRAZUMEVANO`, pa `podrazumevano`
  - `sva(pol = aktivniPol())`: kao danas, ali vrednosti `POLNI_KLJUCEVI` dolaze iz `dajPol` pod običnim imenom, plus `pol`
  - `sacuvajOpsta(p, pol = aktivniPol())`: `POLNI_KLJUCEVI` se upisuju kao `${kljuc}_${pol}`, grb fajl kao `grb/${kljuc}_${pol}.${ext}`; ostalo kao danas

- [ ] **Step 1: Testovi** u `tests/modeli-podesavanja.test.cjs`:
  - `dajPol nasledjuje staru vrednost` → `e_zaokruzivanje = 'zaokruzi'` → `dajPol('e_zaokruzivanje','M') === 'zaokruzi'` i za `'Z'`.
  - `sacuvajOpsta po polu ne dira drugi pol` → `sacuvajOpsta({ plasman_isti_rezultat: 'visa_e_pa_d' }, 'Z')` → Z `'visa_e_pa_d'`, M `'deli'`.
  - `lekarski prag ostaje zajednicki` → `sacuvajOpsta({ lekarski_prag_dana: 10 }, 'Z')` → `daj('lekarski_prag_dana') === '10'`.
  - `aktivno po polu` → `postaviAktivno(Zid,'Z')`, `postaviPol('M')` → `aktivno()` je null; `postaviPol('Z')` → red `Zid`.
  - `postaviPol odbija nepoznat` → `postaviPol('X')` baca `Nepoznat pol.`
- [ ] **Step 2: Test** u `tests/modeli-kopija-sigurnost.test.cjs`: `grb po polu iz kopije se cisti` → kopija sa `grb_levo_Z = 'C:\\x.png'`
  i `grb_desno_M = 'grb/grb_desno_M.png'` → posle vraćanja prvi je `''`, drugi ostaje.
- [ ] **Step 3: Pokreni** → FAIL.
- [ ] **Step 4: Implementiraj** u `podesavanja.cjs` i `kopija.cjs` (svi grb ključevi = `grb_levo`, `grb_desno` i njihove `_M`/`_Z` verzije).
  Pozivaoci čitaju po polu takmičenja: `ocene.cjs` `dajPol('e_zaokruzivanje', takm.pol, 'odseci')`, `prijave.cjs` lekarski po polu
  takmičenja, `rezultati.cjs` oba ključa po `takm.pol`, `rang-paket.cjs` grbovi i organizator po `takm.pol`, `moduli.cjs:391` po `takm.pol`.
- [ ] **Step 5: Pokreni** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(podesavanja): pravila obracuna i stampe i aktivno takmicenje po polu`

### Task 3: Modeli poštuju pol

**Files:**
- Modify: `electron/modeli/takmicenja.cjs`, `electron/modeli/sifarnici.cjs`, `electron/modeli/takmicari.cjs`, `electron/modeli/prijave.cjs`,
  `electron/modeli/grupe.cjs:86`, `electron/modeli/uvoz.cjs`, `tests/pomoc/seme.cjs`, `alati/primer-podaci.cjs`
- Test: `tests/modeli-takmicenja.test.cjs`, `tests/modeli-sifarnici.test.cjs`, `tests/modeli-takmicari.test.cjs`, `tests/modeli-prijave.test.cjs`,
  `tests/modeli-grupe.test.cjs`, `tests/modeli-uvoz.test.cjs`, `tests/alati-primer.test.cjs` i ostali koje promena semena obori

**Interfaces:**
- Produces:
  - `takmicenja.sva(pol)` (samo taj pol); `takmicenja.prazno(pol)` ima `pol`; `takmicenja.sacuvaj(p, id, pol)`: novo dobija `pol`,
    izmena ne menja pol.
  - `sifarnici.VRSTE = { kategorije, programi, sprave }`, sve po polu: `lista(vrsta, pol)`, `dodaj(vrsta, p, pol)`, `redosled(vrsta, ids, pol)`;
    `izmeni`/`obrisi` odbijaju stavku drugog pola (`GreskaKorisnika('Stavka ne postoji.')`). `sprave(pol)` ostaje.
  - `takmicari.svi(pol = null)`; `sacuvaj` sa promenjenim polom za takmičara sa prijavama baca
    `GreskaKorisnika('Takmičar ima prijave, pa mu se pol ne može promeniti.')`.
  - `prijave.dodajJednu/dodajVise`: takmičar drugog pola od takmičenja ide u `preskoceno` sa upozorenjem
    `` `${prezime} ${ime}: nije istog pola kao takmičenje.` ``; `izmeniPolje` za `kategorija_id`/`program_id` drugog pola baca
    `GreskaKorisnika('Kategorija ili program ne pripada ovom polu.')`; `lekarskiUpozorenja(pragDana, pol)` samo takmičenja tog pola.
  - `grupe.dodaj(takmicenjeId, pol)` baca `GreskaKorisnika('Grupa mora biti istog pola kao takmičenje.')` kad se pol razlikuje.
  - `uvoz.pripremiFajl(putanja, ime, takmicenjeId)`: pol fajla je pol takmičenja (polje pola iz fajla se ne koristi za izbor);
    kategorije/programi iz liste tog pola; nova stavka iz uvoza dobija taj pol; red sa postojećim takmičarem drugog pola je
    `GRESKA` sa napomenom `takmičar je drugog pola`.
  - `tokSeme(baza)` vraća i `takm` (Z, sa `pol: 'Z'`) i `takmM` (M), `kat`/`prog` (Z) i `katM`/`progM` (M); `muski` se prijavljuje u `takmM`.

- [ ] **Step 1: Testovi** (po jedan po stavci gore, sa tačnim porukama): `sva po polu`, `nova stavka sifarnika dobija pol`,
  `stavka drugog pola se ne menja`, `pol se ne menja ako ima prijave`, `pol se menja bez prijava`, `prijava drugog pola se preskace`,
  `kategorija drugog pola se odbija`, `lekarski samo za pol`, `grupa drugog pola se odbija`, `uvoz: postojeci takmicar drugog pola je greska`,
  `uvoz: nova kategorija dobija pol takmicenja`.
- [ ] **Step 2: Pokreni** → FAIL.
- [ ] **Step 3: Implementiraj** modele; prepravi `tokSeme` i testove koji danas mešaju polove u jednom takmičenju (Marko ide u `takmM`);
  `alati/primer-podaci.cjs` pravi dva takmičenja „Jesenji kup 2026“ (Z i M) umesto jednog mešovitog.
- [ ] **Step 4: Pokreni** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(modeli): takmicenja, sifarnici, takmicari, prijave i uvoz po polu`

### Task 4: IPC po izabranom polu

**Files:**
- Modify: `electron/moduli.cjs`, `electron/api.cjs`, `electron/pregled-paket.cjs`, `electron/rang-paket.cjs`, `electron/modeli/rezultati.cjs` (`izbor`)
- Test: `tests/ipc.test.cjs`, `tests/ipc-faza3.test.cjs` .. `tests/ipc-faza8.test.cjs`, `tests/ipc-faza7-pregled.test.cjs`

**Interfaces:**
- Consumes: T2 `aktivniPol/postaviPol/aktivno/postaviAktivno/sva/sacuvajOpsta`, T3 modeli.
- Produces:
  - Novi IPC modul `pol: ['daj', 'postavi']`: `pol.daj() -> 'M'|'Z'`, `pol.postavi(pol) -> 'M'|'Z'`.
  - Svi postojeći IPC pozivi rade za `p.aktivniPol()`; argument `pol` koji renderer još šalje se zanemaruje (uklanja se u T6/T7).
  - `takmicenja.sva/sacuvaj/obrisi/otvori` i `podesavanja.sva/sacuvajOpsta/aktivno`, `sifarnici.*`, `takmicari.svi`, `prijave.podaci`
    (samo `sprave` tog pola, `takmicari` tog pola, kategorije i programi tog pola), `rotacije.*`, `unos.podaci`, `rang.*`, `uvoz.*` po polu.
  - `rezultati.izbor(takm, _pol, kat, prog)`: pol je uvek `takm.pol`.
  - `pregled-paket`: `napredakINastavi` radi samo za `takm.pol`; `urlUnos` bez `pol=`; `pocetna.podaci` daje `ostala` i `lekarski`
    samo za izabrani pol, plus `pol`.
  - `PRECICE` dobija `['Prebaci na MSG', ['Alt', 'M']]` i `['Prebaci na ŽSG', ['Alt', 'Z']]`.
  - Rezultati uživo šalju aktivno takmičenje izabranog dela (ocena se potvrđuje u tom delu). Odluka u planu umesto „oba“ iz speca
    (spec to prepušta graditelju): sinhro ostaje bez izmena, a `podesavanja.aktivno()` je već aktivno takmičenje izabranog dela.
- [ ] **Step 1: Testovi** (`tests/ipc.test.cjs` i fazni): `pol.postavi menja listu takmicenja`, `takmicari.svi samo izabrani pol`,
  `prijave.podaci samo sprave pola`, `brisanje aktivnog u ZSG ne dira MSG`, `unos.podaci zanemaruje pol iz renderera`,
  `pocetna.podaci lekarski samo za pol`; prepravi postojeće testove koji su birali pol argumentom (`podaci() bez parametara: pol Z` i slični)
  da biraju `pol.postavi`.
- [ ] **Step 2: Pokreni** → FAIL. **Step 3: Implementiraj.** **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(ipc): svi ulazi rade za izabrani pol`

### Task 5: Prekidač MSG | ŽSG u meniju

**Files:**
- Create: `src/okvir/IzborDela.jsx`
- Modify: `src/okvir/Meni.jsx` (ispod `.meni-vrh`), `src/App.jsx` (stanje pola, Alt+M/Alt+Z, događaj), `src/okvir/Traka.jsx`
  (osvežava se i na `app:pol`), `src/stil/app.css`, `src/ekrani/Sistem.jsx` (primer prekidača)
- Test: `tests/precice.test.mjs` (ako proverava listu)

**Interfaces:**
- Consumes: `gim.pol.daj/postavi` (T4).
- Produces: DOM događaj `app:pol` posle promene; App posle promene ide na `#/pocetna` i šalje i `app:aktivno`.
- `IzborDela({ pol, naPromenu })`: dve dugmeta „MSG“ i „ŽSG“ (`aria-pressed`), uz `kbd` Alt+M / Alt+Z u `title`.

- [ ] **Step 1:** Implementiraj; `npm run build`.
- [ ] **Step 2: QA kroz aplikaciju** (CDP, `GIM_PODACI` sa kopijom `C:\Users\bojan\Desktop\kopija_2026-10-30_1522.sqlite` vraćenom kroz
  `kopija.vrati`, i sa `alati/primer-podaci.cjs` bazom): prekidač vidljiv na svakom ekranu sa menijem; Alt+M i Alt+Z rade sa fokusom u
  polju i van njega; promena vodi na Početnu; posle ponovnog pokretanja otvara se poslednji deo; 1366x768 bez vodoravnog skrolovanja.
- [ ] **Step 3:** `npm test` → PASS. **Step 4: Commit** `feat(meni): prekidac MSG i ZSG`

### Task 6: Bez prekidača pola na ekranima takmičenja

**Files:**
- Modify: `src/ekrani/Unos.jsx`, `src/ekrani/unos/UnosTraka.jsx`, `src/ekrani/unosStanje.js` (`hashUnos` bez pola), `src/ekrani/Rotacije.jsx`,
  `src/ekrani/rotacije/RotTraka.jsx`, `src/ekrani/rotacijeStanje.js`, `src/ekrani/Rang.jsx`, `src/ekrani/rang/RangTraka.jsx`, `src/ekrani/rangStanje.js`,
  `src/ekrani/Stampa.jsx`, `src/ekrani/Bilten.jsx`, `src/ekrani/stampa/koristiStampu.js`, `src/ekrani/Rezultati.jsx`, `src/ekrani/Takmicenje.jsx`,
  `src/ekrani/pocetnaStanje.js`, `src/koraciStanje.js`, `src/App.jsx` (F2/F4)
- Test: `tests/unos-stanje.test.mjs`, `tests/rotacije-stanje.test.mjs`, `tests/rang-stanje.test.mjs`, `tests/stampa-stanje.test.mjs`,
  `tests/pocetna-stanje.test.mjs`, `tests/ruter.test.mjs`, `tests/koraci.test.mjs`

**Interfaces:**
- Consumes: pol iz odgovora servera (`unos.podaci().pol`, `rang.podaci().izbor.pol`, `rotacije.podaci().pol`) samo za tekstove
  („Odustao/Odustala“, „MSG/ŽSG“ u naslovu).
- Produces: hash-evi bez `pol=` (`#/unos?sprava=&rot=`, `#/rang?kat=&prog=&tab=`, `#/rotacije?rot=&kp=`); stari hash sa `pol=` se zanemaruje.

- [ ] **Step 1:** Prepravi testove čistih funkcija (hash bez `pol`); **Step 2:** FAIL; **Step 3:** implementiraj, renderer više ne šalje pol;
  **Step 4:** `npm test`, `npm run build` → PASS.
- [ ] **Step 5: QA** (kao T5): na Unosu, Rotacijama, Rang listama, Štampi, Biltenu i Pregledu nema prekidača i nema drugog pola;
  bilten ŽSG piše „Ženska sportska gimnastika“; poreklo pola u naslovima tačno.
- [ ] **Step 6: Commit** `feat(ekrani): unos, rotacije i rang liste bez izbora pola`

### Task 7: Baza, prijave, uvoz i podešavanja po delu

**Files:**
- Modify: `src/ekrani/Takmicari.jsx`, `src/ekrani/takmicariFilter.js`, `src/komponente/DijalogTakmicar.jsx`, `src/ekrani/Prijave.jsx`,
  `src/ekrani/prijave/BazaTakmicara.jsx`, `src/ekrani/prijave/TabelaPrijava.jsx`, `src/ekrani/prijave/RedPrijave.jsx`, `src/ekrani/prijaveFilter.js`,
  `src/ekrani/Uvoz.jsx`, `src/ekrani/uvoz/FajlKartica.jsx`, `src/ekrani/uvozBrojac.js`, `src/ekrani/Podesavanja.jsx`, `src/ekrani/Takmicenja.jsx`
- Test: `tests/takmicari-filter.test.mjs`, `tests/prijave-filter.test.mjs`, `tests/uvoz-brojac.test.mjs`

**Interfaces:**
- Consumes: T4 IPC (liste već filtrirane).
- Produces: Takmičari bez filtera pola; nov takmičar dobija izabrani pol (polje pola se ne prikazuje pri unosu; pri izmeni postoji
  izbor pola, a greška iz T3 se prikazuje kao poruka). Prijave bez „Svi/M/Ž“ i bez slova pola u redu. Uvoz bez „Pol takmičara u fajlu“.
  Podešavanja: kartice „Kategorije“, „Programi“, „Sprave“ i pravila obračuna i štampe za izabrani deo, sa naslovom koji kaže deo
  („Pravila · MSG“); opšta podešavanja (prag za lekarski, kopije, sajt) u posebnoj kartici „Za ovaj računar“.

- [ ] **Step 1:** Prepravi testove čistih funkcija; **Step 2:** FAIL; **Step 3:** implementiraj; **Step 4:** `npm test`, `npm run build` → PASS.
- [ ] **Step 5: QA**: u MSG se nigde ne vidi ženski takmičar, ženska sprava, ŽSG kategorija ni ŽSG takmičenje, i obrnuto; nov takmičar
  iz Prijava i iz Takmičara dobija pol dela; uvoz `tests/fajlovi` primera u oba dela; promena pravila u ŽSG ne menja MSG rang listu.
- [ ] **Step 6: Commit** `feat(ekrani): takmicari, prijave, uvoz i podesavanja po delu`

### Task 8: Završna provera i dokumentacija

**Files:**
- Modify: `docs/INSTALACIJA.md` (odeljak o prelazu: mešovita takmičenja se dele na dva), `docs/proizvod/` gde opisuje izbor pola po ekranu

- [ ] **Step 1:** `npm test` ceo, `npm run build`, `git diff --stat main` bez fantomskih izmena (LF).
- [ ] **Step 2: QA prelaza** na kopijama u scratchpad-u: (a) Bojanova kopija sa Desktopa (samo MSG), (b) baza iz `alati/primer-podaci.cjs`
  napravljena na `main` grani (mešovita), (c) prazno takmičenje: pokretanje nove verzije, pa brojevi redova i rang liste uporedo sa
  `main` verzijom (iste ocene, isti plasmani po polu).
- [ ] **Step 3:** Izveštaj Bojanu: šta je izvršeno, šta nije (instaler i ažuriranje sa 1.1.2 nisu probani), spisak za probu u sali.
- [ ] **Step 4: Commit** `docs: MSG i ZSG kao odvojeni delovi`
