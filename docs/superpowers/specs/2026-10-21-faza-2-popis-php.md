# Faza 2: popis PHP verzije za ekrane Klubovi, Takmičari, Podešavanja

Izvor: `C:\Users\bojan\Desktop\Takmicarski program` (PHP 8 + MySQL, verzija 1.2.0). Popis je samo čitanje, ništa u PHP projektu nije menjano.
Svi stringovi u navodnicima su doslovni (srpski, latinica sa dijakriticima). Putanje su relativne u odnosu na koren PHP projekta.

Notacija: `post()` = vrednost iz POST-a sa `trim()`; `e()` = HTML escape; vreme u bazi je UTC (`gmdate('Y-m-d H:i:s')`), aplikacija radi u zoni `Europe/Belgrade`.

---

## 0. Zajedničko za sva tri ekrana

### 0.1 Okvir (`app/Pogledi/okvir.php`)
- Bočni meni (220 px), gornja traka (56 px) sa `<h1>` = `naslov` ekrana ("Klubovi", "Takmičari", "Podešavanja"); desno u traci aktivno takmičenje ("Aktivno takmičenje" + naziv + datum) ili "Nema aktivnog takmičenja" + dugme "Izaberi".
- Grupa menija "Baza": Klubovi (`meni-klubovi`), Takmičari (`meni-takmicari`), Podešavanja (`meni-podesavanja`). Ostalo: Početna na vrhu; grupa "Takmičenje" (Takmičenja, Pregled, Prijave, Rotacije, Unos ocena F2, Rang liste F4); grupa "Sistem" (Rezervna kopija). Dno menija: "Verzija" + broj.
- Flash poruke: `poruka($vrsta, $tekst)` u sesiji; prikazuju se na vrhu `<main>` u `div.poruke` kao `div.poruka.poruka-<vrsta>` (ovi ekrani koriste `ok` i `greska`). Čitaju se jednom.
- `<title>`: `"<naslov> · Gimnastika"`.
- Klubovi i Takmičari dobijaju `sadrzajKlasa = 'sadrzaj-fiksno'` (`overflow:hidden` na `<main>`, cela strana ne skroluje, tabela skroluje u `.kartica-skrol`). Podešavanja nemaju tu klasu (cela strana skroluje).
- Jedan JS fajl po ekranu (`dodatniJs`) posle `app.js`.

### 0.2 Zajednički helperi (`app/Jezgro/pomocne.php`)
- `datum_parsiraj(string $unos): string|null|false`: prazno -> `null`; `gggg-mm-dd` (proverava `checkdate`); `ddmmgggg` (tačno 8 cifara) ili `d.m.gggg` / `dd.mm.gggg` / `dd.mm.gggg.` (jedna ili dve cifre dan i mesec); neispravan datum ili format -> `false`. Rezultat uvek `gggg-mm-dd`.
- `datum_prikaz(?string $ymd, bool $tacka = true)`: `2026-10-17` -> `17.10.2026.` (sa završnom tačkom); prazno, `null` ili `0000...` -> `''`.
- `pol_slovo('Z')` -> `Ž`, `'M'` -> `M`. Pol se u bazi čuva kao `M` ili `Z` (bez dijakritika), u UI se prikazuje `Ž`.
- `post_int()`: prazno -> `null`, inače `(int)`. `get_int()` isto.
- `ikona($ime, $velicina)`: inline SVG iz `public/assets/ikone/<ime>.svg` (isti fajlovi kao `dizajn/ikone/`), nasleđuje boju teksta.
- CSRF: forme nose skriveno polje `_csrf`, API zaglavlje `X-CSRF` (u Electron aplikaciji nepotrebno).

### 0.3 Zajednički JS (`public/assets/js/app.js`)
- `App.api(akcija, podaci)`: `POST index.php?r=api/<akcija>`, JSON telo, vraća Promise sa odgovorom; ako `!r.ok` ili `ok === false` baca `Error(j.greska || 'Greška ' + status)`; ako odgovor nije JSON baca `Error('Server nije vratio ispravan odgovor (' + status + ').')`.
- `App.obavesti(tekst, vrsta)`: toast gore desno (`position:fixed; right:24px; top:68px; max-width:420px`), klasa `poruka poruka-<vrsta>`, vrsta podrazumevano `ok`; nestaje posle 2500 ms, a za `greska` posle 6000 ms.
- `App.potvrdi(tekst)` = `window.confirm(tekst)`.
- `App.uPolju(el)`: `true` za INPUT, SELECT, TEXTAREA, contenteditable.
- `App.tabelaNavigacija(tabela, {naOtvori(tr), naIzbor(tr)})` vraća `{izaberi(tr), redovi()}`:
  - `redovi()` = svi `tbody tr[data-id]` (uključuje i redove sakrivene filterom).
  - `izaberi(tr)`: skida klasu `izabran` sa svih, stavlja je na `tr`, `scrollIntoView({block:'nearest'})`, zove `naIzbor(tr)`. `izaberi(null)` samo skida izbor.
  - Klik na tabelu: red `tr[data-id]`, ignoriše klik na `button, a, input, select`; zove `izaberi(tr)` pa `naOtvori(tr)`.
  - `keydown` na tabeli (ignoriše se ako je fokus u polju): `ArrowDown` sledeći red (ograničeno na poslednji), `ArrowUp` prethodni (ograničeno na prvi); tekući = red sa klasom `izabran` (ako nijedan, indeks je -1); `Enter` kad postoji izabran red -> `naOtvori(izabran)`. Strelice zovu `preventDefault`.
  - Poznata mana: strelice ne preskaču redove sakrivene pretragom/filterom.
- Globalne prečice (`keydown` na `document`): `F2` -> `index.php?r=unos`; `F4` -> `index.php?r=rang`; `Alt+N` (n ili N) -> `preventDefault` + događaj `app:novi`; `Escape` -> događaj `app:otkazi` (bez preventDefault).
- `data-potvrda` na formama/linkovima/dugmadima pita `confirm`. Ekrani Klubovi/Takmičari/Podešavanja NE koriste `data-potvrda`, već pozivaju `App.potvrdi` iz svog JS-a.
- Datumska polja (`input.datum`): na `blur` (capture) tekst `ddmmgggg` ili `d.m.gggg[.]` postaje `dd.mm.gggg.` (dopuna nulom, završna tačka). Ne proverava kalendarsku ispravnost.
- Autofokus: prvi element sa atributom `data-fokus` dobija fokus pri učitavanju.
- Prečica se u dugmetu prikazuje kao `<kbd>` (11 px, ivica, radijus 6 px; na crvenom dugmetu providan sa belom ivicom).

---

## 1. Šema baze (`migracije/001_pocetna.sql`), tabele koje ovi ekrani koriste

MySQL, InnoDB, utf8mb4. Kolone imena/naziva imaju `utf8mb4_croatian_ci` (sortiranje č, ć, dž, đ, lj, nj, š, ž kao zasebna slova azbuke, poređenje bez razlike velikih i malih slova). Ostalo `utf8mb4_unicode_ci` (case-insensitive, accent-insensitive). Strogi SQL režim: predugačka vrednost je greška (nema tihog odsecanja).

### klubovi
| kolona | tip | napomena |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| puno_ime | VARCHAR(150) croatian_ci NOT NULL | |
| skracenica | VARCHAR(4) croatian_ci NOT NULL | UNIQUE `uq_klubovi_skracenica` |
| grad | VARCHAR(100) croatian_ci NOT NULL DEFAULT '' | |
| kreirano | DATETIME NOT NULL | UTC |
| izmenjeno | DATETIME NOT NULL | UTC |

### takmicari
| kolona | tip | napomena |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| id_broj | VARCHAR(20) NOT NULL | UNIQUE `uq_takmicari_id_broj` (case-insensitive) |
| ime | VARCHAR(80) croatian_ci NOT NULL | |
| prezime | VARCHAR(80) croatian_ci NOT NULL | indeks `ix_takmicari_ime (prezime, ime)` |
| godina_rodjenja | SMALLINT NOT NULL | |
| pol | CHAR(1) NOT NULL | `M` ili `Z` |
| klub_id | INT NULL | FK -> klubovi(id) ON DELETE RESTRICT ON UPDATE CASCADE, indeks `ix_takmicari_klub` |
| drzavljanstvo | VARCHAR(60) croatian_ci NOT NULL DEFAULT 'Srbija' | |
| lekarski_do | DATE NULL | |
| broj_licence | VARCHAR(50) NOT NULL DEFAULT '' | |
| trener | VARCHAR(100) croatian_ci NOT NULL DEFAULT '' | |
| kontakt_roditelja | VARCHAR(150) NOT NULL DEFAULT '' | |
| kreirano, izmenjeno | DATETIME NOT NULL | UTC |

### kategorije i programi (iste kolone)
`id` INT AI PK, `naziv` VARCHAR(100) croatian_ci NOT NULL, `redosled` INT NOT NULL DEFAULT 0, `kreirano`, `izmenjeno` DATETIME NOT NULL. Nema UNIQUE na nazivu.

### sprave
`id` INT AI PK, `pol` CHAR(1) NOT NULL, `naziv` VARCHAR(100) croatian_ci NOT NULL, `skracenica` VARCHAR(4) NOT NULL, `ikona` VARCHAR(40) NOT NULL DEFAULT '', `redosled` INT NOT NULL DEFAULT 0, `kreirano`, `izmenjeno`. Indeks `ix_sprave_pol (pol, redosled)`. Nema UNIQUE u bazi; jedinstvenost skraćenice po polu proverava PHP.

### podesavanja
`kljuc` VARCHAR(60) PK, `vrednost` TEXT NULL. Upis je upsert (`INSERT ... ON DUPLICATE KEY UPDATE`).

### Povezane tabele koje blokiraju brisanje
- `prijave`: `takmicar_id` FK RESTRICT, `klub_id` FK RESTRICT (NULL), `kategorija_id` FK RESTRICT (NULL), `program_id` FK RESTRICT (NULL).
- `prijava_sprave.sprava_id` FK RESTRICT, `ocene.sprava_id` FK RESTRICT.
- `potvrde_klubova` (migracija 003): `klub_id` FK ON DELETE CASCADE (briše se zajedno sa klubom).
- Migracije 002 (takmicenja.domacin, grb_levo, grb_desno) i 004 (grupa_redosled) ne dotiču ova tri ekrana.

### Početni podaci (instalacija, `app/Kontroleri/instalacija.php`, samo ako je tabela prazna)
Sprave (`pol, naziv, skracenica, redosled`; ikona = `'sprava-' . skracenica`):
- M: Parter PA 1, Konj sa hvataljkama KH 2, Karike KA 3, Preskok PR 4, Razboj RA 5, Vratilo VR 6.
- Z: Preskok PR 1, Dvovisinski razboj DR 2, Greda GR 3, Parter PA 4.
Podešavanja: ako je tabela `podesavanja` prazna, upisuje se samo `lekarski_prag_dana = '30'`.
Kategorije, programi, klubovi, takmičari: početno prazni.
---

## 2. KLUBOVI

### 2.1 Podaci
- Lista: `SELECT k.*, (SELECT COUNT(*) FROM takmicari t WHERE t.klub_id = k.id) AS broj_takmicara FROM klubovi k ORDER BY k.puno_ime` (croatian_ci). Nema PHP sortiranja.
- Izvedeno polje: `broj_takmicara` (u JS-u samo za blokadu brisanja, `data-broj`).
- Pretraga je samo na klijentu (vidi 2.5).

### 2.2 Model `App\Modeli\Klubovi` (`app/Modeli/Klubovi.php`)
Konstruktor `__construct(Baza $baza)`.
- `svi(): array`: vidi 2.1.
- `nadji(int $id): ?array`: `SELECT * FROM klubovi WHERE id = ?`.
- `static izPosta(): array`: `['puno_ime' => post('puno_ime'), 'skracenica' => mb_strtoupper(post('skracenica')), 'grad' => post('grad')]`.
- `proveri(array $p, ?int $id): string[]`, redom:
  1. `puno_ime === ''` -> `Puno ime kluba je obavezno.`
  2. skraćenica ne odgovara `/^\p{L}{2,4}$/u` (samo slova bilo kog pisma, 2 do 4) -> `Skraćenica mora imati 2 do 4 slova.`
  3. inače, ako postoji drugi klub sa istom skraćenicom (`SELECT id FROM klubovi WHERE skracenica = ? AND id <> ?`, `id ?? 0`) -> `Skraćenica "XYZ" je već zauzeta.` (ravni navodnici `"`, skraćenica velikim slovima kako je uneta). Poređenje u bazi je case-insensitive po croatian_ci (c, č, ć su različita slova).
  Nema provere dužine `puno_ime` (150) i `grad` (100): predugačak unos baca DB grešku.
- `sacuvaj(array $p, ?int $id): int`: dodaje `izmenjeno = now`; novi: dodaje `kreirano = now`, INSERT, vraća novi id; izmena: UPDATE `WHERE id = ?`, vraća `$id` (ne proverava da red postoji).
- `obrisi(int $id): void`, `RuntimeException` redom:
  1. broj takmičara kluba > 0 -> `Klub ima {n} takmičara u bazi i ne može se obrisati. Prvo premestite ili obrišite takmičare.`
  2. broj prijava (`prijave.klub_id`) > 0 -> `Klub ima {n} prijava na takmičenjima i ne može se obrisati.`
  3. inače `DELETE FROM klubovi WHERE id = ?`.
  (`{n}` je ceo broj, bez množinskih oblika.)

Testovi: nema testova za `Klubovi::proveri/obrisi`. Klubovi se samo ubacuju kao seme u `testovi/BazaTest.php` (skraćenica `ČĆŽ`, test kopije/vraćanja) i `testovi/TokTest.php` (`JED`, `DVA`).

### 2.3 Kontroler `app/Kontroleri/klubovi.php`
Ruta `index.php?r=klubovi[/akcija]`. `$prikazi($id, $forma, $greske)` renderuje pogled `klubovi` sa: `naslov='Klubovi'`, `sadrzajKlasa='sadrzaj-fiksno'`, `klubovi=svi()`, `id`, `forma`, `greske`, `dodatniJs='assets/js/klubovi.js'`.
- `index` (GET): `id = get_int('id')`; ako klub postoji, forma se popuni njime i red je izabran; inače prazna forma `['puno_ime'=>'','skracenica'=>'','grad'=>'']`, `id=null`.
- `sacuvaj` (POST; GET -> redirect `klubovi`): `id = post_int('id')`, `p = izPosta()`, `greske = proveri(p, id)`. Sa greškama: isti ekran (HTTP 200) sa unetim vrednostima i listom grešaka, bez redirecta. Bez grešaka: `sacuvaj`, flash `ok`: `Klub „{puno_ime}“ je sačuvan.` (tipografski navodnici „ i “), redirect na `klubovi&id=<id>` (red ostaje izabran, forma u režimu izmene).
- `obrisi` (POST; GET -> redirect): `obrisi((int) post('id'))`; uspeh flash `ok` `Klub je obrisan.`; `RuntimeException` -> flash `greska` sa porukom izuzetka. Uvek redirect na `klubovi`.
- Druga akcija: HTTP 404, pogled `greska` sa `Nepoznata akcija.`.

### 2.4 Pogled `app/Pogledi/klubovi.php`
Dve kartice u redu (`.red.red-rastegni.raste`).

**Leva kartica** (`.kartica.raste`, `overflow:hidden`):
- Zaglavlje: `h2` "Klubovi u bazi"; dugme `#novi` (`dugme-glavno`) sa ikonom `plus`, tekst "Novi klub", `<kbd>Alt+N</kbd>`.
- Traka pretrage (padding 8px 16px, razmak 12): `#pretraga` u `label.pretraga` širine 340 px sa ikonom `pretraga`, placeholder `Pretraga po imenu, skraćenici ili gradu`, aria-label "Pretraga", `autocomplete="off"`; pored `span#brojac` (sivo, 13 px) tekst `{n} klubova` (npr. "12 klubova", bez deklinacije).
- Tabela `#tabela.tabela` u `.kartica-skrol`. Kolone redom: "Puno ime" (fleksibilna), "Skraćenica" (130 px), "Grad" (170 px), prazna (64 px, dugme za izmenu).
- Red: `tr.klik` (+ `izabran` ako je to `id`), atributi `data-id`, `data-puno`, `data-skr`, `data-grad`, `data-broj`, `tabindex="-1"`. Ćelije: puno ime; skraćenica u `span.skr`; grad; desno dugme `.dugme.dugme-ikona.izmeni` (ikona `olovka` 16, aria-label "Izmeni klub").
- Prazno stanje (nema nijednog kluba): red `td colspan=4.prazno`: `Još nema klubova. Dodajte prvi klub u formi desno.` Kad pretraga sakrije sve redove nema posebne poruke.

**Desna kartica** (fiksno 400 px, `flex-shrink:0`):
- Zaglavlje `h2#naslov-forme`: `Izmena kluba` kad je `id` postavljen, inače `Novi klub`.
- Forma `POST klubovi/sacuvaj` (`#forma`, padding 16, razmak 12): skriveno `_csrf`; skriveno `id` (`#f-id`, id ili prazno); ako ima grešaka `div.poruka.poruka-greska` sa po jednim `<div>` po grešci. Polja redom:
  1. "Puno ime": `input.unos[name=puno_ime][id=f-puno]`, `required`, `data-fokus` samo kad nema grešaka i nije izmena.
  2. Red od dva polja: "Skraćenica" (`name=skracenica`, `#f-skr`, klase `unos broj`, `maxlength=4`, `required`, `text-transform:uppercase`, fiksno 110 px) i "Grad" (`name=grad`, `#f-grad`, ostatak širine, nije obavezno).
  3. Pomoćni tekst (sivo, mali): `Skraćenica (2 do 4 slova) se prikazuje u unosu ocena i rang listama.`
  4. Dugmad: `submit.dugme-glavno` "Sačuvaj" + `<kbd>Enter</kbd>`; `button#otkazi.dugme` "Otkaži" + `<kbd>Esc</kbd>`; razmak; `button#obrisi.dugme.dugme-opasno` ikona `kanta` + "Obriši" (klasa `sakriveno` kad nije izmena).
- Skrivena forma `#forma-brisanje` (`POST klubovi/obrisi`, polje `id` = `#brisi-id`).
- Broj takmičara kluba se ne prikazuje u UI.

### 2.5 Tastatura i JS (`public/assets/js/klubovi.js`)
- Klik na red ili strelice: red postaje izabran i forma se popuni iz `data-*` (`popuni(tr)`): `f-id`, `f-puno`, `f-skr`, `f-grad`, naslov "Izmena kluba", dugme Obriši vidljivo, uklanja se `.poruka` iz forme (stare greške). Klik na red (i `Enter` na izabranom redu) dodatno fokusira "Puno ime"; strelice samo pune formu bez promene fokusa.
- Dugme olovka u redu: izabere red, popuni formu, fokus na "Puno ime".
- `novi()` (dugme "Novi klub", `Alt+N`, dugme "Otkaži"): skida izbor sa tabele, prazni formu (naslov "Novi klub", sakriva Obriši), fokus na "Puno ime".
- `Esc`: samo ako je aktivni element polje unutar `#forma` radi isto što i `novi()`. Esc u polju pretrage ne radi ništa.
- "Obriši": uzme izabrani red; ako `data-broj > 0` toast greška (6 s) `Klub ima {n} takmičara u bazi i ne može se obrisati.` bez poziva servera; inače `confirm('Obrisati klub „' + puno_ime + '“?')`, pa popuni `#brisi-id` i pošalje `#forma-brisanje` (pun reload, server ponovo proverava).
- Pretraga uživo (`input`): upit = `toLowerCase` pa `č,ć -> c`, `š -> s`, `ž -> z`, `đ -> d`; tekst reda = isto normalizovano od `puno + ' ' + skr + ' ' + grad`; podudaranje je podstring (`indexOf`), prazan upit prikazuje sve. Redovi koji ne odgovaraju dobijaju `sakriveno`. Brojač `{n} klubova` (broj vidljivih). `ArrowDown` u polju pretrage bira i fokusira prvi vidljivi red.
- Enter u poljima forme šalje formu (običan HTML submit). Čuvanje je uvek pun POST + redirect, ništa se ne čuva odmah.
- Native validacija browsera: `required` na puno ime i skraćenicu, `maxlength=4`.
---

## 3. TAKMIČARI

### 3.1 Podaci
- Lista: `SELECT t.*, k.skracenica AS klub_skr, k.puno_ime AS klub_ime FROM takmicari t LEFT JOIN klubovi k ON k.id = t.klub_id ORDER BY t.prezime, t.ime` (croatian_ci). Nema PHP sortiranja. `nadji($id)` je isti upit sa `WHERE t.id = ?`.
- Izvedena polja: `klub_skr` (kolona Klub; prazno ako nema kluba), `klub_ime`, status lekarskog (računa se u pogledu iz `lekarski_do` i praga, vidi 3.2).
- Skup godišta za filter: jedinstvene `godina_rodjenja` iz cele liste, silazno (`rsort`); ne osvežava se na klijentu.
- `Takmicari::POLJA` = `id_broj, ime, prezime, godina_rodjenja, pol, klub_id, drzavljanstvo, lekarski_do, broj_licence, trener, kontakt_roditelja` (samo ta polja se upisuju).
- Pretraga i filteri su samo na klijentu (vidi 3.6).

### 3.2 Model `App\Modeli\Takmicari` (`app/Modeli/Takmicari.php`)
- `svi(): array`, `nadji(int $id): ?array` (vidi 3.1).
- `static izPosta(): array`: `id_broj`, `ime`, `prezime` (trim); `godina_rodjenja` = `(int) post(...)`; `pol` = post (očekuje `M` ili `Z`); `klub_id` = `post_int` (prazno -> `null`); `drzavljanstvo` = post, ili `Srbija` ako je prazno; `lekarski_do` = `datum_parsiraj(post('lekarski_do'))` (`gggg-mm-dd` | `null` | `false`); `broj_licence`, `trener`, `kontakt_roditelja` (trim).
- `proveri(array $p, ?int $id): string[]`, redom:
  1. `id_broj === ''` -> `ID broj je obavezan.`; inače ako drugi takmičar ima isti `id_broj` (`id <> ?`, `id ?? 0`; case-insensitive) -> `ID broj {id_broj} već postoji.`
  2. `ime === ''` -> `Ime je obavezno.`
  3. `prezime === ''` -> `Prezime je obavezno.`
  4. `godina_rodjenja < 1900` ili `> (int) date('Y')` (tekuća godina servera) -> `Godina rođenja nije ispravna.` (ne-numerički unos postaje 0 pa daje istu grešku)
  5. `pol` nije tačno `'M'` ili `'Z'` -> `Izaberite pol.`
  6. `klub_id !== null` a klub ne postoji -> `Klub ne postoji.`
  7. `lekarski_do === false` -> `Datum lekarskog nije ispravan (dd.mm.gggg).`
  Nema provera dužina (DB strogi režim baca grešku), nema provere formata ID broja (slobodan tekst do 20 znakova).
- `sacuvaj(array $p, ?int $id): int`: filtrira na `POLJA`, `izmenjeno = now`; novi: `kreirano = now`, INSERT, vraća id; izmena: UPDATE, vraća `$id`.
- `sledeciIdBroj(): string`: prolazi kroz sve `id_broj`; računaju se samo vrednosti koje su isključivo cifre (`ctype_digit`); traži najveći broj (pri jednakosti poslednji pronađen određuje dužinu); `duzina` počinje na 5; vraća `str_pad(najveci + 1, duzina, '0', STR_PAD_LEFT)`. Primer iz testa: u bazi `001..004` i `099` daje `'100'`. Prazna baza daje `'00001'`. Preliv dužine ("999") daje "1000". NE koristi se na ekranu Takmičari (polje ID broj je tu prazno za novog); koristi ga dijalog "Novi" na Prijavama (kontroler `prijave.php` prosleđuje `sledeciIdBroj`) i uvoz prijava (`Uvoz` uvećava poslednji dodeljeni).
- `obrisi(int $id): void`: broj prijava (`prijave.takmicar_id`) > 0 -> `RuntimeException` `Takmičar ima {n} prijava na takmičenjima i ne može se obrisati.`; inače `DELETE`.
- `static lekarski(?string $vaziDo, int $pragDana, ?string $naDan = null): array{stanje:string, dana:int|null}`:
  - `vaziDo` je `null`, `''` ili se ne može parsirati -> `['stanje'=>'nema','dana'=>null]`.
  - `dana = (int) floor((strtotime(vaziDo) - strtotime(naDan ?? danas)) / 86400)`.
  - `dana < 0` -> `istekao` (sa negativnim `dana`); `dana <= pragDana` -> `istice` (uključuje `dana = 0`, tj. poslednji dan važenja se prikazuje kao "Ističe za 0 dana"); inače `vazi`.
  - Razlika se računa preko timestamp-ova u zoni Europe/Belgrade pa na prelasku na zimsko/letnje vreme može dati 1 dan manje; u novoj aplikaciji računati razliku kalendarskih dana.
  - `naDan` koriste druge funkcije (datum takmičenja); na ekranu Takmičari je danas.
- `static lekarskiOznaka(array $st): string` (HTML bedž):
  - `istekao` -> `span.status.status-bad` + ikona `upozorenje` 13 + `Istekao`
  - `istice` -> `span.status.status-warn` + ikona `upozorenje` 13 + `Ističe za {dana} dana` (uvek "dana", bez množine)
  - `nema` -> `span.status.status-bad` + ikona `upozorenje` 13 + `Nema lekarskog`
  - `vazi` -> prazno (nema oznake).

Testovi (`testovi/TokTest.php`), jedini koji dodiruju ovaj model:
- `Takmicari::lekarski('2026-01-01', 30, '2026-10-17')['stanje'] === 'istekao'`
- `Takmicari::lekarski('2026-10-25', 30, '2026-10-17')['stanje'] === 'istice'` i `['dana'] === 8`
- `Takmicari::lekarski('2027-10-25', 30, '2026-10-17')['stanje'] === 'vazi'`
- `Takmicari::lekarski(null, 30)['stanje'] === 'nema'`
- `(new Takmicari($b))->sledeciIdBroj() === '100'` (seme: ID brojevi `001`, `002`, `003`, `004` i `099`).
- Takmičari u `tok_seme()` (Ana, Bea, Ceca, Dona: ID `001`..`004`, prezime Test, pol Z, godina 2012; Marko `099`, pol M, 2011) i `BazaTest.php` (ID `00142`, Ana Petrović, Z, 2012) samo se ubacuju kao seme.
- Testovi za `proveri`, `obrisi`, `izPosta` ne postoje.

Prag lekarskog: podešavanje `lekarski_prag_dana` (vidi 4.2); kontroler čita `dajInt('lekarski_prag_dana', 30)`, prosleđuje pogledu kao `prag`, a pogled ga stavlja u `data-prag` forme za JS.

### 3.3 Kontroler `app/Kontroleri/takmicari.php`
`$prazan` = `id_broj ''`, `ime ''`, `prezime ''`, `godina_rodjenja ''`, `pol ''`, `klub_id null`, `drzavljanstvo 'Srbija'`, `lekarski_do null`, `broj_licence ''`, `trener ''`, `kontakt_roditelja ''`.
`$prikazi($id, $forma, $greske)` renderuje pogled `takmicari`: `naslov='Takmičari'`, `sadrzajKlasa='sadrzaj-fiksno'`, `takmicari=svi()`, `klubovi=(new Klubovi)->svi()`, `prag`, `id`, `forma`, `greske`, `dodatniJs='assets/js/takmicari.js'`.
- `index` (GET): `id = get_int('id')`; ako takmičar postoji forma je popunjena njime i red izabran, inače `$prazan`.
- `sacuvaj` (POST; GET -> redirect `takmicari`): kao kod klubova; kad ima grešaka, `lekarski_do` u formi se vraća kao sirov uneti tekst (`post('lekarski_do')`) da korisnik vidi šta je kucao; ekran (200) sa greškama. Uspeh: flash `ok` `Takmičar {prezime} {ime} je sačuvan.` (bez navodnika), redirect `takmicari&id=<id>`.
- `obrisi` (POST): uspeh flash `ok` `Takmičar je obrisan.`; `RuntimeException` -> flash `greska` sa porukom; redirect `takmicari`.
- Ostalo: 404 `Nepoznata akcija.`.
- Drugi pozivaoci modela (van ova tri ekrana): API akcija `prijave-novi-takmicar` (JSON `id_broj, ime, prezime, godina_rodjenja, pol, klub_id, lekarski_do`, `drzavljanstvo='Srbija'`; validira `proveri(..., null)`, greške spaja razmakom u `greska`, HTTP 400; sačuva i odmah prijavi na aktivno takmičenje) i uvoz prijava.

### 3.4 Pogled `app/Pogledi/takmicari.php`
Dve kartice u redu kao kod klubova.

**Leva kartica** (`.kartica.raste`):
- Zaglavlje: "Takmičari u bazi"; dugme `#novi` ikona `plus` + "Novi takmičar" + `<kbd>Alt+N</kbd>`.
- Traka filtera (padding 8px 16px, razmak 8), redom:
  1. Pretraga `#pretraga`, `label.pretraga.raste`, ikona `pretraga`, placeholder `Pretraga: ime, prezime ili ID`, aria-label "Pretraga".
  2. `select#f-klub` širine 138 px, aria-label "Klub": prva opcija `Svi klubovi` (vrednost ''), zatim svi klubovi (redosledom `puno_ime`) sa tekstom = skraćenica i vrednošću = id. Nema opcije "bez kluba".
  3. Grupa `div.izbor#f-pol` aria-label "Pol": tri dugmeta sa `aria-pressed`: "Svi" (`data-pol=""`, početno pritisnuto), "M" (`data-pol="M"`), "Ž" (`data-pol="Z"`).
  4. `select#f-god` širine 128 px, aria-label "Godište": `Sva godišta` + jedinstvene godine silazno.
- Tabela `#tabela.tabela`, kolone redom i širine: "ID" (70 px), "Prezime i ime" (fleksibilna), "God." (66 px), "Pol" (48 px), "Klub" (62 px), "Lekarski važi do" (292 px).
- Red `tr.klik` (+ `izabran`), `tabindex="-1"`, atributi: `data-id`, `data-tekst` (= `mb_strtolower(prezime + ' ' + ime + ' ' + ime + ' ' + prezime + ' ' + id_broj)`), `data-klub` (id ili 0 za bez kluba), `data-pol` (`M`/`Z`), `data-god`, `data-json` (JSON sa `POLJA`, `JSON_UNESCAPED_UNICODE`).
  Ćelije: `span.sifra` id_broj; `Prezime Ime` (prezime pa ime); `span.broj` godina; `pol_slovo` (M/Ž); `span.skr` skraćenica kluba; ćelija lekarskog: `span.broj` sa `datum_prikaz(lekarski_do)` (prazno ako nema) + `lekarskiOznaka` bedž (inline-flex, razmak 8).
- Prazno stanje: red `td colspan=6.prazno`: `Još nema takmičara. Dodajte prvog u kartonu desno.`
- Podnožje kartice (36 px, gornja linija, 13 px muted): levo `span#brojac` `Prikazano {n} od {ukupno} takmičara`; desno `<kbd>↑</kbd><kbd>↓</kbd> izbor reda <kbd>Enter</kbd> otvori karton`.

**Desna kartica** (400 px fiksno, `overflow:auto`):
- Zaglavlje: `h2#naslov-forme` `Karton takmičara` (izmena) ili `Novi takmičar`; desno `span#naslov-id.broj.sek` (13 px, 600) `ID {id_broj}` u izmeni, prazno za novog.
- Forma `POST takmicari/sacuvaj` (`#forma`, `data-prag`), padding 14px 16px 16px, razmak 10. Skrivena polja: `_csrf`, `id` (`#f-id`), `pol` (`#f-pol-vrednost`). Greške u `div.poruka.poruka-greska` kao kod klubova. Polja redom:
  1. Red: "ID broj" (`name=id_broj`, `#f-id_broj`, `unos broj`, 110 px, `required`, `data-fokus` kad nema grešaka i nije izmena) i "Pol" (grupa `div.izbor#izbor-pol`, dva dugmeta "Muški" (`data-pol=M`) i "Ženski" (`data-pol=Z`), `aria-pressed` po `forma.pol`).
  2. Red: "Ime" (`#f-ime`, `required`) i "Prezime" (`#f-prezime`, `required`), oba `raste`.
  3. Red: "Godina rođenja" (`name=godina_rodjenja`, `#f-godina_rodjenja`, `unos broj`, 110 px, `inputmode=numeric`, `pattern=\d{4}`, `required`; prazno ako je vrednost 0 ili prazna) i "Državljanstvo" (`#f-drzavljanstvo`, podrazumevano `Srbija`).
  4. "Klub": `select#f-klub_id[name=klub_id]`, prva opcija `Bez kluba` (vrednost ''), zatim svi klubovi sa tekstom `puno_ime`.
  5. Red: "Lekarski važi do" (`name=lekarski_do`, `#f-lekarski_do`, klase `unos broj datum`, 150 px, placeholder `dd.mm.gggg`; vrednost se prikazuje kao `dd.mm.gggg.` ako je u formi `gggg-mm-dd`, inače sirovo kako je uneto) i desno `div#lekarski-poruka` (početno `sakriveno`; ikona `upozorenje` 16 + `span#lekarski-tekst`; radijus 8, 13 px, 600; pozadina/boja `--bad-soft/--bad` ili `--warn-soft/--warn`).
  6. Separator sa natpisom `Opciono` (stil `meni-grupa`) i linijom.
  7. Red: "Broj licence" (`#f-broj_licence`, `unos broj`, 150 px, placeholder `Nije uneto`) i "Trener" (`#f-trener`).
  8. "Kontakt roditelja" (`#f-kontakt_roditelja`, placeholder `Ime i telefon`).
  9. Dugmad: "Sačuvaj" + `<kbd>Enter</kbd>`, "Otkaži" + `<kbd>Esc</kbd>`, razmak, "Obriši" (opasno, ikona `kanta`, `sakriveno` kad nije izmena).
- Skrivena forma `#forma-brisanje` (`POST takmicari/obrisi`, `#brisi-id`).
- Obavezna polja: ID broj, Ime, Prezime, Godina rođenja (HTML `required`), Pol (JS provera). Klub je opcion ("Bez kluba").

### 3.5 Tastatura i JS (`public/assets/js/takmicari.js`)
- Klik na red / strelice / Enter: isto kao kod klubova. `popuni(tr)` čita `data-json` i puni sva polja (`id_broj, ime, prezime, godina_rodjenja, klub_id, drzavljanstvo, lekarski_do, broj_licence, trener, kontakt_roditelja`); `lekarski_do` iz `gggg-mm-dd` u `dd.mm.gggg.`; `null`/`undefined` -> prazan string; za novog `drzavljanstvo = 'Srbija'`. Pol: `postaviPol(d.pol)` (skriveno polje + `aria-pressed`). Naslov `Karton takmičara`/`Novi takmičar`, `naslov-id` `ID {id_broj}`/prazno, Obriši vidljivo samo za postojećeg, ukloni staru `.poruka` iz forme, pokrene `lekarskiPoruka()`.
  - Klik na red i Enter dodatno fokusiraju `#f-id_broj`; strelice ne menjaju fokus.
- `novi()` (dugme, `Alt+N`, "Otkaži", Esc iz polja forme): bez izbora, prazna forma (državljanstvo Srbija), fokus na ID broj. Novi takmičar NE dobija predlog ID broja na ovom ekranu.
- Izbor pola: klik na "Muški"/"Ženski" postavlja skriveno polje i `aria-pressed`. Pri slanju forme, ako pol nije izabran: `preventDefault`, toast greška `Izaberite pol.`, fokus na prvo dugme pola.
- Poruka o lekarskom (klijent), na `input` i `blur` polja (blur sa `setTimeout 0`) i pri učitavanju/popunjavanju:
  - Parsiranje: `ddmmgggg` ili `d.m.gggg[.]` preko `new Date(g, m-1, d)` (prelivanje meseca/dana, npr. 31.02, JS prihvata a server odbija).
  - Prazno polje: poruka sakrivena, bez klasa.
  - Neprazno a neparsirano: polje dobija klasu `greska`, poruka (bad) `Neispravan datum (dd.mm.gggg)`.
  - `dana < 0` (od lokalne ponoći danas): klasa `greska` + poruka (bad) `Lekarski je istekao`.
  - `0 <= dana <= prag`: klasa `upozorenje` + poruka (warn) `Ističe za {dana} dana`.
  - Inače poruka sakrivena. (Za "nema datuma" u formi nema poruke; u tabeli se vidi bedž "Nema lekarskog".)
  - Klase polja: `.unos.upozorenje` 2 px narandžasta ivica (`--warn-border`), `.unos.greska` 2 px crvena (`--bad`).
- Brisanje: uzima izabrani red, `confirm('Obrisati takmičara ' + prezime + ' ' + ime + ' (ID ' + id_broj + ')?')`, pa slanje `#forma-brisanje`. Server vraća `Takmičar ima {n} prijava...` kao flash ako je prijavljen (nema klijentske provere).
- Pretraga i filteri (isključivo klijentski, ne pamte se, nisu u URL-u). Red je vidljiv ako su ispunjeni svi uslovi:
  - tekst: prazan upit ili `normalizuj(data-tekst).indexOf(normalizuj(upit.trim())) !== -1`; `normalizuj` = lowercase pa `č,ć->c`, `š->s`, `ž->z`, `đ->d`. Pretražuje prezime, ime (u oba redosleda) i ID broj; podstring bilo gde (ne prefiks, ne po rečima).
  - klub: `select#f-klub` prazan ili `data-klub === vrednost`.
  - pol: `polFilter` prazan ili `data-pol === polFilter` (`Svi` / `M` / `Z`).
  - godište: `select#f-god` prazan ili `data-god === vrednost`.
  - Događaji: `input` na pretrazi, `change` na selektima, klik na dugmad pola. Brojač: `Prikazano {n} od {ukupno} takmičara` (ukupno = svi redovi u tabeli).
  - `ArrowDown` u polju pretrage: bira i fokusira prvi vidljivi red.
- Čuvanje: običan POST + redirect (nema trenutnog čuvanja). Enter u tekstualnom polju šalje formu; dugmad pola su `type=button`.
- Datum blur normalizacija iz `app.js` važi za `#f-lekarski_do` (klasa `datum`).
---

## 4. PODEŠAVANJA

Ekran ima dva dela: (A) četiri uredive liste (šifarnici) sa trenutnim čuvanjem preko API-ja, (B) forma "Pravila računanja i ostalo" sa običnim POST-om.

### 4.1 Šifarnici: model `App\Modeli\Sifarnici` (`app/Modeli/Sifarnici.php`)

Konstante:
- `VRSTE` (redosled je i redosled kartica na ekranu; ključevi su "vrsta"):
  | vrsta | tabela | naziv kartice | pol |
  |---|---|---|---|
  | `kategorije` | `kategorije` | `Kategorije` | null |
  | `programi` | `programi` | `Programi` | null |
  | `sprave_m` | `sprave` | `Sprave · muške` (razdvojnik je srednja tačka U+00B7) | `M` |
  | `sprave_z` | `sprave` | `Sprave · ženske` | `Z` |
- `IKONE` = `['sprava-PA','sprava-KH','sprava-KA','sprava-PR','sprava-RA','sprava-VR','sprava-DR','sprava-GR']` (fajlovi `sprava-PA.svg` itd. u `dizajn/ikone/`; jedini dozvoljeni izbori, ili prazno = bez ikone). Oznaka u izboru je ime bez prefiksa `sprava-`: PA, KH, KA, PR, RA, VR, DR, GR (u ovom redosledu).

Metode:
- `static meta(string $vrsta)`: nepoznata vrsta -> `InvalidArgumentException('Nepoznata lista: ' . $vrsta)` (API vraća 400 sa tom porukom).
- `lista(string $vrsta): array`: `SELECT * FROM <tabela> [WHERE pol = ?] ORDER BY redosled, id`.
- `sprave(string $pol): array`: `SELECT * FROM sprave WHERE pol = ? ORDER BY redosled, id` (koriste Prijave, Rotacije, Unos, Rezultati; redosled sprava je redosled kolona višeboja i rotacija).
- `nadji(string $vrsta, int $id): ?array`: `SELECT * FROM <tabela> WHERE id = ?` (ne proverava pol).
- `dodaj(string $vrsta, array $p): int`: poziva `proveri`; novi `redosled` = `COALESCE(MAX(redosled), 0) + 1` (za sprave samo unutar istog pola); upisuje `naziv`, `redosled`, `kreirano`, `izmenjeno`; za sprave još `pol`, `skracenica` = `mb_strtoupper(skracenica)`, `ikona` (ili ''). Vraća id.
- `izmeni(string $vrsta, int $id, array $p): void`: poziva `proveri(..., $id)`; ažurira `naziv`, `izmenjeno`; za sprave `skracenica` (veliko) i `ikona`. Ne menja `redosled` ni `pol`.
- `proveri` (privatna; baca `RuntimeException`), redom:
  1. `trim(naziv) === ''` -> `Naziv je obavezan.`
  2. samo sprave: `skr = mb_strtoupper(trim(skracenica))`; ne odgovara `/^\p{L}{1,4}$/u` -> `Skraćenica sprave mora imati 1 do 4 slova.`
  3. ista skraćenica već postoji kod druge sprave istog pola (`WHERE pol = ? AND skracenica = ? AND id <> ?`) -> `Skraćenica {SKR} već postoji za taj pol.`
  4. `ikona` neprazna i nije u `IKONE` -> `Nepoznata ikona.`
  Naziv nije jedinstven (ni kod kategorija/programa ni kod sprava), nema provere dužine (100).
- `obrisi(string $vrsta, int $id): void`: broji upotrebu:
  - `kategorije`: `COUNT(*) FROM prijave WHERE kategorija_id = ?`
  - `programi`: `COUNT(*) FROM prijave WHERE program_id = ?`
  - `sprave`: `COUNT(*) FROM prijava_sprave WHERE sprava_id = ?` + `COUNT(*) FROM ocene WHERE sprava_id = ?`
  Ako je zbir > 0: `RuntimeException` `Stavka se koristi u {n} prijava ili ocena i ne može se obrisati.` (ista poruka za sve tri vrste). Inače `DELETE`.
- `redosled(string $vrsta, array $ids): void`: u transakciji za svaki id po poziciji `UPDATE <tabela> SET redosled = i + 1 WHERE id = ?`. Ne proverava da id pripada toj vrsti/polu i ne menja `izmenjeno`.

Testovi za `Sifarnici` ne postoje; kategorije/programi/sprave se samo ubacuju kao seme (`tok_seme()`: kategorija "Kadet", program "C", ženske sprave Preskok PR (1) i Greda GR (2), muška Parter PA (1)).

### 4.2 Opšta podešavanja: `App\Jezgro\Podesavanja` (`app/Jezgro/Podesavanja.php`)
Ključ/vrednost u tabeli `podesavanja` (sve vrednosti su stringovi; `NULL` se čita kao '').
- Konstanta `PODRAZUMEVANO` (spaja se sa bazom; ključevi iz baze pregaze):
  | ključ | podrazumevano | napomena |
  |---|---|---|
  | `aktivno_takmicenje` | `''` | id aktivnog takmičenja; postavlja ga ekran Takmičenja, ne ovaj ekran |
  | `kopije_fascikla` | `''` | prazno = `ROOT/kopije`; postavlja ga ekran Rezervna kopija; ako fascikla ne postoji koristi se podrazumevana |
  | `lekarski_prag_dana` | `'30'` | |
  | `e_zaokruzivanje` | `'odseci'` | `odseci` ili `zaokruzi` (otvoreno pitanje 1) |
  | `plasman_isti_rezultat` | `'deli'` | `deli` ili `visa_e_pa_d` (otvoreno pitanje 3) |
  | `viseboj_nepotpun` | `'ulazi'` | `ulazi` ili `ne_ulazi` (otvoreno pitanje 5) |
  | `lekarski_sprecava_prijavu` | `'ne'` | `ne` ili `da` (otvoreno pitanje 6) |
  | `grb_levo` | `''` | relativna putanja `grb/grb_levo.<ext>` ili prazno |
  | `grb_desno` | `''` | isto za `grb_desno` |
  | `organizator` | `''` | slobodan tekst |
- Metode: `sva(): array<string,string>` (keš; default + sve iz baze), `daj(string $kljuc, string $podrazumevano = ''): string`, `dajInt(string $kljuc, int $podrazumevano = 0): int` (prazno -> podrazumevano, inače `(int)`), `postavi(string $kljuc, string $vrednost): void` (upsert + osvežava keš), `aktivnoTakmicenjeId(): ?int`, `fasciklaKopija(): string`.
- Gde se čitaju: `e_zaokruzivanje` (`Ocene`/`Racun\Ocena::konacnaE` pri računanju konačne E: `odseci` = `intdiv(zbir, n)` u hiljaditim delovima, `zaokruzi` = `intdiv(2*zbir + n, 2*n)`; i ekran Unos), `plasman_isti_rezultat` i `viseboj_nepotpun` (`Rezultati`, `Racun\Plasman`; konstante `ISTI_DELI='deli'`, `ISTI_VISA_E_PA_D='visa_e_pa_d'`), `lekarski_sprecava_prijavu` (`Prijave::dodajJednu` i uvoz: ako je `da` i lekarski je `nema` ili `istekao` na dan takmičenja, takmičar se preskače sa porukom `{prezime ime} (lekarski ne važi na dan takmičenja)`), `lekarski_prag_dana` (Takmičari, Prijave, Početna), `organizator` / `grb_levo` / `grb_desno` (bilten i štampa; takmičenje ima svoje vrednosti, ove važe kad su one prazne).

### 4.3 Kontroler `app/Kontroleri/podesavanja.php`
- `index` (GET): `liste[vrsta] = ['meta' => VRSTE[vrsta], 'stavke' => lista(vrsta)]` za sve četiri vrste; pogled `podesavanja` dobija `naslov='Podešavanja'`, `liste`, `ikone=Sifarnici::IKONE`, `vrednosti=$podesavanja->sva()`, `dodatniJs='assets/js/podesavanja.js'`.
- `sacuvaj` (POST multipart; GET -> redirect `podesavanja`), redom:
  1. Za svaki od četiri izbora (`e_zaokruzivanje`, `plasman_isti_rezultat`, `viseboj_nepotpun`, `lekarski_sprecava_prijavu`): ako je poslata vrednost među dozvoljenima (striktno), upiše se; nedozvoljena vrednost se tiho ignoriše (postojeća ostaje).
     Dozvoljeno: `e_zaokruzivanje` {`odseci`,`zaokruzi`}; `plasman_isti_rezultat` {`deli`,`visa_e_pa_d`}; `viseboj_nepotpun` {`ulazi`,`ne_ulazi`}; `lekarski_sprecava_prijavu` {`ne`,`da`}.
  2. `lekarski_prag_dana` = `max(0, min(365, (int) post(...)))` (prazno ili tekst daje 0).
  3. `organizator` = `post('organizator')` (trim; prazno briše).
  4. Za `grb_levo` i `grb_desno`: ako je označena kućica `obrisi_<ključ>` = `1` -> vrednost `''` (fajl na disku se ne briše). Inače, ako je poslat fajl bez greške: ekstenzija (lowercase) mora biti `png`, `jpg`, `jpeg`, `svg` ili `gif`, inače flash `greska` `Grb mora biti PNG, JPG, GIF ili SVG slika.` i prelazi se na sledeći; ispravan fajl se premešta u `public/grb/<ključ>.<ext>` (folder se pravi po potrebi, fajl iste ekstenzije se pregazi) i podešavanje dobija vrednost `grb/<ključ>.<ext>`. Nema ograničenja veličine ni provere sadržaja.
  5. Flash `ok` `Podešavanja su sačuvana.` (prikazuje se i kad je prethodno bila greška sa grbom) i redirect `podesavanja`.
- Ostalo: 404 `Nepoznata akcija.`.

### 4.4 API akcije za šifarnike (`app/Kontroleri/api.php`)
Sve `POST` sa JSON telom; ulazna polja se `trim`-uju (`$str`), `id` se `(int)`; `RuntimeException`/`InvalidArgumentException` -> HTTP 400 `{"ok":false,"greska":"<poruka>"}`; druge greške -> HTTP 500 `{"ok":false,"greska":"<poruka>"}` (loguje se u dnevnik); GET -> 405 `{"ok":false,"greska":"Samo POST."}`; nepoznata akcija -> 404 `Nepoznata akcija: <ime>`.
- `sifarnik-dodaj` telo `{vrsta, naziv, skracenica, ikona}` -> `{ok:true, stavka:<red iz nadji: sve kolone, uključujući id, naziv, skracenica, ikona, redosled>}`.
- `sifarnik-izmeni` telo `{vrsta, id, naziv, skracenica, ikona}` -> `{ok:true}`.
- `sifarnik-obrisi` telo `{vrsta, id}` -> `{ok:true}`.
- `sifarnik-redosled` telo `{vrsta, ids:[int,...]}` -> `{ok:true}` (id-evi se `intval`-uju).
Za kategorije/programe `skracenica` i `ikona` se šalju prazni i ignorišu.

### 4.5 Pogled `app/Pogledi/podesavanja.php`

**Deo A: liste.** Jedan red `div.red#sifarnici` (`data-ikone` = zarez-razdvojen `IKONE`) sa 4 kartice (po jedna po vrsti, atributi `data-vrsta`, `data-sprava` = 1 za sprave) redom: kategorije, programi, sprave muške, sprave ženske. Širine: kategorije `flex:1 1 0; min-width:0` (ostatak), programi 216 px, sprave_m 308 px, sprave_z 308 px (fiksno), svi `overflow:hidden`.
- Zaglavlje: `h2` sa nazivom vrste; desno `span.brojac` (13 px, 600, sivo) sa brojem stavki.
- `ul.lista-stavki`, `li.stavka[draggable=true]` sa `data-id`, `data-naziv`, `data-skr`, `data-ikona`. Sadržaj stavke redom:
  1. `span.hvataljka` (title `Prevuci za redosled`, ikona `hvataljka` 16)
  2. samo sprave: `span.stavka-ikona` (ikona 20 ako je postavljena) i `span.stavka-skr.broj` (skraćenica, 13 px, 700, širina 26 px)
  3. `span.stavka-naziv` (600, jedan red sa elipsom)
  4. dugme `.dugme-ikona.izmeni` (ikona `olovka`, aria-label `Izmeni`, 28x28) i dugme `.dugme-ikona.obrisi` (ikona `kanta`, aria-label `Obriši`, 28x28)
- Prazno stanje liste nema posebnog teksta. Stavka: min visina 40, donja linija.
- Red za dodavanje (`div.dodaj`, padding 10, razmak 8): samo sprave: `input.unos.broj.skr` placeholder `Skr.`, aria-label `Skraćenica`, `maxlength=4`, širina 56 px, uppercase; `input.unos.naziv` aria-label `Naziv`, placeholder `Nova sprava` (sprave), `Novi program` (programi), `Nova kategorija` (kategorije); dugme `.dodaj-dugme` tekst `Dodaj`.

**Deo B: kartica "Pravila računanja i ostalo"** (ispod listi, cela širina). Zaglavlje: naslov `Pravila računanja i ostalo`, desno sivo mali tekst `Otvorena pitanja iz specifikacije: potvrditi sa naručiocem pre takmičenja`. Forma `POST podesavanja/sacuvaj`, `enctype=multipart/form-data`, padding 16.
- Red 1: mreža 4 jednake kolone (razmak 12), 4 selecta (`select.unos`):
  | oznaka (label) | name | opcije (vrednost -> tekst) |
  |---|---|---|
  | `Prosek E ocene na tri decimale` | `e_zaokruzivanje` | `odseci` -> `Odsecanje (8,233)`; `zaokruzi` -> `Zaokruživanje` |
  | `Isti rezultat` | `plasman_isti_rezultat` | `deli` -> `Dele mesto (1, 2, 2, 4)`; `visa_e_pa_d` -> `Viša E, pa viša D` |
  | `Ko ne radi sve sprave` | `viseboj_nepotpun` | `ulazi` -> `Ulazi u višeboj (zbir urađenih)`; `ne_ulazi` -> `Nema plasman u višeboju` |
  | `Lekarski koji ne važi` | `lekarski_sprecava_prijavu` | `ne` -> `Samo upozorenje`; `da` -> `Sprečava prijavu` |
  Izabrana je opcija jednaka sačuvanoj vrednosti (podrazumevane iz tabele u 4.2).
- Red 2: mreža `150px 1fr 1fr 1fr`, poravnanje `end`:
  - `Prag upozorenja za lekarski (dana)`: `input[type=number].unos.broj`, `name=lekarski_prag_dana`, `min=0`, `max=365`.
  - `Organizator (za bilten)`: `input[type=text]`, `name=organizator`, placeholder `npr. Gimnastički savez Vojvodine`.
  - `Grb levo (ako takmičenje nema svoj)` i `Grb desno (ako takmičenje nema svoj)`: ako je grb postavljen prikazuje se `<img>` visine 36 px (max širina 60) i kućica `.kucica.mali` sa tekstom `ukloni` (`name=obrisi_grb_levo|obrisi_grb_desno`, vrednost `1`); uvek i `input[type=file]` (`name=grb_levo|grb_desno`, `accept=".png,.jpg,.jpeg,.svg,.gif"`).
- Dugme `submit.dugme-glavno` tekst `Sačuvaj podešavanja` (bez `kbd`). Nema `data-fokus`, nema JS za deo B; slanje je pun POST + reload.

### 4.6 Tastatura i JS (`public/assets/js/podesavanja.js`)
Liste rade nezavisno (po jedan blok koda za svaku `section[data-vrsta]`).
- **Izmena na licu mesta**: klik na olovku ili dvoklik na stavku (osim na `input,select,button`) -> stavka dobija klasu `uredjuje` (min visina 48, podloga `--sel`), sakrivaju se ikona, skraćenica, naziv i dugmad olovka/kanta, a dodaje se `span.uredi-red` sa poljima: za sprave `input.u-skr` (`maxlength=4`, širina 56, visina 34, uppercase, aria "Skraćenica"), `select.u-ikona` (118 px, aria "Ikona", prva opcija `bez ikone` = '', pa osam ikona sa tekstom PA, KH, KA, PR, RA, VR, DR, GR, trenutna izabrana); za sve vrste `input.u-naziv` (visina 34, aria "Naziv") i dugme `Sačuvaj` (`dugme-glavno dugme-malo`). Fokus i selekcija celog teksta u polju naziv.
  - `Enter` u redu za izmenu: čuva (`sifarnik-izmeni`). `Esc`: otkazuje izmenu bez čuvanja (`stopPropagation`). Dugme "Sačuvaj" isto čuva.
  - Uspeh: ažurira `data-*`, zatvara polja, toast `Sačuvano.`. Greška: toast greška sa porukom servera (npr. `Naziv je obavezan.`, `Skraćenica PA već postoji za taj pol.`), fokus ostaje na nazivu, stavka ostaje u izmeni. Klijent pre slanja radi `trim` i uppercase skraćenice.
- **Brisanje**: klik na kantu -> `confirm('Obrisati „' + naziv + '“?')`; ako potvrdi, `sifarnik-obrisi`; uspeh: stavka se uklanja, brojač se ažurira, toast `Obrisano.`; greška (npr. `Stavka se koristi u 7 prijava ili ocena i ne može se obrisati.`) toast greška (6 s), stavka ostaje.
- **Redosled prevlačenjem** (HTML5 drag and drop samo unutar iste liste): `dragstart` na stavci stavlja klasu `kartica-vuci` (opacity 0.6, senka); `dragover` premešta stavku uživo u DOM-u iznad ili ispod ciljne zavisno od toga da li je kursor u donjoj polovini cilja; na `dragend` šalje se ceo novi redosled `sifarnik-redosled {vrsta, ids}`; uspeh toast `Redosled sačuvan.`, greška toast greška (DOM se ne vraća na staro). Nema tastaturnog pomeranja.
- **Dodavanje**: dugme `Dodaj` ili `Enter` u bilo kom polju reda za dodavanje; prazan naziv (posle trim) -> samo fokus na naziv, bez poziva; inače `sifarnik-dodaj {vrsta, naziv, skracenica (uppercase, samo sprave), ikona: ''}`. Uspeh: nova stavka na kraj liste (klonira se HTML prve postojeće stavke; ako lista nema nijednu stavku radi se `window.location.reload()`), brojač se uvećava, polja se prazne, fokus na polje skraćenice (sprave) ili naziv (ostali), toast `Dodato.`. Greška: toast greška sa porukom servera. Nova sprava uvek počinje bez ikone; ikona se bira kroz izmenu.
- Poznata mana (ne prenositi): ikona izabrana u izmeni prikazuje se samo ako na stranici već postoji stavka sa istom ikonom (SVG se kopira iz DOM-a), inače se vidi tek posle reload-a.
- Sva čuvanja šifarnika su trenutna (bez klika na "Sačuvaj podešavanja"). Deo B se čuva tek klikom na "Sačuvaj podešavanja".
- `Alt+N` na ovom ekranu nema slušaoca; `Esc` radi samo unutar reda za izmenu.
---

## 5. Stanje pripreme (`klubovi_stanje.php`, `stanje_oznake.php`)

Ovi delimični pogledi nisu deo ekrana Klubovi; ubacuju ih Početna, Takmičenja i Pregled takmičenja (`$pogled->deo('klubovi_stanje' | 'stanje_oznake', ['stanje' => ...])`). Navedeno zbog potpunosti.

Ulaz je `Prijave::stanjePripreme(takmicenjeId)` = `Priprema::stanje(prijave, potvrdjeniKlubovi)` (`app/Racun/Priprema.php`) plus `skracenica`/`puno_ime` po klubu. Struktura: `prijava`, `nepotpune`, `nerasporedjeni`, `nepotvrdjeni_klubovi`, `korak` (`prijave` | `rotacije` | `spremno`), `klubovi[klub_id|0] = {prijava, nepotpune, nerasporedjeni, potvrdjeno, skracenica, puno_ime}` (0 = prijave bez kluba). Prijava je potpuna kad ima kategoriju, program i bar jednu spravu; neraspoređena kad nije ni u jednoj grupi; nepotvrđen klub = klub (id različit od 0) sa prijavama čiji spisak nije potvrđen. `korak`: `prijave` ako nema prijava ili ima nepotpunih, inače `rotacije` ako ima neraspoređenih, inače `spremno`.

**`stanje_oznake.php`** (`span.oznake-stanja`, oznake `span.status`):
- `prijava == 0`: `status-warn` + ikona `upozorenje` 13 + `Nema prijava`.
- Inače: `status` `Prijava: {n}`; ako `nepotpune > 0`: `status-bad` + ikona + `Nepotpune: {n}`; ako `nepotvrdjeni_klubovi > 0`: `status-warn` `Nepotvrđeni klubovi: {n}`; ako `nerasporedjeni > 0`: `status-warn` `Neraspoređeni: {n}`; ako `korak == spremno` i `nepotvrdjeni_klubovi == 0`: `status-ok` + ikona `kvacica` 13 + `Spremno`.

**`klubovi_stanje.php`** (`table.tabela.tabela-zbijena`): kolone `Klub`, `Prijava` (66 px, desno), `Prijave` (120 px), `Spisak` (124 px), `Rotacije` (132 px). Red po klubu (`title` = puno ime):
- Klub: `bez kluba` (sivo) za id 0, inače `span.skr` skraćenica + sivo puno ime.
- Prijava: broj (`span.broj`, desno).
- Prijave: `nepotpune > 0` -> `status-bad` ikona `upozorenje` + `Nepotpune: {n}`; inače `status-ok` ikona `kvacica` + `Potpune`.
- Spisak: za id 0 sivi znak (en dash U+2013); `potvrdjeno` -> `status-ok` ikona `kvacica` + `Potvrđen`; inače `status-warn` `Nije potvrđen`.
- Rotacije: `nerasporedjeni > 0` -> `status-warn` `Neraspoređeni: {n}`; inače `status-ok` ikona `kvacica` + `Raspoređeni`.

---

## 6. Tastatura (docs/SPECIFIKACIJA.md, odeljak 6) i stvarno ponašanje na ova tri ekrana

| Prečica | Šta radi |
|---|---|
| F2 | Unos ocena (globalno) |
| F4 | Rang liste (globalno) |
| Tab, Enter | Sledeće polje. U formama Enter na poslednjem polju čuva |
| Esc | Otkaži izmenu |
| Alt+N | Novi zapis na ekranima sa tabelom i formom |
| Strelice gore, dole | Izbor reda u tabeli, drugi takmičar u unosu ocena |
| F8, F9, Alt+strelice, Ctrl+P, Ctrl+S | Drugi ekrani (unos ocena, rotacije, štampa, kopija) |

Pravila iz specifikacije: fokus je uvek vidljiv (crni okvir 2 px), redosled Tab prati redosled unosa, nijedna radnja ne zahteva miša. Prečice proveriti u Chrome-u i Edge-u.
Implementacija u PHP-u:
- Klubovi/Takmičari: `Alt+N` = novi; `Esc` u polju forme = otkaži (prazni formu i skida izbor, ne vraća prethodno stanje); strelice gore/dole u fokusiranoj tabeli menjaju izabrani red i odmah pune formu; `Enter` na izabranom redu = otvori (fokus u prvo polje); `ArrowDown` iz pretrage = prvi vidljivi red; Enter u formi = običan submit.
- Podešavanja: Enter čuva / Esc otkazuje u izmeni stavke; Enter u redu za dodavanje dodaje; nema Alt+N.
- `F2`, `F4` rade na svim ekranima.

---

## 7. Specifikacija i dokumenti, doslovno relevantni delovi

### docs/SPECIFIKACIJA.md, odeljak 5
**02 Klubovi**
- Tabela: puno ime, skraćenica, grad. Pretraga filtrira dok se kuca.
- Forma desno služi i za dodavanje i za izmenu. Alt+N prazni formu za novi klub, Enter čuva, Esc otkazuje.
- Skraćenica je obavezna i jedinstvena.

**03 Takmičari**
- Tabela: ID, prezime i ime, godište, pol, klub (skraćenica), lekarski važi do.
- Pretraga (ime, prezime, ID) i filteri: klub, pol, godište.
- Strelice gore i dole menjaju izabrani red, Enter otvara karton u formi desno.
- Karton: ID broj, ime, prezime, godina rođenja, pol, klub (puno ime), državljanstvo, lekarski važi do. Opciono: broj licence, trener, kontakt roditelja.
- Lekarski: ako ističe za 30 dana ili manje (prag je podešavanje), narandžasta oznaka "Ističe za N dana". Ako je istekao, crvena oznaka "Istekao". Isto i u formi pored polja.
- Datum se kuca kao `dd.mm.gggg` (tačke se mogu izostaviti, pa `25102026` postaje `25.10.2026.`).

**04 Podešavanja**
- Četiri liste: kategorije, programi, sprave muške, sprave ženske.
- Svaka stavka: izmena na licu mesta (red postaje polje, Enter čuva, Esc otkazuje), brisanje, promena redosleda prevlačenjem.
- Dodavanje na dnu liste: polje i "Dodaj" (Enter u polju dodaje). Sprava ima i skraćenicu i izbor ikone.

### docs/SPECIFIKACIJA.md, odeljak 3 (model podataka, ono što se tiče ovih ekrana)
- klubovi: `id`, `puno_ime`, `skracenica` (jedinstvena, 2 do 4 slova), `grad`.
- takmicari: `id`, `id_broj` (jedinstven, unosi ga korisnik, npr. `00203`), `ime`, `prezime`, `godina_rodjenja`, `pol` (M/Ž), `klub_id`, `drzavljanstvo`, `lekarski_do` (datum); opciono `broj_licence`, `trener`, `kontakt_roditelja`.
- kategorije, programi: `id`, `naziv`, `redosled`; "Liste koje korisnik sam uređuje."
- sprave: `id`, `pol`, `naziv`, `skracenica`, `ikona` (ime jedne od ikona iz `dizajn/ikone/` ili prazno), `redosled`; "Redosled sprava je i redosled kolona u višeboju i redosled rotacija." Početne vrednosti: muške Parter (PA), Konj sa hvataljkama (KH), Karike (KA), Preskok (PR), Razboj (RA), Vratilo (VR); ženske Preskok (PR), Dvovisinski razboj (DR), Greda (GR), Parter (PA).
- podesavanja: "ključ i vrednost (aktivno takmičenje, fascikla za kopije, prag upozorenja za lekarski u danima, podrazumevano 30)".
- "Brisanje: klub se ne može obrisati dok ima takmičare, takmičar dok ima prijave, stavke iz podešavanja dok se koriste. Poruka kaže zašto i koliko ih ima." (Implementacija dodatno blokira klub koji ima prijave.)
- "Za kasniji sajt sa rezultatima: svaka tabela ima `kreirano` i `izmenjeno`."

### docs/SPECIFIKACIJA.md, odeljak 10: otvorena pitanja i šta su postala
Uvod: "Ovo su pretpostavke iz dizajna. Napravi ih kao podešavanja ili lako izmenjiva mesta u kodu i pitaj pre nego što ih zaključaš."
| # | Pitanje (doslovno) | Ishod u PHP-u |
|---|---|---|
| 1 | Odsecanje ili zaokruživanje proseka E ocene na tri decimale. | Podešavanje `e_zaokruzivanje` (`odseci` podrazumevano / `zaokruzi`), oznaka "Prosek E ocene na tri decimale" |
| 2 | Po kom pravilu se sabira ekipno (koliko članova, koliko ocena se broji po spravi) i da li ekipa mora imati najmanji broj članova. | Nije u Podešavanjima; `takmicenja.ekipno_broji` (podrazumevano 3) po takmičenju |
| 3 | Deljenje mesta kod istog rezultata ili dodatno pravilo (viša E, pa viša D). | Podešavanje `plasman_isti_rezultat` (`deli` podrazumevano / `visa_e_pa_d`), oznaka "Isti rezultat" |
| 4 | Da li na preskoku postoje dva skoka čiji se prosek računa (u nekim programima). | Nije podešavanje i nije implementirano |
| 5 | Da li takmičar koji ne radi sve sprave ulazi u višeboj. | Podešavanje `viseboj_nepotpun` (`ulazi` podrazumevano / `ne_ulazi`), oznaka "Ko ne radi sve sprave" |
| 6 | Da li upozorenje za lekarski treba da spreči prijavu ili samo da upozori. | Podešavanje `lekarski_sprecava_prijavu` (`ne` podrazumevano / `da`), oznaka "Lekarski koji ne važi" |
| 7 | Da li su grupe i rotacije jedne za celo takmičenje (kako je ovde opisano) ili posebne po kategoriji. | Nije podešavanje; implementirano kao jedne za celo takmičenje |
Dodatna podešavanja na ekranu koja nisu iz odeljka 10: `lekarski_prag_dana`, `organizator`, `grb_levo`, `grb_desno`.

### docs/TOK-PRIPREME.md
Ne menja ekrane Klubovi, Takmičari, Podešavanja. Dodiruje ih na ovim mestima: dijalog "Novi" na Prijavama (novi takmičar: prezime, ime, "ID broj (predložen sledeći)", godina rođenja, pol, klub, lekarski; upisuje se u bazu takmičara i odmah prijavljuje); uvoz prijava ("ID broj dodeljuje program, sledeći slobodan; lekarski ostaje prazan"); Početna "Lekarski pregledi" (prijavljeni na nezavršena takmičenja kojima lekarski ne važi na dan takmičenja ili ističe u roku iz podešavanja `lekarski_prag_dana` posle njega); stanje pripreme po klubovima (odeljak 5 ovog fajla).

### docs/VIZUELNI-SISTEM.md (opšta pravila koja se primenjuju na ova tri ekrana)
Nema pravila specifičnih za ekran. Relevantno: crveno-bela paleta, bez senki (osim kartice koja se prevlači), bez gradijenata. Boje: `--primary #C8102E`, `--ink #1C1B1F`, `--ink-2 #45434B`, `--muted #6A6872`, `--line-2 #B9B6AF`, `--line #E4E2DD`, `--ground #F6F5F2`, `--surface #FFFFFF`, `--sel #F1EEE8` (izabrani red), `--sub #FAF9F7`, `--ok #0F6B3A/#DDF2E5`, `--warn #7A4300/#FFEFCC` (ivica polja sa upozorenjem `#C77700`), `--bad #A50E22/#FBE3E6`. Font Manrope (rezerva Segoe UI): naslov ekrana 22 px/800, naslov kartice 15 px/800, tekst i tabele 14/20 px 500, oznaka polja 12 px/600, zaglavlje tabele 12 px/700 verzal sa razmakom 0,04em; svi brojevi `tabular-nums`. Mere: meni 220, traka 56, margine sadržaja 20 gore/dole i 24 levo/desno, razmak kartica 12, radijus 6 (status, kbd), 8 (dugme, polje), 12 (kartica); ivice 1 px, fokus i polja sa upozorenjem/greškom 2 px. Dugme: 36 px u formama, 30 px u redu tabele; polje 36 px; zaglavlje kartice 48 px; zaglavlje tabele 34 px na `--sub` sa donjom linijom `--line-2`; red 40 px (izabran na `--sel`, tekst 600); oznaka statusa 22 px, 12 px/600; izbor jednog od više = spojena dugmad, izabrano crno sa belim tekstom; kućica/kružić 18 px. Statusi: "Ističe za N dana" (trougao, warn), "Istekao" (trougao, bad); "status nikad ne zavisi samo od boje" (uvek tekst, upozorenja i ikona). Ikone: linijske, mreža 24 px, debljina 1,75, `currentColor`, inline; ikone sprava su sopstveni crteži. Sve staje na 1366x768 bez skrolovanja gde je tako nacrtano.

---

## 8. Slike i HTML dizajn za ova tri ekrana (nisu otvarane)

- `dizajn/slike/02-klubovi.png`, `dizajn/slike/03-takmicari.png`, `dizajn/slike/04-podesavanja.png` (referentni PNG).
- `dizajn/ekrani/02-klubovi.html`, `dizajn/ekrani/03-takmicari.html`, `dizajn/ekrani/04-podesavanja.html`.
- Opšte: `dizajn/slike/00-vizuelni-sistem.png`, `dizajn/ekrani/00-vizuelni-sistem.html`, `dizajn/tokens.css`, `dizajn/fonts/` (Manrope), `dizajn/ikone/*.svg` (`meni-klubovi`, `meni-takmicari`, `meni-podesavanja`, `plus`, `pretraga`, `olovka`, `kanta`, `upozorenje`, `kvacica`, `hvataljka`, `sprava-PA|KH|KA|PR|RA|VR|DR|GR`).
- Primer podaci: `dizajn/primer-podaci.json` (učitava `alati/primer-podaci.php`).
- CSS koji definiše klase: `public/assets/css/app.css` (npr. `.sakriveno {display:none!important}`, `.tabela tbody tr.izabran`, `.lista-stavki`, `.stavka*`, `.izbor`, `.status*`, `.unos.upozorenje`, `.unos.greska`).

---

## 9. Zapažanja važna za re-implementaciju (SQLite / Electron / React)

1. Sortiranje: MySQL `croatian_ci` stavlja č, ć, đ, š, ž (i dž, lj, nj kao jedno slovo) na pravo mesto u azbuci i poredi bez razlike velikih/malih slova. SQLite `NOCASE` je samo ASCII; potrebna je prilagođena kolacija ili sortiranje u JS-u (`Intl.Collator('hr')`) za `klubovi.puno_ime` i `takmicari.prezime, ime`.
2. Jedinstvenost: `klubovi.skracenica` (case-insensitive, croatian_ci razlikuje c/č/ć), `takmicari.id_broj` (unicode_ci, case-insensitive); skraćenica sprave jedinstvena po polu samo u PHP proveri (ne u bazi).
3. Filtriranje u listama je klijentsko i normalizuje samo `č ć š ž đ` (ne `dž`); pretraga je podstring.
4. Pol se čuva `M`/`Z`, prikazuje `M`/`Ž`.
5. Datum lekarskog: unos `dd.mm.gggg[.]` ili `ddmmgggg`, čuva se ISO `gggg-mm-dd`, prikaz `dd.mm.gggg.`.
6. Bedž lekarskog u tabeli: `Istekao` (bad), `Ističe za N dana` (warn, uključuje 0 dana), `Nema lekarskog` (bad), ništa kad važi. U formi: `Lekarski je istekao`, `Ističe za N dana`, `Neispravan datum (dd.mm.gggg)`; nema poruke za prazno polje.
7. Brisanje: klub (takmičari, pa prijave), takmičar (prijave), šifarnik (prijave/ocene); poruke u 2.2, 3.2, 4.1. Klijent kod klubova unapred blokira brisanje (`Klub ima {n} takmičara u bazi i ne može se obrisati.`, bez dela "Prvo premestite ili obrišite takmičare.").
8. Čuvanje: Klubovi i Takmičari čuvaju samo na submit (posle čuvanja red ostaje izabran, forma u režimu izmene, flash poruka); šifarnici se čuvaju odmah po stavci; opšta podešavanja na jedno dugme.
9. Nema straničenja (svi redovi odjednom). Brojači: klubovi `{n} klubova`, takmičari `Prikazano {n} od {ukupno} takmičara`, šifarnici broj stavki u zaglavlju kartice.
10. PHP ne proverava dužine polja ni dužinu ID broja (VARCHAR 20); strogi SQL režim daje grešku (HTTP 500 kod API-ja, opšta greška kod formi).
11. `sledeciIdBroj()` nije povezan sa formom Takmičari (nova forma je prazna); ako plan to menja, to je novo ponašanje.
12. Prelivanje datuma: klijent (JS `new Date`) prihvata 31.02, server (`checkdate`) odbija; u novoj aplikaciji koristiti jedno pravilo (server/`checkdate` semantiku).