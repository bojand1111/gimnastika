# Faza 5: popis PHP verzije za ekran Unos ocena (ocene, nacrt, potvrda, ispravka, odustajanje, napredak)

Izvor: `C:\Users\bojan\Desktop\Takmicarski program` (PHP 8 + MySQL, verzija 1.2.0). Popis je samo čitanje, ništa u PHP projektu nije menjano.
Svi stringovi u navodnicima su doslovni (srpski, latinica sa dijakriticima). Putanje su relativne u odnosu na koren PHP projekta.
Zajednički helperi (`App.api`, `App.obavesti`, `App.potvrdi`, `trazimAktivno`, `aktivnoIdIliGreska`, API greške 400/404/405/500, `str()` trim) su opisani u popisima faza 2 do 4; ovde se ponavljaju samo razlike.

Gde se UI razlikuje od slike `dizajn/slike/08-unos-ocena.png` i odeljka 08 u `docs/SPECIFIKACIJA.md`, važi kod. Slika se poklapa sa kodom (traka sa polom, spravama, rotacijama i napretkom; kartica sa naslovom "Sprava · Rotacija R · Grupa"; redovi; dve kartice ispod: Prečice i Izmene na ovoj spravi). Razlike: slika ima tabove sprava sa kratkim nazivima ("Dv. razboj"), kod koristi pun `naziv` sprave; slika ima oznaku ▶ u koloni # trenutnog reda, kod ima samo klasu `trenutni` (pozadina i okvir); kod ima i stanje "Ne radi ovu spravu" (prugasti red) i "nema grupa, prikazani su svi prijavljeni".

Fajlovi: `app/Kontroleri/unos.php` (152), `app/Pogledi/unos.php` (107), `public/assets/js/unos.js` (278), `app/Modeli/Ocene.php` (359), `app/Racun/Ocena.php`, `app/Racun/Broj.php` (već portovani u fazi 1: `electron/racun/{ocena,broj}.mjs`), `app/Kontroleri/api.php` (akcije `ocena-*`), `testovi/TokTest.php` (`test_ocene_unos_ispravka_odustajanje`), `migracije/001_pocetna.sql` (`ocene`, `ocene_e`, `izmene_ocena`).

---

## 0. Zajedničko

### 0.1 Brojevi
Sve ocene su celi brojevi u hiljaditim delovima (13,050 = 13050). PHP ih čuva kao `DECIMAL(6,3)` tekst ("13.050", `Broj::uBazu`/`izBaze`); Electron ih čuva kao INTEGER (hiljaditi) u `ocene.d/e/odbitak/konacna` i `ocene_e.vrednost`, pa `uBazu` nije potreban. `Broj::izUnosa("8,3"|"8.3"|"8")` → 8300; prazno ili neispravno (više od 2 cifre ispred, više od 3 decimale, > 20,000, slova) → `null`. `Broj::prikaz(v)` → "8,300" (null → ""). JSON snimci u `izmene_ocena.staro/novo` u PHP-u sadrže tekst baze ("8.300"); u Electron-u sadrže cele brojeve (hiljaditi). Uvoz PHP kopije (faza 7) mora da pretvori.

### 0.2 Račun (već u `electron/racun/ocena.mjs`, testovi faze 1)
`konacnaE(e[], pravilo, zaokruzivanje)`: `odbaci_krajnje` sa ≥ 3 sudije odbacuje jednu najvišu i jednu najnižu, pa prosek; `prosek_svih` prosek svih; prosek se odseca (`odseci`) ili zaokružuje (`zaokruzi`, podešavanje `e_zaokruzivanje`) na tri decimale. `konacna(d, e, odbitak) = max(0, d + e − odbitak)`. Primer iz specifikacije: D 4,800 + E (8,300 8,100 8,400 8,200 → 8,250) − 0 = 13,050.

### 0.3 Aktivno takmičenje
`unos*` rute zovu `trazimAktivno()` (bez aktivnog: flash "Prvo izaberite aktivno takmičenje." + redirect `takmicenja`); API `aktivnoIdIliGreska()`. Isto kao faze 3 i 4 (`src/ekrani/aktivno.js`).

---

## 1. Šema baze (postoji u Electron migraciji 001, sa kaskadama)

### ocene
`id`, `prijava_id` (FK prijave CASCADE), `sprava_id` (FK sprave RESTRICT), `d`, `e`, `odbitak`, `konacna` (hiljaditi ili NULL), `status` TEXT (`nacrt` podrazumevano, `uneto`, `ispravljeno`, `odustao`), `broj_ispravki` INT 0, `uneto_u` TEXT NULL, `kreirano`, `izmenjeno`. UNIQUE `(prijava_id, sprava_id)`, indeks `sprava_id`.

### ocene_e
`ocena_id` (FK ocene CASCADE), `sudija` INT (1..N), `vrednost` (hiljaditi, NULL). PK `(ocena_id, sudija)`.

### izmene_ocena
`id`, `ocena_id` (FK ocene CASCADE), `vreme` TEXT (UTC `Baza.sad()`), `razlog` TEXT '' , `staro` TEXT (JSON), `novo` TEXT (JSON).

### Veze sa ranijim fazama
- `Prijave.postaviSpravu(…, false)` je blokiran kad postoji ocena sa `status <> 'nacrt'` na toj spravi, a nacrt se briše (faza 3). `Prijave.obrisi` blokiran kad ima unetih ocena. Brisanje prijave kaskadno briše ocene.
- `Takmicenja.proveri`: `broj_e_sudija` se ne menja kad ima ocena `status <> 'nacrt'` (faza 3); `ima_ocena`/`broj_ocena` za formu.
- `Grupe.grupaNaSpravi` (faza 4) određuje grupu i redosled nastupa.

---

## 2. Model Ocene (`app/Modeli/Ocene.php`)

### 2.1 Čitanje
- **`nadji(prijavaId, spravaId)`** → red `ocene` + `e_sudije: {sudija: vrednost}` (iz `ocene_e ORDER BY sudija`) ili `null`.
- **`zaSpravu(spravaId, prijavaIds[])`** → objekat `{prijava_id: ocena sa e_sudije}` (prazan za praznu listu).
- **`zaTakmicenje(takmicenjeId)`** → `{prijava_id: {sprava_id: ocena sa e_sudije}}` za sve ocene prijava tog takmičenja (koristi rang liste, faza 6, i `napredak`).
- **`izmeneNaSpravi(takmicenjeId, spravaId, limit = 5)`** → poslednjih 5 redova `izmene_ocena` (JOIN ocene, prijave, takmicari; `WHERE p.takmicenje_id = ? AND o.sprava_id = ? ORDER BY i.vreme DESC, i.id DESC`) sa `ime, prezime`, `staro`/`novo` dekodirani iz JSON-a (neispravan JSON → `{}`), `opis = opisIzmene(staro, novo)`.
- **`opisIzmene(staro, novo)`** (statično, čisto): delovi spojeni sa ` · `, redom: `d` ("D") pa `odbitak` ("odbitak") ako se razlikuju: `"{oz} {prikaz(staro)} → {prikaz(novo)}"`; zatim za svaku sudiju iz unije ključeva (`staro.e_sudije` pa novi) čija se vrednost razlikuje: `"E{i} {staro} → {novo}"`; ako `novo.status === 'odustao'` a `staro.status !== 'odustao'`: `"označeno odustajanje"`; na kraju ako se `konacna` razlikuje: `"konačna {staro} → {novo}"`. Prazna vrednost je `Broj::prikaz(null) = ""` i razmak posle strelice ostaje, pa odustajanje nad unetom ocenom daje npr. `"D 4,800 →  · odbitak 0,000 →  · E1 8,300 →  · E2 … · označeno odustajanje · konačna 13,050 → "` (dupli razmak i strelica na kraju; port zadržava doslovno). Primer iz testa, ispravka sa odbitkom: `"odbitak 0,000 → 0,100 · E2 8,100 → 7,900 · konačna 13,050 → 12,950"`. Poređenje je strogo nad vrednostima iz JSON-a (PHP tekst "8.300", Electron celi brojevi).
- **`napredak(takmicenjeId, pol, grupe, sprave, pomeraj)`** → `{rotacija, ukupno_rotacija, obradjeno, ukupno, gotovo}` (`pol` i `pomeraj` se ne koriste: brojanje ne zavisi od redosleda članova; port ih izostavlja): `n = max(1, count(sprave))`; `ocene = zaTakmicenje`; za `r = 1..n`, za svaku grupu: `sprava = sprave[pozicijaURotaciji(pocetna, r, n) − 1]` (nema → preskoči); za svakog člana grupe (osnovni redosled, bez obzira na ručni): ako prijava radi tu spravu (`prijava_sprave`): `ukupno++`; `status = ocene[pid][sprava] ?? 'nacrt'`; `!== 'nacrt'` → `obradjeno++`, inače prva takva rotacija je `prvaNepotpuna`. Rezultat: `rotacija = prvaNepotpuna ?? n`, `ukupno_rotacija = n`, `gotovo = prvaNepotpuna === null && ukupno > 0`. (Neraspoređeni i prijave bez grupe se ne broje. Koristi i Početna/Pregled, faza 7: "rotacija u toku".)

### 2.2 `sacuvaj(takmicenjeId, prijavaId, spravaId, ulaz, potvrdi, razlog = '')` → `{ocena, prikaz}`
`ulaz = {d: '4,8', e: ['8,3', '8.1', '', ''], odbitak: ''}` (tekstovi iz polja; `e` je niz po indeksu sudije 0..N−1).
1. `takm = takmicenje(id)` (`'Takmičenje ne postoji.'`); `proveriPar`: prijava mora postojati i pripadati takmičenju (`'Prijava ne postoji na ovom takmičenju.'`), i mora raditi spravu (`prijava_sprave`): `'{Prezime} {Ime} nije prijavljen/a na ovu spravu.'`.
2. `brojSudija = takm.broj_e_sudija`; `postojeca = nadji`; `bilaUneta = postojeca && status in (uneto, ispravljeno)`.
3. Ako `!potvrdi && bilaUneta` → vraća `odgovor(postojeca)` bez promene (nacrt preko unete ocene ne menja ništa).
4. `d = parsiraj(ulaz.d, 'D')`; `e[i] = parsiraj(ulaz.e[i−1] ?? '', 'E' + i)` za `i = 1..brojSudija`; `odbitakTekst = trim(ulaz.odbitak ?? '')`; `odbitak = prazno ? (potvrdi ? 0 : null) : parsiraj(odbitakTekst, 'Odbitak')`. **`parsiraj(tekst, naziv)`**: trim; prazno → `null`; `Broj::izUnosa` null → `RuntimeException('{naziv}: neispravna vrednost „{tekst}“ (0 do 20, najviše tri decimale).')`.
5. `svaE = nijedna e nije null`; `E = svaE ? konacnaE(e, takm.pravilo_e, e_zaokruzivanje) : null`; `konacna = (d !== null && E !== null) ? konacna(d, E, odbitak ?? 0) : null`.
6. Ako `potvrdi`: `d === null` → `'Unesite D ocenu.'`; `!svaE` → `'Unesite sve E ocene ({brojSudija}).'`; `bilaUneta && trim(razlog) === ''` → `'Za ispravku unete ocene obavezan je razlog.'`.
7. `red = {d, e: E, odbitak, konacna, izmenjeno: sad}`; ako `potvrdi`: `status = bilaUneta ? 'ispravljeno' : 'uneto'`, `uneto_u = sad`; inače ako `postojeca === null || postojeca.status !== 'odustao'`: `status = 'nacrt'` (nacrt preko `odustao` ne menja status: ostaje `odustao`, ali brojevi se upisuju).
8. Transakcija: nova ocena → `INSERT ocene` (+ `prijava_id, sprava_id, kreirano`); postojeća → ako `potvrdi && bilaUneta`: `broj_ispravki + 1` i `INSERT izmene_ocena {ocena_id, vreme: sad, razlog: trim, staro: JSON snimak(postojeca), novo: JSON snimak(red + e_sudije)}`; `UPDATE ocene`; `DELETE ocene_e WHERE ocena_id`; `INSERT ocene_e` za svaku `e[i] !== null`.
9. Vraća `odgovor(nadji(...))`.
- **`snimak(o)`** → `{d, e, odbitak, konacna, status, e_sudije: {i: vrednost}}` (vrednosti kako su u bazi).
- **`odgovor(o, takm)`** → `{ocena: o (sirov red baze + e_sudije), prikaz: {d, e, odbitak, konacna: svako `Broj::prikaz(izBaze(x))`, tekst "4,800" ili '' kad je null; e_sudije: [prikaz ili '' po sudiji 1..N], status, broj_ispravki}}`.
- Potvrda nad postojećim `nacrt` ili `odustao` redom daje `status 'uneto'` bez razloga, bez zapisa u `izmene_ocena` i bez promene `broj_ispravki` (`bilaUneta` je false): ispravka je samo nad `uneto`/`ispravljeno`.

### 2.3 `odustao(takmicenjeId, prijavaId, spravaId)` → `{ocena, prikaz}`
`proveriPar`; `red = {d: null, e: null, odbitak: null, konacna: null, status: 'odustao', uneto_u: sad, izmenjeno: sad}`; nova → INSERT; postojeća: ako je bila `uneto`/`ispravljeno`: `broj_ispravki + 1` i `izmene_ocena` sa `razlog: 'Označeno odustajanje'` (`staro` snimak postojeće, `novo` snimak reda); `UPDATE`; `DELETE ocene_e`. (Odustajanje nad nacrtom ne pravi zapis izmene, ali briše unete brojeve.)

### 2.4 `vrati(takmicenjeId, prijavaId, spravaId)` → `{ocena, prikaz}`
`proveriPar`; `nadji` null → `'Nema šta da se vrati.'`; `UPDATE ocene SET status = 'nacrt', uneto_u = NULL, izmenjeno`. (Brojevi ostaju kakvi su: posle odustajanja su obično null, ali zakasneli nacrt koji stigne posle `odustao` upisuje brojeve uz status `odustao`, pa ih `vrati` vraća kao nacrt sa tim brojevima; `vrati` nad unetom ocenom bi je vratio u nacrt bez zapisa, UI to ne nudi.)

### 2.5 Rezime pravila
- Nacrt se čuva pri svakom napuštanju polja; delimičan unos je dozvoljen; `konacna` samo kad su D i sve E unete.
- Potvrda traži D i sve E; prazan odbitak = 0; `status uneto`.
- Ispravka = potvrda nad unetom; traži razlog; `status ispravljeno`, `broj_ispravki++`, zapis `izmene_ocena`.
- Nacrt nad unetom ne menja ništa (zaštita od slučajnog upisa).
- Odustajanje briše brojeve, status `odustao`; nad unetom pravi zapis izmene "Označeno odustajanje". Vraćanje → `nacrt`.
- Ocena na spravi koju prijava ne radi → greška; prijava tuđeg takmičenja → greška.

---

## 3. API akcije (`app/Kontroleri/api.php`), nad aktivnim takmičenjem

| akcija | ulaz (JSON telo `t`) | poziv | odgovor |
|---|---|---|---|
| `ocena-nacrt` | `prijava_id, sprava_id, d, e[], odbitak` | `sacuvaj(aktivno, int, int, t, false, str('razlog'))` | `{ok, ocena, prikaz}` |
| `ocena-potvrdi` | isto + `razlog` | `sacuvaj(aktivno, int, int, t, true, str('razlog'))` | `{ok, ocena, prikaz}` |
| `ocena-odustao` | `prijava_id, sprava_id` | `odustao(aktivno, int, int)` | `{ok, ocena, prikaz}` |
| `ocena-vrati` | `prijava_id, sprava_id` | `vrati(aktivno, int, int)` | `{ok, ocena, prikaz}` |

---

## 4. Kontroler (`app/Kontroleri/unos.php`), GET `unos?pol=&sprava=&rot=`
1. `takm`, `tid`, `pomeraj = takm.pomeraj_redosled === 1`.
2. `pol = get('pol')`; ako nije `M`|`Z`: `Z` ako takmičenje ima bar jednu prijavu ženskog pola, inače `M`.
3. `sprave = Sifarnici::sprave(pol)`; `brojSprava = max(1, count)`; `grupe = Grupe::lista(tid, pol)`; `napredakPola = Ocene::napredak(tid, pol, grupe, sprave, pomeraj)`.
4. `rot = get_int('rot')`; ako je null ili van `1..brojSprava`: `rot = napredakPola.rotacija` ("nastavi gde se stalo").
5. `spravaId = get_int('sprava')`; `sprava` = ta sprava iz liste ili, ako je nema: podrazumevano `sprave[0]`, pa: za svaku spravu `i` redom, `g = grupaNaSpravi(grupe, i + 1, rot, brojSprava, pomeraj)`; ako nema grupe preskoči; prva sprava sa grupom se pamti (`prvaSaGrupom`) i odmah postaje izabrana; ako bilo koji član neke grupe ima `status nacrt` (ili nema ocenu) na toj spravi → ta sprava je konačno izabrana i oba ciklusa se prekidaju (`break 2`). Rezultat: `sprave[0]` kad nijedna sprava nema grupu u toj rotaciji; inače prva sprava sa nezavršenim unosom; inače (sve uneto) prva sprava sa grupom. Proverava se i član koji ne radi spravu (nema red → 'nacrt'): mana, port zadržava.
6. Ako `sprava === null` (pol nema sprava): prazan prikaz (`sprave: [], sprava: null, rot: 1, brojSprava: 1, grupa: null, redovi: [], napredak: {0,0,0}, izmene: [], bezGrupa: true`) BEZ `sadrzaj-fiksno` (strana skroluje) i kraj.
7. `pozicija` = indeks sprave + 1; `grupa = grupaNaSpravi(grupe, pozicija, rot, brojSprava, pomeraj)`; `bezGrupa = grupe === []`; ako `grupa === null && bezGrupa`: `grupa = {id: 0, naziv: 'Svi prijavljeni', clanovi}` gde su članovi SVE prijave tog pola koje rade spravu (`JOIN prijava_sprave ps ON ps.sprava_id = sprava`), polja `prijava_id, startni_broj, van_konkurencije, ime, prezime, pol, klub_skr, kategorija, program`, `ORDER BY ISNULL(startni_broj), startni_broj, prezime, ime` (bez startnog broja na kraju). Ako `grupa === null` a grupe postoje → prazno stanje "Nijedna grupa…" (odeljak 5).
8. `redovi` i `napredak` (za grupu): `ids` = prijave članova; `radi` = skup prijava sa `prijava_sprave` za spravu; `ocene = zaSpravu(sprava, ids)`; za svakog člana `i`: `o = ocene[pid]`; `status = o.status ?? 'nacrt'`; `e_sudije` = `[prikaz(o.e_sudije[j]) ili '' za j = 1..brojSudija]`; red = `{rb: i + 1, prijava_id, startni_broj, ime: "{Prezime} {Ime}", pol, opis: [klub_skr, kategorija, program] bez praznih spojeni ' · ', vk: van_konkurencije === 1, radi, status, d, e_sudije, e, odbitak, konacna}` (prikazi sa `Broj::prikaz(izBaze(...))`, null → ''); `napredak` (samo za članove koji rade spravu): `ukupno++`, `status !== 'nacrt'` → `obradjeno++`, `odustao` → `odustalo++`.
9. Pogledu: `takm, pol, sprave, sprava, rot, brojSprava, grupa, redovi, napredak, izmene = izmeneNaSpravi(tid, sprava.id), bezGrupa, brojSudija = takm.broj_e_sudija, pravilo = takm.pravilo_e, zaokruzivanje = podesavanja.e_zaokruzivanje ('odseci')`; `sadrzajKlasa = 'sadrzaj-fiksno'`.

---

## 5. Pogled (`app/Pogledi/unos.php`)
- `kolone = '36px 44px minmax(0,1fr) 64px ' + '60px ' × brojSudija + '66px 60px 104px 118px'` (grid: #, St. br., Takmičar, D, E1..EN, E, Odb., Konačna, Status).
- `odustaoRec(pol)` = `Z` → "Odustala", inače "Odustao". `prvi` = prvi red koji radi spravu i ima status `nacrt` (`data-prvi`, 0 kad ga nema; JS ga ne čita, mrtav atribut: port ga izostavlja i početni fokus računa iz redova). `procenat = ukupno > 0 ? round(obradjeno × 100 / ukupno) : 0`.

### 5.1 Traka (`div.kartica`, red, razmak 16, padding 10/12)
- `div.izbor[aria-label=Pol]`: "ŽSG" (`unos?pol=Z`), "MSG" (`unos?pol=M`), aktivan `izabrano` (promena pola NE nosi spravu ni rotaciju: kontroler bira "gde se stalo").
- Ako `sprava`: `span.oznaka` "Sprava" + `div.izbor[aria-label=Sprava]` sa linkom po spravi (`unos?pol&sprava=id&rot=rot`, tekst `naziv`, aktivan `izabrano`); `span.oznaka` "Rotacija" + `div.izbor[aria-label=Rotacija]` linkovi `1..brojSprava` (`unos?pol&sprava&rot=r`, klasa `broj`, `min-width 40px`); razmak; napredak: traka 120×8 px (`--ground`, unutrašnji `#napredak-traka` širine `procenat%`, boja `--ok`), `span.broj` 15 px 600: `#napredak-obradjeno` " / " `#napredak-ukupno`, `span.sek` 13 px "obrađeno" + `#napredak-odustalo` = `" · {n} odustala|odustao"` kad `odustalo > 0` (reč po polu: Z → "odustala") ili prazno.

### 5.2 Prazna stanja
- `!sprava`: `div.kartica > div.prazno-stanje`: `<h2>` "Nema sprava za ovaj pol", `<p>` "Dodajte sprave u Podešavanjima."
- `grupa === null`: `<h2>` "Nijedna grupa nije na spravi {naziv} u rotaciji {rot}", `<p>` "Proverite početne sprave grupa na ekranu Rotacije.", `a.dugme` "Rotacije" (`rotacije?pol&rot`).

### 5.3 Kartica unosa (`section.kartica.raste#unos`, `data-sprava, data-sudija, data-pravilo, data-zaokruzivanje, data-pol, data-prvi`)
- Zaglavlje (visina 44, padding 0 12 0 16): `<h2>` 18 px 800 sa ikonom sprave (`sprave.ikona`, 24 px; prazno → bez ikone) i tekstom `"{naziv} · Rotacija {rot} · {grupa.naziv}"`; desno `span.sivo.mali`: "Konačna = D + E − odbitak · " + (`pravilo === 'odbaci_krajnje'` ? "E = prosek srednjih ocena (odbacuju se najviša i najniža)" : "E = prosek svih ocena") + (`bezGrupa` ? " · nema grupa, prikazani su svi prijavljeni" : "").
- `div.kartica-skrol[role=table][aria-label="Unos ocena"]`: `div.unos-zaglavlje[role=row]` (grid `kolone`): `#` (centar), "St. br.", "Takmičar", "D" (centar), "E1".."EN" (centar), "E" (centar), "Odb." (centar), "Konačna" (desno), "Status" (desno). Bez redova: `div.prazno` "Grupa je prazna."
- Red `div.unos-red[role=row][data-prijava][data-status][data-pol][data-ime="{Prezime Ime}"]` + klasa `ceka` ako `status === 'nacrt'`; `st = radi ? status : 'ne_radi'`:
  1. `span.unos-rb.broj.centar` = rb; 2. `span.broj` 15 px 600 = startni broj ili ''; 3. kolona sa `span.unos-ime` 15 px 600 = ime, čip `status status-vk` "VK" ako `vk`, ispod `span.mali.sivo` = opis.
  - `ne_radi`: `span.unos-pruga[grid-column: span brojSudija + 4]` "Ne radi ovu spravu"; `span.unos-status` sa `span.status` "–".
  - `odustao`: `span.unos-pruga` sa `<span 600>Odustala|Odustao</span><span>bez ocene na ovoj spravi</span>`; `span.unos-status`: `span.status.status-crn` (ikona `iks` 13 + "Odustala|Odustao") + `button.dugme.dugme-tekst.dugme-malo.vrati` "Vrati" (padding 0 6, visina 28).
  - inače (`zakljucan = st in (uneto, ispravljeno)`): `input.ocena[data-polje=d][aria-label="D ocena"][inputmode=decimal][autocomplete=off]` (vrednost prikaz), po sudiji `input.ocena[data-polje=e{j}][aria-label="E{j} ocena"]`, `span.unos-e.broj.centar` 16 px `--ink-2` = e ili "–", `input.ocena[data-polje=odbitak][aria-label=Odbitak]`, `span.konacna.unos-konacna` (+ `sivo` kad prazno) = konacna ili "–", `span.unos-status`: `uneto` → `span.status.status-ok` (ikona `kvacica` 13 + "Uneto"); `ispravljeno` → `span.status.status-warn` (ikona `olovka` 13 + "Ispravljeno"); inače `span.status` "Čeka"; ako `zakljucan`: `button.dugme.dugme-ikona.ispravi[aria-label="Ispravi ocenu"][title="Ispravi (F9)"]` 28×28 boja `--link` ikona `olovka` 16. Zaključana polja: klasa `zakljucano`, `readonly`, `tabindex=-1`.
- Ispod (`div.red`, `flex-shrink 0`): `section.kartica.raste` sa `span.oznaka` "Prečice" (u izvoru malim slovima; `text-transform: uppercase`, letter-spacing .06em) sa `div.sek` 13 px: `<kbd>Tab</kbd><kbd>Enter</kbd> sledeće polje`; `<kbd>Enter</kbd> na odbitku: potvrdi i pređi na sledećeg`; `<kbd>↑</kbd><kbd>↓</kbd> drugi takmičar`; `<kbd>F8</kbd> odustao/la`; `<kbd>F9</kbd> ispravi unetu ocenu`. `section.kartica#izmene` širine 470 px sa `span.oznaka` "Izmene na ovoj spravi" (isti uppercase stil): bez izmena `span.sivo.mali` "Još nema ispravki."; inače po izmeni red 13 px: `span.broj.sivo` = vreme `H:i` (UTC → lokalno `Europe/Belgrade`; u Electron-u lokalno vreme računara), kolona: `<span 600>{Prezime Ime}</span> · <span.broj>{opis}</span>` i ispod `span.mali.sivo` "Razlog: {razlog}".

### 5.4 CSS (već u `src/stil/app.css`, identično PHP-u)
`.unos-red` (grid, visina 50, padding 0 10, donja ivica), `.unos-red.trenutni` (pozadina `--primary-soft`, unutrašnji okvir 2 px `--primary`), `.unos-red.ceka` (`--sub`), `.ocena` (36 px, centar, 16 px 600, radijus 7, ivica `--line-2`), `.ocena:focus` (ivica 2 px `--ink` + senka), `.ocena.greska` (2 px `--bad`), `.ocena.zakljucano` (bez ivice i pozadine), `.konacna` (22 px 800 desno), `.unos-zaglavlje` (sticky, 30 px), `.unos-rb`, `.unos-red.ispravlja` (`--warn-soft`), `.unos-red.greska-cuvanja` (okvir `--bad`), `.unos-status`, `.unos-konacna.sivo`, `.unos-pruga` (prugasta pozadina), `.dugme-opasno`, `.status-crn`, `.status-vk`, `.dugme-tekst`. Ikone `sprava-{SKR}` postoje u `src/ikone` (`sprave.ikona` iz semena).

---

## 6. JS (`public/assets/js/unos.js`) po ponašanju
Lokalno: `polja = ['d', 'e1'..'eN', 'odbitak']`; `izUnosa`/`prikaz`/`konacnaE` kao račun, sa dve razlike: JS `prikaz(null)` vraća "–" (PHP vraća "") i JS zamenjuje samo prvi zarez (PHP i `broj.mjs` sve; `izUnosa` prihvata i "8," i "8." kao 8000). Port uvozi `electron/racun/*.mjs` i "–" dodaje u pozivaocu.
Napomene o ponašanju koje port svesno menja (odeljak 10): `keydown` nema zaštitu za `readOnly` polja (zaključan red se mišem može fokusirati, Enter na njegovom odbitku zove `potvrdi` i server vraća "Za ispravku unete ocene obavezan je razlog."); `trenutni` ostaje postavljen i kad fokus ode van tabele (F8/F9/Esc rade nad poslednjim redom; klik na `.ispravi`/`.vrati` takođe postavlja red kao trenutni); dugme "Pokušaj ponovo" nestaje kad red ponovo dobije fokus (`prikaziDugmeOdustao` ga prepiše), a `greska-cuvanja` ostaje do sledećeg uspešnog nacrta; `reload` posle odustajanja/vraćanja/ispravke ponovo bira spravu i rotaciju "gde se stalo" kad ih nema u URL-u (prikaz može da skoči na drugu spravu).
- **`preracunaj(red)`**: `d = izUnosa(d)`; `e[]` samo validne; `sve` = sve E validne; `odb = izUnosa(odbitak)`, prazan odbitak → 0; `E = sve ? konacnaE(e) : null`; `.unos-e` = prikaz(E) ili "–"; `.unos-konacna` = `d !== null && E !== null && odb !== null ? prikaz(max(0, d + E − odb))` (skida `sivo`) inače "–" (+ `sivo`).
- **`proveriPolje(el)`**: trim; prazno → skida `greska`, true; `izUnosa` null → `greska`, false; inače skida `greska`, `el.value = prikaz(v)` (normalizuje "8,3" u "8,300"), true.
- **`podaciReda(red)`** → `{prijava_id, sprava_id, d: trim, e: [trim po sudiji], odbitak: trim}`.
- **`primeni(red, prikaz)`**: upiše `d`, `e_sudije[i]`, `odbitak` u polja, `.unos-e` = `prikaz.e || '–'`, konačna + `sivo`, `postaviStatus(red, prikaz.status)`.
- **`postaviStatus(red, status)`**: `data-status`; skida `ispravlja`, `greska-cuvanja`; `zakljucan = uneto|ispravljeno` → polja `readOnly`, `tabIndex −1`, klasa `zakljucano`; klasa `ceka` za `nacrt`; status čip + dugme `ispravi` (kao pogled, s tim što JS crta olovku 13 px, a pogled 16 px; port koristi 16 px svuda); `osveziNapredak()`.
- **`osveziNapredak()`**: redovi bez `ne_radi`: `obradjeno` = status !== nacrt, `odustalo` = odustao; upisuje brojeve, širinu trake i tekst " · n odustala|odustao".
- **Trenutni red**: `focusin` na redu → `oznaciTrenutni`: prethodni gubi `trenutni` i dugme Odustao (vraća tekst statusa), novi dobija `trenutni` i, ako je `nacrt` ili `ispravlja`, u `.unos-status` dugme `button.dugme.dugme-malo.dugme-opasno.odustao-dugme[tabindex=-1]` "Odustala|Odustao" + `<kbd>F8</kbd>` (zamenjuje čip). `postaviStatusTekst`: `nacrt` → "Čeka" ili, uz `ispravlja`, `status-warn` "Ispravka".
- **Nacrt**: `focusout` iz polja `.ocena` koje nije readonly: `proveriPolje`; ako prolazi → `preracunaj` + `sacuvajNacrt(red)` (debounce 300 ms po prijavi; samo kad `data-status === 'nacrt'`; `ocena-nacrt`; uspeh skida `greska-cuvanja`; greška → `oznaciGresku`: klasa `greska-cuvanja`, toast `greska` "Nije sačuvano: {poruka}", `.unos-status` = dugme `button.dugme.dugme-malo.dugme-opasno.ponovo` "Pokušaj ponovo" (klik: skida klasu, vraća tekst statusa, ponovo `sacuvajNacrt`)).
- **`input`** na polju: skida `greska`, `preracunaj`.
- **Tastatura u polju** (`keydown` na `.ocena`): `Enter` ili `Tab` (bez Shift): ako `proveriPolje` pada → `preventDefault`, fokus+select ostaje; inače `preracunaj`; ako je polje `odbitak`: `preventDefault`; `Enter` → `potvrdi(red)`; `Tab` → fokus na D sledećeg otvorenog reda (`sledeciOtvoren`), a kad ga nema fokus ostaje na odbitku; inače `preventDefault` + fokus na sledeće polje u redu. `Shift+Tab` (i > 0): fokus na prethodno polje. `ArrowDown`/`ArrowUp`: `preventDefault`; traži sledeći/prethodni red čije isto polje postoji i nije readonly, fokus na njega. (`Shift+Tab` na D ide prirodno; `ArrowUp` na prvom redu ništa.)
- **`fokus(red, ime)`**: `focus()` + `select()` + `scrollIntoView({block: 'nearest'})`.
- **`sledeciOtvoren(red)`**: sledeći red sa `status nacrt` posle ovog, pa od početka (kružno), inače null.
- **`potvrdi(red)`**: `proveriPolje` za sva polja; ako neko pada → toast `greska` "Ispravite crveno označena polja." i kraj; `podaci = podaciReda`; ako red ima `ispravlja`: `window.prompt('Razlog ispravke (obavezno):', '')` (null → odustani; prazno → toast "Razlog je obavezan." `greska`); `podaci.razlog`; briše debounce nacrta; `ocena-potvrdi` → uspeh: `primeni(red, r.prikaz)`; ako je bio razlog → posle 300 ms `reload` (da se osveži kartica Izmene); inače fokus na D sledećeg otvorenog, a ako ga nema toast "Svi redovi u ovoj grupi su obrađeni." (`ok`); greška → toast `greska` + fokus na D ovog reda.
- **Klik** u redu: `.ispravi` → `otkljucaj(red)`; `.vrati` → `ocena-vrati {prijava_id, sprava_id}` → `reload` (greška → toast); `.odustao-dugme` → `odustao(red)`; `.ponovo` → vidi nacrt.
- **`otkljucaj(red)`** (samo `uneto`|`ispravljeno`): klasa `ispravlja`, polja otključana (readOnly false, tabIndex 0, bez `zakljucano`), `.unos-status` = `status-warn` "Ispravka", fokus na D. `data-status` ostaje `uneto`/`ispravljeno` (pa nacrt NE šalje, jer `sacuvajNacrt` traži `nacrt`; server bi ga ionako ignorisao).
- **`odustao(red)`** (ne za `odustao`/`ne_radi`): `App.potvrdi('{Prezime Ime} je odustala|odustao na ovoj spravi?')`; `ocena-odustao` → `sessionStorage['unos-fokus'] = sledeći otvoreni red (prijava) ili ''` + `reload`; greška → toast.
- **Globalno** (`keydown` na dokumentu): `F8` → `preventDefault`; ako ima `trenutni` → `odustao(trenutni)`; `F9` → `otkljucaj(trenutni)`; `Escape` dok je `trenutni` u `ispravlja` → `reload` (odustajanje od ispravke).
- **Početni fokus**: `sessionStorage['unos-fokus']` (briše se) → taj red ako je `nacrt`; inače prvi red `data-status=nacrt`; u njemu prvo prazno polje (po `polja`) ili D; `fokus`. Svi `nacrt` redovi dobijaju `preracunaj` pri učitavanju.
- Nema toasta "Sačuvano." za nacrt ni za potvrdu (status čip je potvrda).

---

## 7. Prečice i globalno
F2 (Unos ocena) i F4 (Rang liste) su globalne prečice: PHP `app.js` ih okida uvek, a Electron `src/precice.js` (faza 0) ih preskače kad je fokus u polju. Na ovom ekranu je fokus skoro uvek u `input.ocena`, pa F2/F4 u Electron-u ne bi radili: odluka za port je da F2 i F4 rade i iz polja (kao PHP; funkcijski tasteri ne smetaju unosu), uz izmenu `src/precice.js` i njegovog testa. F2 sa ovog ekrana ponovo bira "gde se stalo" (PHP reload `index.php?r=unos`; u portu hash `#/unos` bez parametara). F8/F9/Escape su lokalni za ovaj ekran (dokument). Esc globalno šalje `app:otkazi` (faza 0): na ovom ekranu se koristi samo za prekid ispravke.

---

## 8. PHP testovi koje treba portovati

### 8.1 `test_ocene_unos_ispravka_odustajanje` (TokTest, nad `tok_seme` + `dodajVise` 4 takmičarke; `gr` = Greda; `pid` po imenu)
- Nacrt: `sacuvaj(takm, pid0, gr, {d: '4,8', e: ['8,3', '8.1', '', ''], odbitak: ''}, false)` → `prikaz.status 'nacrt'`, `prikaz.d '4,800'`, `e_sudije ['8,300', '8,100', '', '']`, `konacna ''`.
- Potvrda bez svih E baca ("potvrda trazi sve E ocene"); `d: '25'` baca sa porukom koja sadrži "neispravna vrednost".
- Potvrda `{d: '4,8', e: ['8,3','8,1','8,4','8,2'], odbitak: ''}, true` → `status 'uneto'`, `e '8,250'`, `odbitak '0,000'`, `konacna '13,050'`; u bazi `konacna` = 13050 (PHP "13.050").
- Nacrt preko unete `{d: '1', e: ['1','1','1','1']}, false` → `konacna` ostaje '13,050'.
- Ispravka bez razloga baca; sa razlogom 'pogrešno pročitan listić' i `{d '4,8', e ['8,3','7,9','8,4','8,2'], odbitak '0,1'}` → `status 'ispravljeno'`, `broj_ispravki 1`, `konacna '12,950'`; `izmeneNaSpravi(takm, gr)` ima 1 red sa tim razlogom, `opis` sadrži "E2 8,100 → 7,900" i "konačna 13,050 → 12,950".
- `odustao(takm, pid1, gr)` → `'odustao'`; `vrati` → `'nacrt'`.
- `postaviSpravu(takm, pid2, gr, false)` pa `sacuvaj(... pid2, gr ..., true)` baca ("ocena na spravi koju ne radi").
- Ostatak testa (broj E sudija zaključan, grbovi) je već portovan u fazi 3.

### 8.2 RacunTest (već portovano u fazi 1: `tests/racun-*.test.mjs`): `test_broj_parsiranje_i_prikaz`, `test_e_ocena_primeri_iz_specifikacije`.

### 8.3 Što testovi NE pokrivaju (dodati u portu)
`napredak` (rotacija u toku, obradjeno/ukupno, gotovo, neraspoređeni se ne broje, član koji ne radi spravu se ne broji); kontrolerov izbor sprave "gde se stalo" i podrazumevani pol; `bezGrupa` lista svih prijavljenih; `zaSpravu` sa praznom listom; `odustao` nad unetom (zapis "Označeno odustajanje" u opisu "označeno odustajanje"); `opisIzmene` sa D i odbitkom; `vrati` bez ocene ("Nema šta da se vrati."); prijava drugog takmičenja; `izmeneNaSpravi` limit 5 i redosled; `sacuvaj` nad `odustao` nacrtom (status ostaje `odustao`); E = 0 sudija nemoguće (1..6).

---

## 9. Korisnici ocena u drugim fazama
- Rang liste (faza 6): `zaTakmicenje`, `odbaceniIndeksi` za precrtavanje.
- Pregled takmičenja i Početna (faza 7): `napredak` (rotacija u toku, obrađeno/ukupno), pločica "Unos ocena" nastavlja gde se stalo (to radi sam kontroler kad nema `sprava`/`rot` u URL-u).
- Prijave (faza 3): blokade brisanja i gašenja sprave zbog unetih ocena već postoje.

---

## 10. Napomene za port (odluke)
1. **`window.prompt` za razlog ispravke** ne postoji u Electron-u: mali `<dialog>` "Razlog ispravke" sa jednim poljem (obavezno), "Potvrdi" (Enter) / "Otkaži" (Esc); isti tok kao PHP (prazno → "Razlog je obavezan.").
2. **`reload`** posle ispravke, odustajanja i vraćanja postaje ponovno učitavanje podataka ekrana (`gim.unos.podaci(pol, spravaId, rot)`), uz zadržavanje fokusa na traženom redu (`unos-fokus` logika u React stanju).
3. **Ekran drži lokalno stanje redova** (polja kao tekst, `status`, `ispravlja`, `greska-cuvanja`) i računa E/konačnu odmah čistim funkcijama iz `electron/racun/`; nacrt ide IPC-om sa debounce 300 ms po redu; potvrda vraća `prikaz` koji se primenjuje na red.
4. **URL**: `#/unos?pol=Z&sprava=3&rot=2`; bez parametara IPC bira pol/spravu/rotaciju "gde se stalo" i vraća izabrane vrednosti; renderer ih upisuje u hash (`replace`) da linkovi u traci budu tačni.
5. **Vreme izmene** se prikazuje u lokalnom vremenu računara (PHP: `Europe/Belgrade`); `vreme` u bazi ostaje UTC kao i ostali datumi.
6. **Napredak** u traci se posle svake radnje računa lokalno iz redova (kao PHP JS), a pri učitavanju dolazi iz kontrolera; `napredak` modela (po rotacijama) služi samo za izbor rotacije i za fazu 7.
7. Kolone sa `60px` po sudiji: za 6 sudija fiksno 36+44+64+360+66+60+104+118 = 852 px plus 13 razmaka × 6 px i padding 20 px ≈ 950 px; kartica na 1366 px ima oko 1096 px, pa za ime ostaje oko 146 px (odseca se); za 4 sudije fiksno ≈ 818 px, ime oko 278 px. Staje bez vodoravnog skrola (izračunato, proveriti u QA sa 6 sudija).
8. `Ne radi ovu spravu` red nema polja ni dugmad; `ArrowUp/Down` ga preskaču jer nema polja.
9. `ocena-nacrt` se šalje i za polja koja su prazna (čuva brisanje vrednosti); potvrda nad `ispravlja` redom šalje `razlog`.
10. Ikona sprave u naslovu: `sprave.ikona` iz baze (seme: `sprava-{SKR}`); nepoznata ili prazna → bez ikone.
11. **Zaključan red** (uneto/ispravljeno bez `ispravlja`): port ignoriše Enter/Tab obradu u `readOnly` poljima (prirodni Tab ide dalje, Enter ne zove potvrdu); PHP bi poslao potvrdu i dobio "Za ispravku unete ocene obavezan je razlog." (mana).
12. **`trenutni`** ostaje poslednji fokusirani red i kad fokus ode van tabele (kao PHP), da F8/F9 rade posle klika na dugme; dugme "Pokušaj ponovo" ostaje vidljivo dok nacrt ne uspe (port ne prepisuje status pri ponovnom fokusu, popravka PHP mane).
13. **`confirm`** za odustajanje je `window.confirm` (sinhroni, radi u Electron-u kao u fazama 3 i 4).
14. Redosled i `rb` redova dolaze iz `grupaNaSpravi` (faza 4): ručni redosled rotacije, inače pomeren za R−1 uz pomeranje, inače osnovni.
15. **F2/F4 iz polja**: `src/precice.js` propušta F2 i F4 i kad je fokus u polju (odeljak 7).
