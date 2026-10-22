# Faza 3: Takmičenja, Prijave, Uvoz prijava iz fajla

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekrani Takmičenja (lista i forma na celu stranu), Prijave aktivnog takmičenja (sa dijalogom „Novi takmičar“, potvrdom spiska kluba i startnim brojevima) i Uvoz prijava iz .docx/.xlsx sa pregledom pre upisa, plus traka koraka pripreme; sve kao u PHP verziji 1.2.0, nad SQLite bazom, sa testovima.

**Architecture:** Modeli `takmicenja.cjs`, `prijave.cjs`, `uvoz.cjs` u main procesu (uzorak iz faze 2: `napravi(baza, ...)`, `GreskaKorisnika` sa doslovnim porukama). Čitanje fajlova (zip, docx, xlsx) i tumačenje su čisti moduli u `electron/uvoz/` sa testovima nad sintetičkim i pravim fikstura fajlovima. Stanje uvoza (pripremljeni fajlovi i izbori zapisničara) živi u React stanju ekrana Uvoz, ne u sesiji; main dobija sve nazad pri upisu i ponovo proverava. Poruke koje u PHP-u prežive redirect (flash) ovde su `najavi(tekst, vrsta)` u `Poruke.jsx`: prikazuju se posle sledeće promene ekrana.

**Tech Stack:** Electron 44, React 19, `node:sqlite`, Node `zlib` (inflate za zip, bez zavisnosti), `fast-xml-parser` (jedina nova zavisnost; vidi Global Constraints), node:test.

**Spec:** Dizajn `docs/superpowers/specs/2026-10-20-gimnastika-electron-design.md`. Ponašanje, doslovne poruke, kolone, tastatura i testovi za prenos: `docs/superpowers/specs/2026-10-22-faza-3-popis-php.md` (dalje: POPIS; zadaci navode odeljke). Makete `PHP projekat\dizajn\slike\05-takmicenja.png`, `06-prijave.png` prikazuju STARO stanje; važi POPIS (snimci stvarnih PHP ekrana: lista takmičenja sa kolonom „Priprema“ i dugmadima „Izmeni“/„Otvori“, forma na celu stranu sa trakom koraka, Prijave grupisane po klubu). PHP projekat = `C:\Users\bojan\Desktop\Takmicarski program` (samo čitanje).

## Global Constraints

- Repo `C:\Posao\gimnastika`, grana `faza-3` od `main`. Commit po zadatku lokalno; push i merge samo na Bojanov znak. Bez AI atribucije.
- Tekst interfejsa srpski latinicom sa dijakriticima doslovno kao u POPIS-u (tipografski navodnici „ “ gde ih PHP ima, srednja tačka ` · ` kao razdvajač); bez em crte (U+2014) igde. Nazivi u kodu srpski bez kvačica, camelCase; kolone snake_case.
- Jedina nova zavisnost: `fast-xml-parser` (čist JS, bez binarnih delova) za XML iz docx/xlsx. Zip se čita sopstvenim čitačem nad `zlib.inflateRawSync` (port `Zip.php`). Ništa drugo se ne dodaje.
- Modeli bacaju `GreskaKorisnika` sa porukama iz POPIS-a (odeljci 2.1, 3.2, 3.3, 7, 8). Svaka promena se upisuje odmah; rezultat IPC poziva je običan objekat.
- Booleani u SQLite 0/1; datumi `gggg-mm-dd`; prikaz `dd.mm.gggg.`; pol `M`/`Z`, prikaz `M`/`Ž`; `pol_naziv` → `MSG`/`ŽSG`.
- Sortiranje imena: `electron/modeli/sortiranje.cjs` (`poImenu`, `KOLATOR`); SQL `ORDER BY` samo kao osnova.
- Lekarski na Prijavama i u uvozu: `electron/racun/lekarski.mjs` sa `naDan = takmicenje.datum`; „ne važi“ = `nema` ili `istekao` (`istice` nije upozorenje, POPIS 0.4).
- Tastatura pre miša, fokus vidljiv; `sadrzaj-fiksno` za Takmičenja (lista) i Prijave; forma takmičenja i Uvoz skroluju celu stranu. Ekran staje na 1366x768 bez vodoravnog skrola.
- Testovi: `npm test`; modeli nad `otvori(':memory:')` + `migriraj()`; čisti moduli uvoza nad sintetičkim zipovima i fikstura fajlovima u `tests/fajlovi/`; izlaz čist.
- Dužine polja se ne proveravaju (kao PHP; SQLite nema ograničenje): svesna odluka, POPIS 10.5.

## Review Focus

- Dva takmičara sa istim prezimenom i imenom u istom fajlu: drugi red je crven „isti takmičar je već u redu N“, nikad dva upisa (Task 6 test).
- Lekarski koji ne važi na dan takmičenja, uz `lekarski_sprecava_prijavu = 'da'`: prijava preskočena sa porukom, takmičar iz uvoza ipak upisan u bazu i uračunat u „novih“ (Task 2 i Task 6 test).
- Startni broj koji već ima druga prijava: poruka „Startni broj 21 već ima Test Ana.“, polje crveno, vrednost se ne menja (Task 2 test, Task 10 ručno).
- Brisanje prijave sa unetim ocenama i gašenje sprave sa unetom ocenom: blokirano porukom; nacrt ocena se briše (Task 2 test).
- Grb takmičenja istog imena zamenjen: nova putanja sa vremenskim žigom, prikaz se menja (Task 1 test, Task 9 ručno).

---

### Task 1: Model Takmičenja

**Files:**
- Create: `electron/modeli/takmicenja.cjs`
- Test: `tests/modeli-takmicenja.test.cjs`
- Reference: POPIS 1 (takmicenja, kaskade), 2, 2.1, 4.4 (grbovi), 9.4; `PHP projekat\app\Modeli\Takmicenja.php`, `app\Kontroleri\takmicenja.php` (`$sacuvajGrbove`)

**Interfaces:**
- Produces `napravi(baza, fasciklaPodataka) → { POLJA, GRBOVI, sva(): red[] (sa broj_prijava, broj_ocena; ORDER BY datum DESC, id DESC), nadji(id), imaOcena(id): boolean, brojPrijava(id): number, prazno(): forma, proveri(p, id|null): string[] (5 poruka POPIS 2.1, tim redom; `datum` kao tekst iz forme se parsira sa `datumParsiraj`: null → „Datum je obavezan.“, false → „Datum nije ispravan (dd.mm.gggg).“), sacuvaj(p, id|null): number (filtrira na POLJA; `pomeraj_redosled`/`zavrseno` u 0/1; baca GreskaKorisnika(join ' ')), postaviGrb(id, polje, vrednost): void (`Nepoznato polje grba: X` za polje van GRBOVI), sacuvajGrb(id, polje, izvornaPutanja): string (kopira u `<podaci>/grb/takmicenje_{id}_{levo|desno}_{gggg mm dd HH MM SS}.{ext}`; ekstenzija mala slova iz `png jpg jpeg svg gif`, inače `Grb mora biti PNG, JPG, GIF ili SVG slika.`; nepostojeći izvor → `Izabrana slika više ne postoji.`; upisuje `grb/<ime>` kroz postaviGrb i vraća vrednost), obrisi(id): void (`Takmičenje ima {n} prijava i ne može se obrisati.`), status(t, aktivnoId): 'aktivno'|'zavrseno'|'priprema' }`.
- Consumes: `electron/racun/datum.mjs` (`datumParsiraj`), `electron/racun/ocena.mjs` (`PRAVILA`), `baza.cjs`, `greska.cjs`.

- [ ] **Step 1: Testovi**: `prazno()` jednako POPIS 2; `proveri({})` → `['Naziv takmičenja je obavezan.', 'Datum je obavezan.', 'Broj E sudija mora biti između 1 i 6.', 'Nepoznato pravilo za E ocenu.', 'Broj ocena koje se broje za ekipu mora biti između 1 i 10.']` (prazno `broj_e_sudija` je 0); `datum '31.02.2027'` → `Datum nije ispravan (dd.mm.gggg).`; 1 i 6 sudija prolaze, 0 i 7 ne (POPIS 9.4); `sacuvaj` vraća id, `nadji` ima `pomeraj_redosled 0`, `zavrseno 0`, `grb_levo ''`; promena `broj_e_sudija` kad ima ocena `uneto` → jedna greška „Broj E sudija se ne može menjati kad takmičenje već ima unete ocene.“ (ubaci prijavu + ocenu `status 'uneto'`), a `nacrt` ocena ne blokira; `postaviGrb(id, 'naziv', 'x')` baca; `sacuvajGrb` sa temp `.PNG` upisuje `grb/takmicenje_1_levo_…png` i fajl postoji, `.txt` baca, dva poziva daju različita imena (žig); `obrisi` sa prijavom → poruka sa brojem 1, bez prijave briše i `potvrde_klubova` red; `status` tri slučaja (aktivno ima prednost nad završeno); `sva()` sortira po datumu opadajuće pa id.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi.**

### Task 2: Model Prijave

**Files:**
- Create: `electron/modeli/prijave.cjs`
- Test: `tests/modeli-prijave.test.cjs` (seme `tokSeme(baza)` po POPIS 9.1 kao pomoćna funkcija u `tests/pomoc/seme.cjs`, da je koriste i faze 4 do 6)
- Reference: POPIS 0.3, 0.4, 3.1 do 3.4, 9.1, 9.2, 9.3, 9.4; `PHP projekat\app\Modeli\Prijave.php`, `testovi\TokTest.php`

**Interfaces:**
- Produces `napravi(baza, podesavanja) → { lista(takmicenjeId, pol|null): red[] (sa id_broj, ime, prezime, godina_rodjenja, pol, lekarski_do, klub_skr, klub_ime, sprave: number[]; sortirano pol Z pa M, pa prezime, ime kolatorom), nadji(id), prijavljeniTakmicari(tid): number[], potvrdjeniKlubovi(tid): number[], brojevi(tid): {prijava, klubova}, lekarskiUpozorenja(pragDana): red[] (sa `lek`), stanjePripreme(tid): stanje (Priprema.stanje + skracenica/puno_ime po klubu, redosled klubova po skraćenici kolatorom, bez kluba na kraju), dodajVise(tid, ids): {dodato, preskoceno: string[], upozorenja: string[]}, dodajJednu(tid, takmicarId, kategorijaId|null, programId|null, ucesce): {stanje:'dodato'|'vec'|'nema'|'preskoceno', ime, poruka, lekarski_ne_vazi, prijava_id|null}, izmeniPolje(tid, prijavaId, polje, vrednost): void, postaviSpravu(tid, prijavaId, spravaId, radi): void, postaviUcesce(tid, prijavaId, ucesce): void, obrisi(tid, prijavaId): void, potvrdiKlub(tid, klubId, potvrdjeno): void, dodeliStartneBrojeve(tid): number }` sa pravilima i porukama POPIS 3.2 do 3.4 doslovno (`Takmičenje ne postoji.`, `{ime} je već prijavljen.`, `{ime} (lekarski ne važi na dan takmičenja)`, `Prijava ne postoji.`, `Stavka ne postoji.`, `Startni broj mora biti pozitivan ceo broj.`, `Startni broj {v} već ima {Prezime} {Ime}.`, `Nepoznato polje: {polje}`, `Sprava ne odgovara polu takmičara.`, `Na toj spravi već postoji uneta ocena. Prvo je obrišite u unosu ocena.`, `Nepoznato učešće: {x}`, `{Prezime} {Ime} ima {n} unetih ocena. Prijava se ne može obrisati.`, `Klub nema prijava na ovom takmičenju.`). `dodeliStartneBrojeve` redosled: pol Z pa M, kategorija `redosled` (null prvo), skraćenica kluba (null prvo, kolator), prezime, ime.
- Consumes: `electron/racun/priprema.mjs` (`stanje`, `poljaUcesca`, `ucesce`), `electron/racun/lekarski.mjs`, `podesavanja.cjs` (`daj`, `dajInt`), `sortiranje.cjs`.

- [ ] **Step 1: Testovi**: port POPIS 9.2 u celini (tačke 1 do 9; tačka 6 sa startnim brojevima 21, 22, 23, 24, 25), 9.3 bez dela sa grupama (korak `spremno` preko grupa ide u fazu 4; umesto toga ubaci red u `grupe` + `grupa_clanovi` sirovim SQL-om za Anu, Cecu, Donu i proveri `korak === 'spremno'`), dodatno: `postaviSpravu(radi=false)` briše `nacrt` ocenu i blokira kad postoji `uneto`; `obrisi` prijave sa `uneto` ocenom baca poruku sa brojem; `izmeniPolje(kategorija_id, nepostojeći)` → `Stavka ne postoji.`; `izmeniPolje(startni_broj, '')` vraća na null; `lekarskiUpozorenja(30)` posle `dodajVise` svih pet vraća tačno Beu (`istekao`), Donu (`nema`) i Marka (`nema`), ne Anu ni Cecu (lekarski 2027-01-01 na dan 2026-10-17 je `vazi`); `brojevi(takm)` → `{prijava: 5, klubova: 2}`.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi.**

### Task 3: Zip čitač

**Files:**
- Create: `electron/uvoz/zip.cjs`
- Test: `tests/uvoz-zip.test.cjs`
- Reference: POPIS 8.3; `PHP projekat\app\Jezgro\Zip.php`

**Interfaces:**
- Produces `lista(putanja): {[ime]: {metoda, kduz, duz, ofset}}`, `procitaj(putanja, ime, lista?): Buffer` (metode 0 i 8 preko `zlib.inflateRawSync`; poruke POPIS 8.3 doslovno kao `Error`), `napravi(putanja, stavke: {[ime]: {sadrzaj: string|Buffer}})` (store ili deflate nivo 6 ako je manji; samo za testove i kasnije kopije).

- [ ] **Step 1: Testovi**: `napravi` pa `lista` ima imena i metode; `procitaj` vraća isti sadržaj (tekst sa UTF-8 dijakriticima i binarni niz od 70000 bajtova, da EOCD pretraga radi); fajl koji nije zip → `Fajl nije zip arhiva.`; nepostojeća stavka → `U arhivi nema stavke x`.
- [ ] **Step 2: Pada. Step 3: Napiši (port Zip.php; `Buffer.readUInt32LE`). Step 4: Prolazi.**

### Task 4: Čitači docx i xlsx

**Files:**
- Create: `electron/uvoz/docx.cjs`, `electron/uvoz/xlsx.cjs`, `electron/uvoz/citac.cjs`, `tests/fajlovi/prijava-partizan.docx`, `tests/fajlovi/prijava-vojvodina.xlsx` (binarne kopije iz `PHP projekat\testovi\fajlovi\`)
- Modify: `package.json` (`fast-xml-parser` u `dependencies`), `.gitattributes` (`*.docx binary`, `*.xlsx binary`)
- Test: `tests/uvoz-citac.test.cjs`
- Reference: POPIS 8.2, 8.4, 8.5, 9.6 (`uvoz_docx_primer`, `uvoz_xlsx_primer`, `test_uvoz_docx_citanje`, `test_uvoz_xlsx_citanje`, `test_uvoz_citac_odbija_tudj_fajl`); `PHP projekat\app\Uvoz\Docx.php`, `Xlsx.php`, `Citac.php`

**Interfaces:**
- Produces `docx.procitaj(putanja): {tabele: string[][][], tekst: string}`, `xlsx.procitaj(putanja): {tabele, tekst: ''}`, `citac.procitaj(putanja): {tabele, tekst, vrsta: 'docx'|'xlsx'}` sa pravilima i porukama POPIS 8.2, 8.4, 8.5 doslovno (gridSpan ponavlja ćeliju; `w:tr`/`w:tc` i kroz `w:sdt`, `w:sdtContent`, `w:customXml`, `w:ins`; pasusi u ćeliji spojeni razmakom; xlsx deljeni nizovi, inline, datumski stilovi, serijski datum 1900 sa 29.02 ispravkom, prazni redovi po `r`, kolone po slovu). `fast-xml-parser` sa `preserveOrder: true`, `ignoreAttributes: false`, imenski prefiksi zadržani (`w:tbl` ...).
- Pomoćne funkcije za testove u `tests/pomoc/uzorci.cjs`: `docxPrimer(putanja)`, `xlsxPrimer(putanja)` (sintetički fajlovi po POPIS 9.6, napravljeni sa `zip.napravi`).

- [ ] **Step 1: Testovi**: port tri PHP testa (tvrdnje POPIS 9.6 doslovno) + fikstura fajlovi: partizan → `vrsta 'docx'`, 2 tabele, prva tabela ima red `['Klub', 'G.D.“PARTIZAN –ŽELJEZNIČAR“']`, druga tabela ima zaglavlje `['#','PREZIME','IME','KATEGORIJA','DATUM ROĐENJA','FUNKCIJA-EKIPA']` i 11 redova podataka posle njega (9 popunjenih, 2 prazna; tumač ih preskače u Task 5); vojvodina → `vrsta 'xlsx'`, 1 tabela, sadrži red `['Klub', 'SD „Vojvodina“']` i red koji počinje `['Petrović', 'Mina']` sa četvrtom ćelijom `'01.01.2014.'`.
- [ ] **Step 2: Pada. Step 3: `npm i fast-xml-parser`, napiši module. Step 4: Prolazi; `npm run build` radi (modul se ne pakuje u renderer).**

### Task 5: Tumač prijave i uparivanje

**Files:**
- Create: `electron/uvoz/tumac-prijave.cjs`, `electron/uvoz/uparivanje.cjs`
- Test: `tests/uvoz-tumac.test.cjs`, `tests/uvoz-uparivanje.test.cjs`
- Reference: POPIS 8.6, 8.7, 9.6 (`test_uvoz_tumac_prijave`, `_razne_tabele`, `_pomocne`, `_uparivanje`, `_probni_fajlovi`), 9.7 (`test_uvoz_klub_i_stavke`); `PHP projekat\app\Uvoz\TumacPrijave.php`, `Uparivanje.php`

**Interfaces:**
- Produces `tumac.protumaci(dokument): {klub, pol, redovi: Red[], greske}`, `tumac.normalizuj(s)`, `tumac.datum(s): {datum, godina, greska}`, `tumac.kategorijaProgram(oznaka)`, `tumac.ucesce(s)`; `uparivanje.NOVI|POSTOJI|SLICAN|PRIJAVLJEN|GRESKA`, `kljuc(prezime, ime)`, `kandidati(red, takmicari, pol)`, `oceni(red, takmicari, prijavljeni, pol)`, `nadjiKlub(tekst, klubovi)`, `nadjiStavku(oznaka, stavke)`; sve pravila i stringovi iz POPIS 8.6 i 8.7 doslovno (`lepoIme` preko `toLocaleUpperCase('sr-Latn')` poređenja i title-case po rečima; `MB_CASE_TITLE` ekvivalent: prvo slovo svake reči veliko, ostalo malo).

- [ ] **Step 1: Testovi**: port svih PHP tvrdnji iz 9.6 i 9.7 (čisti deo), uključujući fikstura fajlove kroz `citac` (9 redova, red 7 Herceg; 4 reda, red 3 `vk` + `nedostaje ime`). Dodaj: duplikat u fajlu se ne ocenjuje ovde (to je Task 6), `datum('13.5.14')` → 2014-05-13.
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi.**

### Task 6: Model Uvoz

**Files:**
- Create: `electron/modeli/uvoz.cjs`
- Test: `tests/modeli-uvoz.test.cjs`
- Reference: POPIS 8.1, 8.8, 9.7 (`test_uvoz_upis_u_bazu`), 10.11 do 10.16; `PHP projekat\app\Modeli\Uvoz.php`

**Interfaces:**
- Produces `napravi(baza, podesavanja) → { pripremiFajl(putanja, imeFajla, takmicenjeId): Fajl (POPIS 8.1 struktura: ime, vrsta, klub_tekst, klub_id, pol, oznake[], redovi[], greske[]), upisi(takmicenjeId, fajlovi, izbor): {prijavljeno, novih, postojecih, vec, preskoceno, upozorenja} }` po POPIS 8.8. Ruling: faza 2 upisa ide u JEDNOJ transakciji (`baza.transakcija`), pa greška baze ne ostavlja polovičan uvoz (POPIS 10.15); kategorije/programi iz oznaka se prave unutar iste transakcije. ID brojevi: `takmicari.sledeciIdBroj()` pa `sledeci()` kao PHP.
- Consumes: `takmicari.cjs`, `klubovi.cjs`, `sifarnici.cjs`, `prijave.cjs` (`dodajJednu`, `prijavljeniTakmicari`), `uvoz/citac.cjs`, `tumac-prijave.cjs`, `uparivanje.cjs`.

- [ ] **Step 1: Testovi**: port POPIS 9.7 `test_uvoz_upis_u_bazu` u celini (nad `tokSeme` + `docxPrimer`), plus: duplikat imena u istom fajlu → drugi red `greska` sa napomenom `isti takmičar je već u redu 1`; dva fajla sa istom novom kategorijom „I“ → jedna kategorija; `lekarski_sprecava_prijavu = 'da'` → novi takmičar upisan, prijava preskočena, `novih 1`, `preskoceno` ima poruku; greška u fazi 1 (nepostojeći klub) ne upisuje ništa; `izbor.pol ''` sa redom `novi` baca `Izaberite pol (M ili Ž) za fajl prijava.docx: potreban je za nove takmičare.`
- [ ] **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi.**

### Task 7: IPC za takmičenja, prijave, uvoz; najava poruka; aktivno

**Files:**
- Modify: `electron/api.cjs`, `electron/moduli.cjs`, `electron/main.cjs` (ako treba), `src/okvir/Poruke.jsx` (`najavi(tekst, vrsta)` + prikaz pri promeni ekrana), `src/App.jsx` (`FIKSNO` dobija `takmicenja`, `prijave`; na promenu hasha prikaži najavljene poruke)
- Test: `tests/ipc.test.cjs` (dopuna guard testa sa novim modulima), `tests/poruke-najava.test.mjs` za čist red najava (`src/najava.js`: `dodaj`, `pokupi`)

**Interfaces:**
- MODULI: `takmicenja: ['sva','nadji','prazno','sacuvaj','izaberiGrb','sacuvajGrb','ukloniGrb','obrisi','otvori','stanje']`, `prijave: ['lista','podaci','dodaj','izmeni','sprava','ucesce','obrisi','potvrda','startni','noviTakmicar','stanje']`, `uvoz: ['izaberiFajlove','pripremi','upisi']`.
- Handleri: `takmicenja.sva()` → redovi + `stanje` (stanjePripreme) + `status` po aktivnom; `sacuvaj(p, id)` → `{id, novo}` i za novo postavlja `aktivno_takmicenje` i šalje renderer-u da emituje `app:aktivno` (renderer sam dispatchuje posle odgovora); `izaberiGrb()` → putanja ili null (dijalog sa roditeljem kao faza 2); `sacuvajGrb(id, polje, putanja)` → `{vrednost, url}`; `ukloniGrb(id, polje)`; `otvori(id)` → `{korak, naziv, stanje}` (postavlja aktivno, vraća podatke za poruku i skretanje po POPIS 4.5); `obrisi(id)` (prazni aktivno ako je ono); `nadji(id)` dodaje `grb_levo_url`/`grb_desno_url` (file URL sa `?v=` kao faza 2). `prijave.podaci(pol|null)` → `{takm, prijave (sa lek_ne_vazi), upozorenja: string[], takmicari (svi, sa klub_skr), prijavljeni: number[], klubovi, kategorije, programi, sprave: {M, Z}, stanje, ukupno, sledeciIdBroj}` (jedan poziv za ceo ekran); `dodaj(ids)`, `izmeni(id, polje, vrednost)` → `{prijava}`, `sprava(id, spravaId, radi)`, `ucesce(id, ucesce)`, `obrisi(id)`, `potvrda(klubId, potvrdjeno)`, `startni()` → `{dodeljeno}`, `noviTakmicar(p)` → `{takmicar_id, prijava_id, dodato, preskoceno, upozorenja}` (POPIS 6.5), `stanje()` → stanjePripreme aktivnog. `uvoz.izaberiFajlove()` → putanje (dijalog, multi, filter docx/xlsx) ili `[]`; `pripremi(putanje)` → `{fajlovi: Fajl[], greske: string[]}` (po fajlu `pripremiFajl`, greške kao `{ime}: {poruka}`); `upisi(fajlovi, izbor)` → rezultat. Svi handleri rade nad aktivnim takmičenjem (`Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.` kad ga nema). Id-jevi se pretvaraju `Number()`.

- [ ] **Step 1: Testovi (guard + najava). Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_DEBUG=1 npx electron .` startuje bez greške guard-a.**

### Task 8: Komponente Koraci i StanjeOznake; ekran Takmičenja (lista)

**Files:**
- Create: `src/komponente/Koraci.jsx`, `src/komponente/StanjeOznake.jsx`, `src/ekrani/Takmicenja.jsx`
- Modify: `src/App.jsx` (ruta `takmicenja`, `takmicenja/novo`, `takmicenja/izmeni`), `src/okvir/Traka.jsx` (sluša `app:aktivno`, već postoji)
- Reference: POPIS 2 (`status`), 4.2, 4.5, 4.6, 4.8, 4.9, 4.11, 5; snimak stvarnog PHP ekrana (lista sa kolonama Naziv i mesto / Datum / E sudija / Status / Priprema / dugmad)

**Interfaces:**
- `Koraci({stanje, tekuci, takmId})` crta `nav.koraci` tačno po POPIS 5 (tekstovi, klase `korak tekuci ok fali iskljucen`, `aria-current`, ikone); `StanjeOznake({stanje})` po POPIS 4.9.
- Ekran: kartica `Sva takmičenja`, dugme `Novo takmičenje` kbd Alt+N (`data-fokus`, vodi na `#/takmicenja/novo`; `app:novi` isto), tabela kolone i širine POPIS 4.8 (fleks / 110 / 78 / 112 / 330 / 150), prazno stanje, red 52 px sa nazivom (700 kad aktivno) i mestom, status čip, `StanjeOznake`, dugmad `Izmeni` (link) i `Otvori`; `Tabela` komponenta sa `naOtvori` = otvori; Enter na dugmetu/linku ne otvara red (POPIS 4.11). `otvori(id)`: `gim.takmicenja.otvori(id)` → `najavi(poruka po POPIS 4.5, 'upozorenje')` (ili bez poruke za `spremno`), `document.dispatchEvent(app:aktivno)`, hash na `#/prijave`, `#/rotacije` ili `#/takmicenje` (ekrani iz kasnijih faza prikazuju `Prazno`). Tekst ispod tabele doslovno.

- [ ] **Step 1: Test** `tests/koraci.test.mjs` za čistu `src/koraciStanje.js` → `koraci(stanje, tekuci, takmId)` vraća 4 koraka sa `{kljuc, naslov, opis, link, stanje}` po POPIS 5 (slučajevi: bez takmId; prijave 0; nepotpune 2 i nepotvrđeni 1; spremno). **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; u aplikaciji (seme preko `alati/primer-podaci.cjs` + ručno takmičenje) lista i Otvori rade; uporedi sa snimkom PHP liste.**

### Task 9: Forma takmičenja (novo i izmena)

**Files:**
- Create: `src/ekrani/TakmicenjeForma.jsx`, `src/komponente/IzborBroja.jsx` (grupa 1..6, `aria-pressed`, strelice levo/desno, `disabled` kad `imaOcena`)
- Modify: `src/App.jsx` (naslovi `Novo takmičenje` / `Takmičenje: podaci`)
- Reference: POPIS 4.3, 4.4, 4.7, 4.10, 4.11 (`takmicenje-forma.js`); snimak stvarne PHP forme

**Interfaces:**
- Forma na celu stranu: `Koraci` iznad (samo novo ili aktivno), dve kartice (`Takmičenje` sa ID, `Zvanični podaci (za bilten i štampu)`), polja, placeholder-i, pomoćni tekstovi, radio `pravilo_e`, `ekipno_broji` 44 px, kućica pomeraj, `datalist` klubova za domaćina, grb blokovi (slika 36 px, kućica `ukloni`, dugme `Izaberi sliku` → `gim.takmicenja.izaberiGrb`), kućica `zavrseno` samo u izmeni, dugmad `Sačuvaj i pređi na prijave`/`Sačuvaj` kbd Enter, `Otkaži` kbd Esc (vodi na listu; Esc samo iz polja forme), `Obriši` u izmeni sa `confirm('Obrisati ovo takmičenje? Moguće je samo ako nema prijava.')`.
- Čuvanje: `gim.takmicenja.sacuvaj(p, id)`; greške u `Greske` bloku (vrednosti ostaju, datum sirov); posle uspeha grbovi: za svako polje `ukloni` → `ukloniGrb`, izabran fajl → `sacuvajGrb` (greška grba kao toast, ostalo sačuvano, kao PHP); novo → `najavi('Takmičenje „{naziv}“ je napravljeno i postavljeno kao aktivno. Prijavite takmičare.', 'ok')`, `app:aktivno`, hash `#/prijave`; izmena → toast `Takmičenje „{naziv}“ je sačuvano.` i ostaje na formi sa ponovo učitanim podacima.

- [ ] **Step 1: Test** `tests/takmicenje-forma.test.mjs` za čistu `src/ekrani/takmicenjeForma.js` → `izForme(stanjeForme)` (pretvara polja u `p` za model: brojevi, 0/1) i `uFormu(red)` (datum u `dd.mm.gggg.`). **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; u aplikaciji: novo takmičenje sa greškama i bez, izmena sa grbom, brisanje; uporedi sa snimkom PHP forme.**

### Task 10: Ekran Prijave

**Files:**
- Create: `src/ekrani/Prijave.jsx`, `src/komponente/DijalogTakmicar.jsx` (`<dialog>` sa `showModal`), `src/ekrani/prijaveFilter.js` (čist: `vidljivTakmicar(red, {upit, klub})`, `grupisiPoKlubu(prijave, stanje)`, `sirinaSprava(n)`, `legenda(sprave)`)
- Modify: `src/App.jsx` (ruta `prijave` sa `?pol=`), `src/stil/app.css` samo ako nedostaje klasa iz PHP CSS-a (`baza-red`, `vec`, `klub-red`, `klub-naslov`, `potvrda`, `sprave-red`, `sprava-dugme`, `izbor-mali`, `upozorenje-red`, `dijalog` postoje iz faze 0 kopije; proveri)
- Test: `tests/prijave-filter.test.mjs`
- Reference: POPIS 6.1 do 6.6; `PHP projekat\app\Pogledi\prijave.php`, `public\assets\js\prijave.js`

**Interfaces:**
- Ekran učitava sve preko `gim.prijave.podaci(pol)`; posle svake radnje ponovo `podaci`. Raspored, širine, tekstovi, čipovi, upozorenja, grupisanje po klubu sa potvrdom, red prijave sa startnim brojem, kategorijom, programom, spravama, učešćem i kantom, podnožje sa legendom i `Sledeće: Rotacije` (poziva `gim.prijave.stanje()` i radi `dalje` logiku POPIS 6.2 u rendereru: `najavi` + hash `#/rotacije`), levi panel sa pretragom, klubom, polom (hash `?pol=`), listom sa kućicama, `Izabrano: N`, `Prijavi` kbd Enter; tastatura i ponašanja POPIS 6.6 doslovno (Enter u pretrazi sa tačno jednim vidljivim, ArrowDown, strelice po kućicama, Enter u startnom broju prelazi na sledeći red preko klubova, potvrda brisanja `Ukloniti prijavu za {Prezime Ime}?`, poruke `Sačuvano.`, `Spisak kluba je potvrđen.`, `Potvrda je uklonjena.`, `Prijavljeno: N.` + ` Preskočeno: …`, `Dodeljeno startnih brojeva: N.`, `Označite bar jednog takmičara.`); filter kluba desno pamti se u `sessionStorage` po takmičenju; dijalog `Novi takmičar` (polja, predizbor pola i kluba, `Sačuvaj i prijavi` kbd Enter, `Otkaži` kbd Esc, greška u dijalogu, posle uspeha poruke POPIS 6.6 i fokus na prvu spravu novog reda). Dugme `Uvezi iz fajla` zove `gim.uvoz.izaberiFajlove()` → `pripremi` → hash `#/uvoz` sa rezultatom u modulnom stanju (`src/uvozStanje.js`, vidi Task 11).

- [ ] **Step 1: Testovi** za `prijaveFilter.js` (vidljivost sa pretragom i klubom, grupisanje i redosled klubova sa `0` na kraju, širina sprava `6*30+5*3+16 = 211`, legenda sa spajanjem skraćenica). **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; u aplikaciji nad primer podacima: prijavi 3 takmičara, promeni kategoriju, ugasi spravu, učešće VK, startni brojevi, potvrda kluba, novi takmičar kroz dijalog, brisanje; uporedi sa snimkom PHP Prijava.**

### Task 11: Ekran Uvoz prijava

**Files:**
- Create: `src/ekrani/Uvoz.jsx`, `src/uvozStanje.js` (modulno stanje: `postavi(fajlovi)`, `dodaj(fajlovi)`, `ukloni(i)`, `ocisti()`, `uzmi()`; izbori zapisničara žive u React stanju ekrana i prežive dodavanje i uklanjanje fajlova: Ruling, POPIS 10.11), `src/ekrani/uvozBrojac.js` (čist: `prebroj(fajlovi, izbor)` → po fajlu `{n, prijavljeni, greske}` i ukupno `{ukupno, novih, postojecih}`, `nedostajePol(fajlovi, izbor)` → indeks fajla ili null)
- Modify: `src/App.jsx` (ruta `uvoz`), `src/stil/app.css` (klase `uvoz-*` postoje iz faze 0 kopije; proveri)
- Test: `tests/uvoz-brojac.test.mjs`
- Reference: POPIS 7.1 do 7.8; `PHP projekat\app\Pogledi\uvoz.php`, `public\assets\js\uvoz.js`

**Interfaces:**
- Ekran bez fajlova → `najavi('Na ekranu Prijave kliknite „Uvezi iz fajla“ i izaberite prijavu kluba (.docx ili .xlsx).', 'info')` + hash `#/prijave`. Inače po POPIS 7.7: uvod (sa dodatkom kad `lekarski_sprecava_prijavu`), po fajlu kartica sa čipom vrste, brojačem, `Ukloni fajl`, trake upozorenja (greške tumača, klub nije pronađen), blok podešavanja (klub, pol, oznake sa `+ nova: X` / `+ novi: X`), tabela redova sa bojama po statusu, kućicom, postupkom; podnožje sticky: zbir, `Dodaj još fajlova` (dijalog → `pripremi` → `dodaj`), `Otkaži` kbd Esc (confirm `Otkazati uvoz? Ništa neće biti upisano.`), `Uvezi prijave` kbd Ctrl+Enter (onemogućeno kad je ukupno 0; pre slanja provera pola POPIS 7.8 sa toastom i fokusom). Upis: `gim.uvoz.upisi(fajlovi, izbor)` → `najavi` poruke POPIS 7.5 (1 do 3) → `ocisti()` → hash `#/prijave`; greška → toast, ekran ostaje sa izborima.

- [ ] **Step 1: Testovi** za `uvozBrojac.js` (brojanje po statusima i kućicama, postupak `novi`/`postojeci`, fajl bez pola sa novim redom). **Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; u aplikaciji: uvezi `tests/fajlovi/prijava-partizan.docx` nad primer bazom (dva takmičara iz `alati/probni-podaci` logike: dodaj u `primer-podaci.cjs` Neorčić Noah 2017 i Herceg Aron 2013 ako ih nema), proveri žute/zelene redove, izmeni izbore, dodaj drugi fajl, potvrdi; uporedi sa snimkom PHP Uvoza.**

### Task 12: Primer podaci (takmičenje i prijave) i dokumentacija

**Files:**
- Modify: `alati/primer-podaci.cjs` (dodaje takmičenje `Jesenji kup 2026` iz JSON `takmicenje` i prijave svih takmičara sa kategorijom `Kadet`, programom `C program`, spravama pola, `clan_ekipe`/`van_konkurencije` iz JSON-a, startnim brojevima; ocene ostaju za fazu 5; idempotentno po nazivu takmičenja i paru takmičenje/takmičar; dodaj i Neorčić Noah 2017 i Herceg Aron 2013 bez prijave, za probu uvoza), `README.md` (red o probi uvoza sa `tests/fajlovi/`), `docs/proizvod/TOK-PRIPREME.md` (već kopiran; ne menja se)
- Test: `tests/alati-primer.test.cjs` (dopuna: posle uvoza `prijave` ima onoliko redova koliko JSON ima takmičara, svaka sa 4 ili 6 sprava po polu, startni brojevi iz JSON-a; dva puta ne duplira)

- [ ] **Step 1: Test. Step 2: Pada. Step 3: Napiši. Step 4: Prolazi; `GIM_PODACI=<temp> node alati/primer-podaci.cjs` pa aplikacija: Takmičenja pokazuje `Jesenji kup 2026` sa stanjem, Prijave grupisane po klubu.**
