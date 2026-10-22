# Faza 3: popis PHP verzije za ekrane Takmičenja, Prijave, Uvoz prijava iz fajla (i traka koraka)

Izvor: `C:\Users\bojan\Desktop\Takmicarski program` (PHP 8 + MySQL, verzija 1.2.0). Popis je samo čitanje, ništa u PHP projektu nije menjano.
Svi stringovi u navodnicima su doslovni (srpski, latinica sa dijakriticima). Putanje su relativne u odnosu na koren PHP projekta.
Notacija kao u `2026-10-21-faza-2-popis-php.md`: `post()` = vrednost iz POST-a sa `trim()`; `e()` = HTML escape; vreme u bazi je UTC (`Baza::sad()`), aplikacija radi u zoni `Europe/Belgrade`. Zajednički helperi i `app.js` (`App.api`, `App.obavesti`, `App.potvrdi`, `App.uPolju`, `App.tabelaNavigacija`, globalne prečice, `input.datum` blur, `data-fokus`) su opisani u odeljku 0 faze 2 i ovde se ponavljaju samo razlike i dopune (odeljak 0).

Gde se UI razlikuje od slika (`dizajn/slike/05-takmicenja.png`, `06-prijave.png`, `dizajn/ekrani/05-takmicenja.html`, `06-prijave.html`) i od odeljaka 05 i 06 u `docs/SPECIFIKACIJA.md`, važi `docs/TOK-PRIPREME.md` (od 1.1.0) i kod. Slike i HTML nisu otvarani za ovaj popis; samo se navode. Razlike: nema dugmeta "Aktiviraj" (klik na red ili "Otvori" aktivira); lista takmičenja ima kolonu "Priprema" i dugmad "Izmeni"/"Otvori"; forma novog takmičenja je cela strana (ne dijalog); prijave nemaju dva odvojena prekidača "član ekipe" i "van konkurencije" nego jedan izbor Učešće (Ekipa/Poj./VK); levi panel dugme je "Prijavi" (ne "Dodaj u prijave"), a već prijavljeni su sivi sa kvačicom (ne sa tekstom "Prijavljen"); tabela je složena po klubovima sa potvrdom spiska; uvoz iz fajla ne postoji u specifikaciji ni na slikama.

---

## 0. Zajedničko za ova tri ekrana

### 0.1 Aktivno takmičenje (`app/Jezgro/Aplikacija.php`, `Podesavanja.php`)
- Aktivno takmičenje je podešavanje `aktivno_takmicenje` (tabela `podesavanja`, ključ/vrednost; prazan string = nema). `Podesavanja::aktivnoTakmicenjeId()`: `''` -> `null`, inače `(int)`. Pri svakom zahtevu `Aplikacija::pokreni()` učita red `SELECT * FROM takmicenja WHERE id = ?` u `$app->aktivno` (ako takmičenje ne postoji, ostaje `null`).
- `aktivnoId(): ?int` = `(int) aktivno['id']` ili `null`.
- `aktivnoIdIliGreska(): int` (koristi API): baca `RuntimeException('Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.')`.
- `trazimAktivno(): array` (koriste kontroleri Prijave i Uvoz): ako nema aktivnog -> flash `upozorenje` "Prvo izaberite aktivno takmičenje." + redirect na `takmicenja`; inače vraća red aktivnog takmičenja.
- Podešavanja koja ovi ekrani čitaju: `lekarski_prag_dana` (podrazumevano `'30'`, `dajInt`), `lekarski_sprecava_prijavu` (`'ne'` podrazumevano | `'da'`; uključuje se u Podešavanjima).
- Flash poruke: `poruka($vrsta, $tekst)`, vrste koje ovi ekrani koriste: `ok`, `greska`, `upozorenje`, `info`. Prikaz u okviru (faza 2, odeljak 0.1). Boje: `poruka-ok` zeleno, `poruka-greska` crveno, `poruka-info` plavo, `poruka-upozorenje` narandžasto.
- Okvir: Takmičenja i Prijave dobijaju `sadrzajKlasa = 'sadrzaj-fiksno'` (cela strana ne skroluje, tabele skroluju u `.kartica-skrol`). Forma takmičenja i Uvoz nemaju tu klasu (cela strana skroluje). Naslovi (`<h1>`): "Takmičenja", "Takmičenje: podaci" (izmena), "Novo takmičenje", "Prijave", "Uvoz prijava iz fajla".

### 0.2 Pomoćne funkcije koje ovi ekrani koriste (`app/Jezgro/pomocne.php`)
- `datum_parsiraj`, `datum_prikaz` (`17.10.2026.`), `pol_slovo` (`Z` -> `Ž`), `post_int`, `get_int`, kao u fazi 2.
- `pol_naziv('M')` = `MSG`, `pol_naziv('Z')` = `ŽSG`, inače `''` (koristi se u naslovu desne kartice Prijava).
- `post()` vraća `trim()` stringa; niz u POST-u daje podrazumevanu vrednost.

### 0.3 Stanje pripreme (`app/Racun/Priprema.php`, čiste funkcije)
Konstante: `EKIPA='ekipa'`, `POJEDINAC='pojedinac'`, `VK='vk'`; `KORAK_PRIJAVE='prijave'`, `KORAK_ROTACIJE='rotacije'`, `KORAK_SPREMNO='spremno'`.

- `ucesce(int $clanEkipe, int $vanKonkurencije): string`: `van_konkurencije === 1` -> `vk` (ima prednost, i kad su oba 1); inače `clan_ekipe === 1` -> `ekipa`; inače `pojedinac`.
- `poljaUcesca(string $ucesce): array{clan_ekipe:int, van_konkurencije:int}`: `ekipa` -> `[1,0]`, `pojedinac` -> `[0,0]`, `vk` -> `[0,1]`; drugo baca `InvalidArgumentException('Nepoznato učešće: ' . $ucesce)`.
- `potpuna(array $p): bool` = `kategorija_id !== null && program_id !== null && broj_sprava > 0`.
- `stanje(array $prijave, array $potvrdjeniKlubovi)`: ulaz po prijavi `{klub_id:int|null, kategorija_id, program_id, broj_sprava:int, u_grupi:bool}`; izlaz `{prijava:int, nepotpune:int, nerasporedjeni:int, nepotvrdjeni_klubovi:int, korak:string, klubovi: array<klubId, {prijava, nepotpune, nerasporedjeni, potvrdjeno:bool}>}`.
  - ključ kluba je `(int)(klub_id ?? 0)`; ključ `0` = prijave bez kluba; `potvrdjeno` je `true` samo za `kid !== 0` koji je u listi potvrđenih.
  - `nepotpune` = broj prijava koje nisu `potpuna`; `nerasporedjeni` = broj sa `u_grupi === false` (i ukupno i po klubu).
  - `nepotvrdjeni_klubovi` = broj ključeva `kid !== 0` iz `klubovi` (dakle samo klubovi koji imaju prijave) sa `potvrdjeno === false`. Potvrda kluba bez prijava se ne računa.
  - `korak`: `prijave` ako nema prijava ili `nepotpune > 0`; inače `rotacije` ako `nerasporedjeni > 0`; inače `spremno`. Nepotvrđen spisak ne utiče na korak.
  - Redosled ključeva u `klubovi` je redosled prvog pojavljivanja u ulazu.

### 0.4 Procena lekarskog (`Takmicari::lekarski`)
`lekarski(?string $vaziDo, int $pragDana, ?string $naDan = null): array{stanje, dana}`: `null`/`''` (ili neparsiran datum) -> `['stanje'=>'nema','dana'=>null]`; `dana = floor((strtotime(vaziDo) - strtotime(naDan ?? danas)) / 86400)`; `dana < 0` -> `istekao`; `dana <= pragDana` -> `istice`; inače `vazi`. Prijave i Uvoz koriste dan takmičenja (`takmicenja.datum`) kao `naDan`. "Lekarski ne važi" (`neVazi`) = stanje `nema` ili `istekao` (`istice` NE računa se kao upozorenje na Prijavama).

---

## 1. Šema baze (`migracije/001_pocetna.sql`, `002`, `003`), tabele ovih ekrana

MySQL InnoDB utf8mb4; `naziv`, `mesto`, `organizator`, `domacin` imaju `utf8mb4_croatian_ci`, ostalo `utf8mb4_unicode_ci`. Strogi SQL režim: predugačka vrednost je greška baze (kontroleri to ne hvataju posebno; nema validacije dužine u PHP-u). U SQLite verziji treba dodati eksplicitnu proveru dužine ili je izostaviti svesno.

### takmicenja
| kolona | tip | napomena |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| naziv | VARCHAR(150) NOT NULL | |
| datum | DATE NOT NULL | indeks `ix_takmicenja_datum` |
| mesto | VARCHAR(100) NOT NULL DEFAULT '' | |
| broj_e_sudija | TINYINT NOT NULL DEFAULT 4 | 1..6 |
| pravilo_e | VARCHAR(30) NOT NULL DEFAULT 'odbaci_krajnje' | `odbaci_krajnje` ili `prosek_svih` |
| ekipno_broji | TINYINT NOT NULL DEFAULT 3 | 1..10 |
| pomeraj_redosled | TINYINT(1) NOT NULL DEFAULT 0 | |
| zavrseno | TINYINT(1) NOT NULL DEFAULT 0 | arhivirano |
| zaglavlje_biltena | VARCHAR(255) NOT NULL DEFAULT '' | |
| organizator | VARCHAR(150) NOT NULL DEFAULT '' | |
| domacin | VARCHAR(150) NOT NULL DEFAULT '' | migracija 002, slobodan tekst |
| grb_levo | VARCHAR(255) NOT NULL DEFAULT '' | migracija 002, putanja relativno od `public/` (npr. `grb/takmicenje_5_levo_20261017120000.png`) ili `''` |
| grb_desno | VARCHAR(255) NOT NULL DEFAULT '' | isto |
| kreirano, izmenjeno | DATETIME NOT NULL | UTC |

Prazan grb znači: koristi se grb iz Podešavanja (`podesavanja.grb_levo`/`grb_desno`).

### prijave
`id` PK; `takmicenje_id` INT NOT NULL (FK `takmicenja` ON DELETE **RESTRICT**); `takmicar_id` INT NOT NULL (FK `takmicari` RESTRICT); `klub_id` INT NULL (FK `klubovi` RESTRICT; snapshot kluba iz kartona u trenutku prijave); `kategorija_id` INT NULL (FK `kategorije` RESTRICT); `program_id` INT NULL (FK `programi` RESTRICT); `clan_ekipe` TINYINT(1) DEFAULT 0; `van_konkurencije` TINYINT(1) DEFAULT 0; `startni_broj` INT NULL; `kreirano`, `izmenjeno`. UNIQUE `uq_prijave_takmicenje_takmicar (takmicenje_id, takmicar_id)`; indeks `ix_prijave_grupa (takmicenje_id, kategorija_id, program_id)`. Startni broj NIJE jedinstven na nivou baze (jedinstvenost samo u PHP kodu, vidi 3.3).

### prijava_sprave
`prijava_id` INT, `sprava_id` INT, PK (oba). FK `prijava` ON DELETE CASCADE, FK `sprava` RESTRICT.

### potvrde_klubova (migracija 003)
`takmicenje_id` INT, `klub_id` INT, `potvrdjeno` DATETIME NOT NULL (UTC trenutak potvrde); PK (`takmicenje_id`, `klub_id`); FK `takmicenja` CASCADE, FK `klubovi` CASCADE. Red postoji samo dok je spisak potvrđen.

### Kaskade i blokade (brisanje)
- `takmicenja` -> `prijave` je RESTRICT: takmičenje sa bar jednom prijavom se ne briše (proverava i PHP). Brisanje takmičenja bez prijava briše kaskadno: `grupe` (pa `grupa_clanovi`, `grupa_redosled`), `potvrde_klubova`.
- `prijave` -> `prijava_sprave`, `grupa_clanovi`, `ocene` (pa `ocene_e`, `izmene_ocena`) su CASCADE; ocene sa statusom različitim od `nacrt` blokiraju brisanje prijave u PHP-u (3.3), `nacrt` ocene nestaju sa prijavom.
- Šifarnici: kategorija/program se ne mogu obrisati dok ih koristi prijava; sprava dok je u `prijava_sprave` ili `ocene` (poruka "Stavka se koristi u N prijava ili ocena i ne može se obrisati.").
- Povezane tabele koje ovi ekrani čitaju: `takmicari` (id_broj UNIQUE, ime, prezime, godina_rodjenja, pol M|Z, klub_id, drzavljanstvo, lekarski_do), `klubovi` (puno_ime, skracenica UNIQUE), `kategorije`/`programi` (id, naziv, redosled), `sprave` (id, pol, naziv, skracenica, ikona, redosled), `grupa_clanovi` (za `u_grupi`), `ocene` (prijava_id, sprava_id, status `nacrt|uneto|odustao`).

---

## 2. Model Takmicenja (`app/Modeli/Takmicenja.php`)

Konstante: `POLJA = ['naziv','datum','mesto','broj_e_sudija','pravilo_e','ekipno_broji','pomeraj_redosled','zavrseno','zaglavlje_biltena','organizator','domacin']` (samo ova se upisuju kroz `sacuvaj`); `GRBOVI = ['grb_levo','grb_desno']` (upisuju se samo kroz `postaviGrb`).
Pravila E ocene (`App\Racun\Ocena`): `PRAVILO_ODBACI = 'odbaci_krajnje'` (opis "Odbaci najvišu i najnižu, prosek ostalih"), `PRAVILO_PROSEK = 'prosek_svih'` ("Prosek svih E ocena"); `Ocena::PRAVILA` je mapa vrednost -> opis (proverava se `isset`).

| funkcija | opis |
|---|---|
| `sva(): array` | `SELECT t.*, broj_prijava (COUNT prijave), broj_ocena (COUNT ocene JOIN prijave gde status <> 'nacrt') FROM takmicenja t ORDER BY t.datum DESC, t.id DESC`. Lista UI ne koristi `broj_prijava` ni `broj_ocena` (stanje dolazi iz `stanjePripreme`). |
| `nadji(int $id): ?array` | `SELECT * WHERE id = ?`. |
| `imaOcena(int $id): bool` | postoji ocena sa `status <> 'nacrt'` na bilo kojoj prijavi takmičenja (uneto i odustao se broje; nacrt ne). |
| `brojPrijava(int $id): int` | COUNT prijava. |
| `static prazno(): array` | podrazumevane vrednosti nove forme: `naziv ''`, `datum null`, `mesto ''`, `broj_e_sudija 4`, `pravilo_e 'odbaci_krajnje'`, `ekipno_broji 3`, `pomeraj_redosled 0`, `zavrseno 0`, `zaglavlje_biltena ''`, `organizator ''`, `domacin ''`, `grb_levo ''`, `grb_desno ''`. |
| `static izPosta(): array` | `naziv=post`, `datum=datum_parsiraj(post('datum'))` (`'Y-m-d'`, `null` za prazno, `false` za neispravno), `mesto`, `broj_e_sudija=(int)post`, `pravilo_e=post`, `ekipno_broji=(int)post`, `pomeraj_redosled = post==='1' ? 1 : 0`, `zavrseno = post==='1' ? 1 : 0`, `zaglavlje_biltena`, `organizator`, `domacin`. (Grb polja se ne čitaju ovde.) |
| `proveri(array $p, ?int $id): string[]` | lista grešaka, redom (sve se skupljaju, ne staje na prvoj): vidi 2.1. |
| `sacuvaj(array $p, ?int $id): int` | `array_intersect_key($p, POLJA)`; `izmenjeno = sad`; za novo `kreirano = sad` + INSERT, vraća novi id; za izmenu UPDATE `WHERE id = ?`, vraća `$id`. Grb kolone se ne diraju. |
| `postaviGrb(int $id, string $polje, string $putanja): void` | `polje` mora biti u `GRBOVI`, inače `InvalidArgumentException('Nepoznato polje grba: ' . $polje)`; UPDATE polje + `izmenjeno`. `''` uklanja grb. |
| `obrisi(int $id): void` | ako ima prijava: `RuntimeException("Takmičenje ima {$n} prijava i ne može se obrisati.")` (n = broj prijava); inače `DELETE` (kaskada, vidi odeljak 1). |
| `static status(array $t, ?int $aktivnoId): string` | `aktivno` ako `aktivnoId !== null && t.id === aktivnoId`; inače `zavrseno` ako `zavrseno === 1`; inače `priprema`. (Aktivno ima prednost nad završenim.) |

### 2.1 `proveri` poruke (doslovno, redom)
1. `naziv === ''` -> "Naziv takmičenja je obavezan."
2. `datum === null` -> "Datum je obavezan."; `datum === false` -> "Datum nije ispravan (dd.mm.gggg)."
3. `broj_e_sudija < 1 || > 6` -> "Broj E sudija mora biti između 1 i 6."; INAČE (samo kad je u opsegu) ako je `$id !== null`, takmičenje postoji, `staro.broj_e_sudija !== novo` i `imaOcena($id)` -> "Broj E sudija se ne može menjati kad takmičenje već ima unete ocene."
4. `pravilo_e` nije ključ `Ocena::PRAVILA` -> "Nepoznato pravilo za E ocenu."
5. `ekipno_broji < 1 || > 10` -> "Broj ocena koje se broje za ekipu mora biti između 1 i 10."
Napomene: `mesto`, `zaglavlje_biltena`, `organizator`, `domacin` nemaju validaciju. `zavrseno` nema validaciju.

---

## 3. Model Prijave (`app/Modeli/Prijave.php`)

Konstruktor `(Baza, Podesavanja)`. Sve greške su `\RuntimeException` (API ih pretvara u HTTP 400 `{ok:false, greska}`).

### 3.1 Čitanje
- `lista(int $takmicenjeId, ?string $pol = null): array`: `SELECT p.*, t.id_broj, t.ime, t.prezime, t.godina_rodjenja, t.pol, t.lekarski_do, k.skracenica AS klub_skr, k.puno_ime AS klub_ime, sprave_ids` iz `prijave p JOIN takmicari t LEFT JOIN klubovi k` (klub je snapshot `p.klub_id`, ne `t.klub_id`), filtar `AND t.pol = ?` ako je pol zadat; `ORDER BY t.pol DESC, t.prezime, t.ime` (dakle prvo `Z` pa `M`, zatim prezime, ime; croatian_ci). Svaki red dobija `sprave: int[]` (id sprava iz `prijava_sprave`; redosled iz `GROUP_CONCAT` nije definisan, UI ga koristi kao skup).
- `nadji(int $id): ?array`: red prijave + `t.pol, t.ime, t.prezime` + `sprave: int[]`. Ne proverava takmičenje.
- `prijavljeniTakmicari(int $takmicenjeId): int[]` (id takmičara).
- `potvrdjeniKlubovi(int $takmicenjeId): int[]`.
- `brojevi(int $takmicenjeId): array{prijava:int, klubova:int}`: COUNT prijava; COUNT(DISTINCT klub_id) gde `klub_id IS NOT NULL` (koristi Početna).
- `lekarskiUpozorenja(int $pragDana): array` (koristi Početna): prijave na takmičenja sa `zavrseno = 0`, `ORDER BY tk.datum, tk.id, t.prezime, t.ime`; polja `takmicar_id, ime, prezime, lekarski_do, klub_skr, takmicenje_id, takmicenje (naziv), datum`; za svaki red `lek = Takmicari::lekarski(lekarski_do, pragDana, datum takmičenja)`; u izlaz ulaze svi čiji `lek.stanje !== 'vazi'` (znači `nema`, `istekao` i `istice`), red + `lek`.
- `stanjePripreme(int $takmicenjeId): array`: čita prijave (`klub_id, kategorija_id, program_id, k.skracenica, k.puno_ime, broj_sprava = COUNT prijava_sprave, u_grupi = COUNT grupa_clanovi > 0`, `ORDER BY k.skracenica`), poziva `Priprema::stanje(ulaz, potvrdjeniKlubovi)`, i svakom unosu u `klubovi` dodaje `skracenica` i `puno_ime` (string, `''` za klub `0`). Redosled klubova u rezultatu = redosled prvog pojavljivanja u upitu (SQL `ORDER BY skracenica`, bez kluba prvo u MySQL-u, ali ga UI ionako stavlja na kraj).

### 3.2 Prijavljivanje
`dodajVise(int $takmicenjeId, array $takmicarIds): array{dodato:int, preskoceno:string[], upozorenja:string[]}`
- Uzima prvu kategoriju (`SELECT id FROM kategorije ORDER BY redosled, id LIMIT 1`) i prvi program (isto za `programi`) (mogu biti `null` ako su šifarnici prazni).
- Za svaki `array_unique($takmicarIds)` poziva `dodajJednu(takm, tid, prvaKat, prviProg, 'pojedinac')`: `dodato` -> `dodato++`, i ako `lekarski_ne_vazi` -> `upozorenja[] = ime` ("Prezime Ime"); `preskoceno` -> `preskoceno[] = poruka`; `vec` i `nema` se tiho ignorišu (ne broje se nigde).

`dodajJednu(int $takmicenjeId, int $takmicarId, ?int $kategorijaId, ?int $programId, string $ucesce): array{stanje, ime, poruka, lekarski_ne_vazi:bool, prijava_id:int|null}`; `stanje`: `dodato | vec | nema | preskoceno`. Redosled provera:
1. takmičenje ne postoji -> baca `RuntimeException('Takmičenje ne postoji.')`.
2. takmičar ne postoji -> `['stanje'=>'nema','ime'=>'','poruka'=>'Takmičar ne postoji.','lekarski_ne_vazi'=>false,'prijava_id'=>null]`.
3. `ime = prezime . ' ' . ime` (npr. "Test Ana"). Već prijavljen (po `prijavljeniTakmicari`) -> `stanje 'vec'`, `poruka = ime . ' je već prijavljen.'`.
4. Lekarski: `prag = dajInt('lekarski_prag_dana', 30)`, `lek = lekarski(t.lekarski_do, prag, takmicenje.datum)`, `neVazi = stanje in (nema, istekao)`. Ako `neVazi` i podešavanje `lekarski_sprecava_prijavu === 'da'` -> `stanje 'preskoceno'`, `poruka = ime . ' (lekarski ne važi na dan takmičenja)'`, `lekarski_ne_vazi true`, ništa se ne upisuje.
5. `Priprema::poljaUcesca($ucesce)`; `InvalidArgumentException` se pretvara u `RuntimeException` sa istom porukom ("Nepoznato učešće: X").
6. U transakciji: INSERT `prijave` (`takmicenje_id`, `takmicar_id`, `klub_id = takmicar.klub_id` (snapshot, može null), `kategorija_id`, `program_id`, `startni_broj null`, `kreirano`, `izmenjeno`, `clan_ekipe`, `van_konkurencije` iz učešća); zatim INSERT u `prijava_sprave` za SVE sprave pola takmičara (`SELECT id FROM sprave WHERE pol = ? ORDER BY redosled`).
7. Ako takmičar ima klub: `potvrdiKlub(takm, klub, false)` (briše potvrdu spiska tog kluba).
8. Vraća `['stanje'=>'dodato','ime'=>ime,'poruka'=>'','lekarski_ne_vazi'=>neVazi,'prijava_id'=>pid]`. Lekarski koji ne važi ali ne sprečava prijavu: prijava se pravi, `lekarski_ne_vazi true` (upozorenje).

### 3.3 Izmene
- `izmeniPolje(int $takmicenjeId, int $prijavaId, string $polje, mixed $vrednost): void`: prijava mora postojati i pripadati takmičenju, inače 'Prijava ne postoji.'. Polja:
  - `kategorija_id` / `program_id`: `null`, `''` ili `(int)0` -> `NULL`; inače `(int)`; ako red u `kategorije`/`programi` ne postoji -> 'Stavka ne postoji.'
  - `clan_ekipe` / `van_konkurencije`: `vrednost ? 1 : 0` (PHP truthy: `'0'`, `''`, `0`, `false`, `null` = 0). (UI ova dva polja više ne šalje direktno; koristi `prijave-ucesce`. Testovi ih koriste.)
  - `startni_broj`: `trim((string)vrednost)`; `''` -> `NULL`; ne sme biti `!ctype_digit` niti `< 1` -> 'Startni broj mora biti pozitivan ceo broj.'; ako isti broj već ima druga prijava istog takmičenja (`p.id <> ?`) -> `'Startni broj ' . $v . ' već ima ' . $prezime . ' ' . $ime . '.'` (npr. "Startni broj 21 već ima Test Ana.").
  - bilo koje drugo polje -> `'Nepoznato polje: ' . $polje`.
  - UPDATE polja + `izmenjeno`. Ne briše potvrdu kluba.
- `postaviSpravu(int $takmicenjeId, int $prijavaId, int $spravaId, bool $radi): void`: prijava mora postojati u takmičenju ('Prijava ne postoji.'); sprava mora postojati i `sprava.pol === prijava.pol` inače 'Sprava ne odgovara polu takmičara.'. `radi`: `INSERT IGNORE` u `prijava_sprave`. `!radi`: ako postoji ocena te prijave na toj spravi sa `status <> 'nacrt'` -> 'Na toj spravi već postoji uneta ocena. Prvo je obrišite u unosu ocena.'; inače briše red iz `prijava_sprave` i briše `nacrt` ocenu te prijave na toj spravi. Na kraju UPDATE `prijave.izmenjeno`.
- `postaviUcesce(int $takmicenjeId, int $prijavaId, string $ucesce): void`: 'Prijava ne postoji.'; `poljaUcesca` (nepoznato -> RuntimeException 'Nepoznato učešće: X'); UPDATE oba polja + `izmenjeno`.
- `obrisi(int $takmicenjeId, int $prijavaId): void`: 'Prijava ne postoji.'; `n` = broj ocena prijave sa `status <> 'nacrt'`; ako `n > 0` -> `$prezime . ' ' . $ime . ' ima ' . $n . ' unetih ocena. Prijava se ne može obrisati.'` (npr. "Test Ana ima 2 unetih ocena. Prijava se ne može obrisati."; gramatika nije prilagođena broju); inače `DELETE FROM prijave` (kaskada: sprave, grupa, nacrt ocene) i, ako prijava ima klub, `potvrdiKlub(takm, klub, false)`.
- `potvrdiKlub(int $takmicenjeId, int $klubId, bool $potvrdjeno): void`: `false` -> DELETE reda potvrde (nema greške ako ga nema). `true` -> ako klub nema nijednu prijavu na ovom takmičenju: 'Klub nema prijava na ovom takmičenju.'; inače upsert `(takmicenje_id, klub_id, potvrdjeno = sad)` (`ON DUPLICATE KEY UPDATE`; ponovna potvrda osvežava vreme).
- `dodeliStartneBrojeve(int $takmicenjeId): int`: `sledeci = COALESCE(MAX(startni_broj), 0) + 1` po takmičenju; prijave bez broja redom `ORDER BY t.pol DESC, kat.redosled, k.skracenica, t.prezime, t.ime` (prvo Ž pa M; kategorija po `redosled` (NULL kategorije prvo u MySQL-u); skraćenica kluba iz snapshot kluba (NULL prvo); prezime; ime) dobijaju `sledeci++` (UPDATE + `izmenjeno`). Vraća broj dodeljenih. Postojeći brojevi se ne diraju.

### 3.4 Rezime pravila
- Jedan takmičar jednom po takmičenju (UNIQUE + provera `vec`).
- Klub prijave je snapshot; promena kluba u kartonu ne menja prijavu.
- Svaka promena spiska kluba (dodavanje ili brisanje prijave) poništava potvrdu tog kluba; promena polja, sprava, učešća ili startnog broja je NE poništava.
- Nova prijava: sve sprave pola, prva kategorija, prvi program, učešće pojedinac, bez startnog broja.
- Lekarski ne sprečava prijavu osim kad je `lekarski_sprecava_prijavu = 'da'`.

---

## 4. Ekran Takmičenja

### 4.1 Rute (`app/Kontroleri/takmicenja.php`, URL oblik `index.php?r=takmicenja/<akcija>`)
| ruta | metoda | šta radi |
|---|---|---|
| `takmicenja` (`index`) | GET | lista |
| `takmicenja/novo` | GET | prazna forma (cela strana) |
| `takmicenja/izmeni&id=N` | GET | forma za izmenu; nepostojeći/nevažeći id: flash `greska` "Takmičenje ne postoji." + redirect `takmicenja` |
| `takmicenja/sacuvaj` | POST | snimanje (novo i izmena) |
| `takmicenja/otvori` | POST (`id`) | aktivira i vodi na prvi nezavršen korak |
| `takmicenja/obrisi` | POST (`id`) | brisanje |
| druga akcija | | HTTP 404, stranica greške "Nepoznata akcija." |

Svaka POST akcija (`sacuvaj`, `otvori`, `obrisi`) kad nije POST preusmerava na `takmicenja` bez poruke. Forme nose CSRF polje (u Electron aplikaciji nepotrebno).

### 4.2 `index`
- Za svako takmičenje iz `sva()` dodaje se `stanje = stanjePripreme(id)`.
- Pogledu se predaje: `naslov 'Takmičenja'`, `takmicenja`, `aktivnoId`, JS `takmicenja.js`.

### 4.3 `sacuvaj`
1. `id = post_int('id')` (skriveno polje; prazno = novo), `p = izPosta()`, `greske = proveri(p, id)`.
2. Ako ima grešaka: forma se prikazuje ponovo (HTTP 200, bez redirecta) sa `greske`; `p['datum']` se vraća na sirovi unos (`post('datum')`), a `grb_levo`/`grb_desno` iz postojećeg reda (`nadji(id)`, `''` za novo); ništa se ne upisuje (ni grbovi).
3. Inače `novo = (id === null)`; `id = sacuvaj(p, id)`; zatim `sacuvajGrbove(id)` (vidi 4.4).
4. Novo: `aktivno_takmicenje = id` (novo takmičenje ODMAH postaje aktivno), flash `ok` "Takmičenje „{naziv}“ je napravljeno i postavljeno kao aktivno. Prijavite takmičare." + redirect na `prijave`.
5. Izmena: flash `ok` "Takmičenje „{naziv}“ je sačuvano." + redirect na `takmicenja/izmeni&id=N` (ostaje na formi). Aktivno takmičenje se pri izmeni ne menja (ni kad se označi "završeno").

Navodnici u porukama su tipografski „ i “ (U+201E, U+201C).

### 4.4 Grbovi (`$sacuvajGrbove`), za `grb_levo` i `grb_desno`
- Ako `obrisi_<polje> === '1'` u POST-u: `postaviGrb(id, polje, '')`, preskače otpremanje tog polja.
- Fajl `$_FILES[<polje>]`: ako nema ili `UPLOAD_ERR_NO_FILE` preskače. Greška otpremanja (`error != OK` ili nije `is_uploaded_file`) -> flash `greska` "Grb nije otpremljen (greška N)." i nastavlja.
- Ekstenzija (mala slova) mora biti `png, jpg, jpeg, svg, gif`, inače flash `greska` "Grb mora biti PNG, JPG, GIF ili SVG slika." (proverava se samo ekstenzija, ne sadržaj; nema ograničenja veličine osim PHP ini).
- Fascikla `public/grb` (pravi se ako ne postoji; ako ne može: flash `greska` "Ne mogu da napravim fasciklu za grbove." i prekida obradu grbova).
- Ime fajla: `takmicenje_{id}_{levo|desno}_{YmdHis}.{ext}` (novo ime svaki put da pregledač ne prikazuje stari iz keša); `postaviGrb(id, polje, 'grb/' . ime)`. Ako `move_uploaded_file` ne uspe: flash `greska` "Grb nije sačuvan.". Stari fajl se ne briše sa diska.
- Zamena grba: novi fajl menja putanju; "ukloni" samo prazni kolonu.

### 4.5 `otvori` (klik na red, Enter, dugme "Otvori")
- `t = nadji(post('id'))`; ne postoji: flash `greska` "Takmičenje ne postoji." + redirect `takmicenja`.
- `aktivno_takmicenje = t.id` (važi i za završeno takmičenje), `stanje = stanjePripreme(t.id)`, pa po `stanje.korak`:
  - `prijave`: flash `upozorenje`. Ako je `stanje.prijava === 0`: "Aktivno takmičenje: {naziv}. Još nema prijava: prvo prijavite takmičare."; inače "Aktivno takmičenje: {naziv}. Prijave bez kategorije, programa ili sprava: {nepotpune}.". Redirect na `prijave`.
  - `rotacije`: flash `upozorenje` "Aktivno takmičenje: {naziv}. Takmičari koji nisu raspoređeni u grupe: {nerasporedjeni}.". Redirect na `rotacije`.
  - `spremno`: bez poruke, redirect na `takmicenje` (Pregled takmičenja).

### 4.6 `obrisi`
- `id = (int) post('id')`; `obrisi(id)`; ako je `aktivnoId === id`, `aktivno_takmicenje = ''`; flash `ok` "Takmičenje je obrisano.". `RuntimeException` (ima prijava) -> flash `greska` sa porukom modela ("Takmičenje ima N prijava i ne može se obrisati."). Uvek redirect na `takmicenja` (nepostojeći id: `DELETE` ne pogađa red, ipak se javlja "Takmičenje je obrisano.").

### 4.7 Forma `prikazi(?int $id, array $forma, array $greske)` predaje pogledu
`naslov` = `id ? 'Takmičenje: podaci' : 'Novo takmičenje'`, `id`, `forma`, `greske`, `imaOcena = id ? imaOcena(id) : false`, `klubovi = Klubovi::svi()` (po `puno_ime`), `stanje = id ? stanjePripreme(id) : null`, `jeAktivno = (id !== null && aktivnoId === id)`, JS `takmicenje-forma.js`.

### 4.8 Pogled liste (`app/Pogledi/takmicenja.php`)
- Jedna kartica preko cele širine (`kartica raste`, overflow hidden). Zaglavlje: `<h2>` "Sva takmičenja"; desno dugme-link `id="novi"` `dugme dugme-glavno` `data-fokus`: ikona plus 16, tekst "Novo takmičenje", `<kbd>Alt+N</kbd>` (vodi na `takmicenja/novo`).
- Tabela `id="tabela"` (`.tabela`), kolone i širine: "Naziv i mesto" (ostatak), "Datum" 110 px, "E sudija" 78 px, "Status" 112 px, "Priprema" 330 px, bez naslova 150 px (dugmad).
- Prazna lista: jedan red `colspan 6` klasa `prazno`: "Još nema takmičenja. Kliknite „Novo takmičenje“."
- Red: `tr.klik[data-id][tabindex=-1]` visine 52 px. Ćelije:
  1. Dva reda teksta (kolona flex): naziv (`odseci`, težina 700 ako je aktivno, inače 600) i ispod mesto (`mali sivo odseci`).
  2. `datum_prikaz(datum)` (`17.10.2026.`), klasa `broj`.
  3. `broj_e_sudija`, klasa `broj`.
  4. Status čip: `aktivno` -> `status status-ok` sa ikonom kvačica 13 + "Aktivno"; `zavrseno` -> `status` (neutralan) "Završeno"; `priprema` -> `status status-info` "U pripremi".
  5. Oznake stanja (parcijal `stanje_oznake`, vidi 4.9).
  6. Desno poravnato: link "Izmeni" (`dugme dugme-malo dugme-tekst`, vodi na `takmicenja/izmeni&id`) i `<form class="otvori" method=post action=takmicenja/otvori style="display:inline">` sa skrivenim `id` i dugmetom "Otvori" (`dugme dugme-malo`).
- Ispod tabele (van skrola, `border-top`, 13 px, siv tekst): "Klik na takmičenje ili „Otvori“ postavlja ga kao aktivno i vodi na prvi nezavršen korak pripreme (prijave, rotacije), a kad je sve spremno na pregled takmičenja. Aktivno može biti samo jedno."
- Sortiranje: datum opadajuće, pa id opadajuće. Nema filtera ni pretrage.

### 4.9 Parcijal `stanje_oznake` (oznake pripreme jednog takmičenja; koristi ga i Početna)
Okruženje `span.oznake-stanja`; sadržaj:
- `prijava === 0`: `status status-warn` + ikona upozorenje 13 + "Nema prijava".
- inače: `status` "Prijava: N"; ako `nepotpune > 0`: `status status-bad` + ikona upozorenje + "Nepotpune: N"; ako `nepotvrdjeni_klubovi > 0`: `status status-warn` "Nepotvrđeni klubovi: N"; ako `nerasporedjeni > 0`: `status status-warn` "Neraspoređeni: N"; ako `korak === 'spremno'` i `nepotvrdjeni_klubovi === 0`: `status status-ok` + ikona kvačica + "Spremno".

(`klubovi_stanje` parcijal, tabela stanja po klubu, koristi Pregled takmičenja/Početna, ne ovi ekrani; kolone: Klub, Prijava, Prijave ("Nepotpune: N" ili "Potpune"), Spisak ("Potvrđen", "Nije potvrđen" ili "–"), Rotacije ("Neraspoređeni: N" ili "Raspoređeni").)

### 4.10 Pogled forme (`app/Pogledi/takmicenje_forma.php`), cela strana
- Traka koraka (`koraci`) iznad forme SAMO ako je novo (`!id`) ili je izmena aktivnog takmičenja (`jeAktivno`); parametri `stanje`, `tekuci='podaci'`, `takmId=id`. Izmena neaktivnog takmičenja nema traku.
- `<form id="forma" class="kolona" method=post action=takmicenja/sacuvaj enctype=multipart/form-data>` sa skrivenim `id` (prazno za novo) i skrivenim `broj_e_sudija` (`id="f-sudije"`, vrednost iz forme; popunjava ga JS izbor 1..6).
- Greške: ako ih ima, jedan `div.poruka.poruka-greska[role=alert]` iznad kartica sa jednim `div` po grešci.
- Dve kartice jedna pored druge (`red red-rastegni`, obe `kartica raste`).

**Leva kartica, naslov "Takmičenje"** (desno u zaglavlju, samo kod izmene: "ID {id}", `sivo mali`):
- Naziv: tekst, `name=naziv`, placeholder "npr. Prvenstvo Srbije 2026", `required`, `data-fokus`.
- Red od dva polja: Datum (širina 150 px, `unos broj datum`, `name=datum`, placeholder "dd.mm.gggg.", `required`; prikaz `datum_prikaz` ako je `gggg-mm-dd`, inače sirov unos; blur dopunjava `ddmmgggg` u `dd.mm.gggg.`), Mesto (ostatak, `name=mesto`, placeholder "Grad").
- Broj E sudija: grupa od 6 dugmadi `1..6` (`div.izbor#izbor-sudije`, `role=group`, `aria-label="Broj E sudija"`, `button[type=button][data-n]`, `aria-pressed` za trenutnu vrednost, min širina 40 px); sva `disabled` ako `imaOcena`; pored teksta (`sivo mali`): `imaOcena` ? "Ne može se menjati: takmičenje već ima unete ocene." : "Toliko polja za E ocene ima svaki red pri unosu." (Disabled dugmad ne menjaju skriveno polje, pa se postojeća vrednost šalje nepromenjena.)
- `fieldset` "Pravila" (legenda `oznaka`): podnaslov "Obračun E ocene"; radio `pravilo_e` = `odbaci_krajnje`: "Odbacuju se najviša i najniža" + (siv) "Konačna E ocena je prosek preostalih (sa dve sudije prosek obe, sa jednom njena ocena)"; radio `pravilo_e` = `prosek_svih`: "Prosek svih E ocena". Red: "Ekipno:" "broje se" [tekst polje `name=ekipno_broji`, širina 44 px, centrirano, `inputmode=numeric`, aria-label "Broj ocena koje se broje za ekipu"] "najbolje ocene po spravi". Kućica `pomeraj_redosled` (value 1): "Pomeraj redosled u grupi u svakoj rotaciji".

**Desna kartica, naslov "Zvanični podaci (za bilten i štampu)":**
- "Zaglavlje biltena (prvi red, može biti prazno)": tekst `name=zaglavlje_biltena`, placeholder "npr. Gimnastički savez Srbije".
- "Organizator": tekst `name=organizator`.
- "Domaćin (izaberite klub ili upišite)": tekst `name=domacin`, `list=klubovi-lista`, `autocomplete=off`; `<datalist id=klubovi-lista>` sa `option value = klub.puno_ime` za sve klubove (po `puno_ime`). Čuva se slobodan tekst (puno ime), ne id kluba.
- Dva bloka "Grb levo" / "Grb desno" (jedan uz drugi, flex): ako grb postoji: `<img src=putanja>` visine 36 px (max širina 60 px) + kućica `obrisi_grb_levo` / `obrisi_grb_desno` (value 1) "ukloni"; ispod `input[type=file] name=grb_levo|grb_desno accept=".png,.jpg,.jpeg,.svg,.gif"`.
- Siv tekst: "Bez grba takmičenja koristi se grb iz Podešavanja."
- SAMO kod izmene: kućica `zavrseno` (value 1): "Takmičenje je završeno (arhivirano)".

**Dno forme** (red dugmadi): `dugme dugme-glavno` submit: tekst `id ? 'Sačuvaj' : 'Sačuvaj i pređi na prijave'` + `<kbd>Enter</kbd>`; link `dugme#otkazi` "Otkaži" + `<kbd>Esc</kbd>` (vodi na `takmicenja`); razmak; SAMO kod izmene dugme `dugme-opasno#obrisi` (ikona kanta 16) "Obriši". Kod izmene i skrivena forma `#forma-brisanje` (POST `takmicenja/obrisi`, skriveno `id`).
- Podrazumevane vrednosti nove forme: vidi `prazno()` u odeljku 2 (4 E sudije, pravilo "odbaci_krajnje", ekipno 3, pomeraj isključen). Datum polje je prazno.
- Na grešku forma zadržava unete vrednosti (naziv, mesto, zaglavlje, organizator, domaćin, pravilo, ekipno_broji, pomeraj, zavrseno, sirov datum, broj sudija).

### 4.11 JS
`takmicenja.js` (lista):
- `tabela.addEventListener('keydown', ..., true)` (capture): `Enter` kad je meta unutar `button, a` -> `stopPropagation` (Enter na dugmetu "Otvori" ili linku "Izmeni" radi to dugme, ne otvaranje izabranog reda).
- `App.tabelaNavigacija(tabela, {naOtvori: tr => tr.querySelector('form.otvori').submit()})`: klik na red (osim na `button, a, input, select`) i Enter na izabranom redu = "Otvori" (POST `takmicenja/otvori`). Strelice gore/dole biraju red (klasa `izabran`), nema skrivenih redova.
- `app:novi` (Alt+N) -> `window.location.href = 'index.php?r=takmicenja/novo'`.
- Autofokus je na dugmetu "Novo takmičenje" (`data-fokus`).

`takmicenje-forma.js` (forma):
- Klik u `#izbor-sudije`: na `button` koje nije `disabled` upisuje `data-n` u `#f-sudije` i postavlja `aria-pressed` samo na kliknuto.
- `app:otkazi` (Esc, globalno): ako je fokus u polju (`App.uPolju`) i polje je unutar `#forma` -> idi na `index.php?r=takmicenja`. (Esc van polja ne radi ništa; ne pita za potvrdu, uneto se gubi.)
- Dugme `#obrisi`: `App.potvrdi('Obrisati ovo takmičenje? Moguće je samo ako nema prijava.')` pa submit `#forma-brisanje`.
- Enter u tekstualnom polju šalje formu (podrazumevano ponašanje pregledača). Alt+N na formi ne radi ništa (nema slušaoca).
- HTML5 `required` na Naziv i Datum (pregledač blokira prazno pre slanja).

---

## 5. Traka koraka (`app/Pogledi/koraci.php`)

Parametri: `stanje` (iz `stanjePripreme` ili `null`), `tekuci` (`podaci|prijave|rotacije|pregled`), `takmId` (id ili `null`). Koriste je: forma takmičenja (`podaci`), Prijave i Uvoz (`prijave`), Rotacije, Pregled takmičenja.
- Računanje: `ima = stanje !== null && stanje.prijava > 0`.
- `opisPrijava`: bez prijava "još nema prijava"; inače "prijava: N" + (ako `nepotpune > 0`) " · nepotpune: N" + (ako `nepotvrdjeni_klubovi > 0`) " · nepotvrđeni klubovi: N" (razdvajač je srednja tačka sa razmacima).
- `opisRotacija`: `!ima` -> "posle prijava"; `nerasporedjeni > 0` -> "neraspoređeni: N"; inače "svi su raspoređeni".
- Četiri koraka `[ključ, naslov, opis, link, stanje]`:
  1. `podaci`, "Podaci", opis `takmId ? 'uneti' : 'naziv, datum, pravila'`, link `takmicenja/izmeni&id=takmId` (ili `null` bez `takmId`), stanje `ok` ako ima `takmId`, inače `''`.
  2. `prijave`, "Prijave", `opisPrijava`, link `prijave` (ili `null`), stanje: bez `takmId` `''`; inače `ok` ako `ima && nepotpune === 0 && nepotvrdjeni_klubovi === 0`, inače `fali`.
  3. `rotacije`, "Rotacije", `opisRotacija`, link `rotacije`, stanje: bez `takmId` `''`; `ok` ako `ima && nerasporedjeni === 0`, inače `fali`.
  4. `pregled`, "Pregled takmičenja", opis "unos ocena i rang liste", link `takmicenje`, stanje uvek `''`.
- `<nav class="koraci" aria-label="Koraci pripreme takmičenja">`; svaki korak je `<a>` (ima link) ili `<span>` (nema link). Klase: `korak`, + `tekuci` ako je trenutni, + `ok`/`fali` ako je stanje neprazno, + `iskljucen` ako nema link i nije trenutni. Trenutni dobija `aria-current="step"`.
- Sadržaj koraka: krug `korak-broj broj` (26 px): ako stanje `ok` ikona kvačica 14; inače za `pregled` ikona strelica-desno 14; inače redni broj 1..4. Pored toga `korak-tekst` sa `<b>naslov</b>` i `<span class="mali">opis</span>`.
- Izgled (`app.css`): `.koraci` flex, razmak 8 px; `.korak` flex 1, visina 48 px, padding 0 12 px, ivica 1 px, radijus kartice; `.tekuci` tamna ivica 2 px (inset); `.iskljucen` providna pozadina, siv tekst; `ok` krug zelen (`ok-soft`), `fali` krug narandžast (`warn-soft`), ostalo neutralan; naslov 14 px bold, opis 12-13 px sivo, jedan red sa `ellipsis`.
- Osvežavanje: `App.osveziDelove(['.koraci'])` (Prijave) učita istu stranu fetch-om i zameni samo `.koraci` čvor; greška -> toast `upozorenje` "Prikaz stanja nije osvežen: {poruka}". U Electron/React verziji dovoljno je izračunati stanje iz istog izvora.
- Na formi novog takmičenja (`takmId = null`): korak 1 je trenutni (nije link, jer je `tekuci`), ostali su `iskljucen`.

---

## 6. Ekran Prijave (aktivnog takmičenja)

### 6.1 Rute (`app/Kontroleri/prijave.php`)
- `prijave` (GET, `?pol=M|Z`) i `prijave/dalje` (GET). Obe zovu `trazimAktivno()` (bez aktivnog: flash `upozorenje` "Prvo izaberite aktivno takmičenje." + redirect `takmicenja`).
- `stanje = stanjePripreme(aktivno.id)` se računa na početku.

### 6.2 `dalje` ("Sledeće: Rotacije")
Nikad ne zaustavlja; samo kaže šta fali.
1. `stanje.prijava === 0`: flash `upozorenje` "Još nema prijava. Prvo prijavite takmičare." + redirect `prijave`.
2. Inače skupi `fali[]`: ako `nepotpune > 0` -> "prijave bez kategorije, programa ili sprava: N"; ako `nepotvrdjeni_klubovi > 0` -> "klubovi čiji spisak nije potvrđen: N". Ako `fali` nije prazno: flash `upozorenje` "U prijavama još nije dovršeno: {fali spojeno sa '; '}." (npr. "U prijavama još nije dovršeno: prijave bez kategorije, programa ili sprava: 2; klubovi čiji spisak nije potvrđen: 1.").
3. Uvek redirect na `rotacije`. (Neraspoređeni ne ulaze u ovu poruku.)

### 6.3 Prikaz (`prijave`)
- `pol = get('pol')`; sve osim `M`, `Z`, `''` postaje `''`.
- `prag = lekarski_prag_dana`; `prijave = lista(takm.id, pol === '' ? null : pol)`.
- Za svaku prijavu: `lek = Takmicari::lekarski(lekarski_do, prag, takm.datum)`; `lek_ne_vazi = stanje in (nema, istekao)`. Ako `lek_ne_vazi`, u `upozorenja[]` ide tekst:
  - ima datum: "{Prezime} {Ime}: lekarski važi do {dd.mm.gggg.} i ne važi na dan takmičenja ({dd.mm.gggg. takmičenja})."
  - nema datuma: "{Prezime} {Ime}: nema unet lekarski pregled."
- Pogledu se predaje: `takm`, `pol`, `takmicari = Takmicari::svi()` (SVI takmičari baze, po prezimenu i imenu, sa `klub_skr`), `prijavljeni = array_flip(prijavljeniTakmicari)`, `klubovi = Klubovi::svi()`, `kategorije`, `programi` (`Sifarnici::lista`, po `redosled, id`), `sprave = ['M' => sprave('M'), 'Z' => sprave('Z')]`, `prijave`, `upozorenja`, `ukupno = stanje.prijava` (bez obzira na filter pola), `stanje`, `sledeciIdBroj = Takmicari::sledeciIdBroj()`, JS `prijave.js`.
- `sledeciIdBroj`: najveći ID broj sastavljen samo od cifara + 1, iste dužine (dopuna nulama), podrazumevana dužina 5; ako nema takvih: `00001`. (U testu sa 001..004 i 099 vraća `100`.)

### 6.4 Raspored pogleda (`app/Pogledi/prijave.php`)
Gore traka koraka (`tekuci='prijave'`). Ispod `div#prijave.red.red-rastegni.raste` (`data-takmicenje`, `data-datum`) sa dve kartice.

**Leva kartica "Baza takmičara"** (fiksna širina 248 px, bez skrola kartice):
- Zaglavlje (padding 0 12 px): `<h2>` "Baza takmičara"; dugme `#novi-takmicar` (`dugme dugme-malo`, ikona plus 14, tekst "Novi", `title="Takmičar koga nema u bazi (Alt+N)"`).
- Filteri (padding 10/12, razmak 8 px): pretraga `#pretraga` (ikona lupe; placeholder "Ime, prezime ili ID", aria-label "Pretraga", `autocomplete=off`, `data-fokus` = autofokus na ovom ekranu); red: `select#f-klub` (flex 1; opcije "Svi klubovi" + po klubu `skracenica` sa value = id) i grupa linkova pola `#f-pol` (`.izbor`): "Svi" (`prijave`), "M" (`prijave?pol=M`), "Ž" (`prijave?pol=Z`); aktivan ima klasu `izabrano`. Pol je SERVERSKI filter (puna promena strane), klub i pretraga su klijentski.
- Lista `#baza-lista` (`kartica-skrol`): za svakog takmičara iz `takmicari` (ako je `pol` filter aktivan, preskaču se drugog pola) red `label.baza-red` (visina 44 px) sa `data-tekst = mb_strtolower("prezime ime ime prezime id_broj")`, `data-klub = klub_id ili 0`, `data-pol`; `checkbox value=takmicar.id` (`aria-label` "Prezime Ime"); dvoredni tekst: gore "Prezime Ime" (`odseci`), dole (`mali sivo`) "{godina_rodjenja} · {Ž|M} · {klub_skr ili ''}". Već prijavljeni: klasa `vec` (siv, kursor default), checkbox `checked disabled`, desno ikona kvačica 14 sa `title="Već prijavljen"`. Označeni (neblokirani) red ima pozadinu `--sel`.
- Podnožje (border-top, padding 10/12): levo tekst `#izabrano` "Izabrano: N" (13 px), desno dugme `#dodaj.dugme-glavno` "Prijavi" + `<kbd>Enter</kbd>`.

**Desna kartica** (`raste`, overflow hidden):
- Zaglavlje: `<h2>` = "Prijavljeni" + (pol filter ? " · MSG|ŽSG" : ""). Desno (razmak 10 px): 
  - `select#p-klub` (širina 132 px, visina 32 px, `title="Prikaži prijave jednog kluba"`, aria-label "Klub prijavljenih") SAMO ako `stanje.klubovi` nije prazno: "Svi klubovi" + po klubu iz `stanje.klubovi` (redosled iz stanja, value = id kluba; tekst `skracenica`, a za ključ `0` "bez kluba").
  - čip `#broj-prijava.status` (`data-ukupno`): "{N} prijava" ako je N = 1, inače "{N} prijave" (N = broj prijava u prikazu) + (pol filter ? " · ukupno {ukupno}" : "").
  - ako ima upozorenja: čip `status status-bad` + ikona upozorenje 13 + "{n} upozorenje" (n = 1) ili "{n} upozorenja".
  - dugme `#startni.dugme-malo` "Dodeli startne brojeve".
  - `form#forma-uvoz` (POST `uvoz/fajl`, multipart) sa `label.dugme.dugme-malo` (ikona fascikla 14, tekst "Uvezi iz fajla", `title="Prijava kluba kao Word (.docx) ili Excel (.xlsx) fajl; može više fajlova odjednom"`) koji sadrži skriven `input[type=file] name="fajlovi[]" id="uvoz-fajl" accept=".docx,.xlsx" multiple aria-label="Uvezi prijave iz fajla"`.
- Za svako upozorenje traka iznad tabele: `div[role=alert]`, min visina 36 px, padding 4/16, pozadina `--bad-soft`, crven tekst 13 px bold, ikona upozorenje 16 + tekst upozorenja (po jedna traka po takmičaru).
- Tabela `#tabela-prijave.tabela.tabela-zbijena` (u `kartica-skrol`). Zaglavlje: "St. br." 60 px; "Takmičar" (ostatak); "Kategorija" 108 px; "Program" 112 px; "Sprave" širina = `najviseSprava*30 + (najviseSprava-1)*3 + 16` px, gde je `najviseSprava = max(1, pol filter ? broj sprava tog pola : max(broj muških, broj ženskih sprava))`; "Učešće" 142 px; poslednja kolona bez naslova (brisanje).
- Prazno: red `colspan 7`, `prazno`: "Još nema prijava. Označite takmičare levo i kliknite „Prijavi“."
- Grupisanje po klubu: prijave se grupišu po `(int)(klub_id ?? 0)`; redosled grupa = ključevi `stanje.klubovi` bez `0`, pa `0` (bez kluba) na kraju; unutar kluba ostaje redosled iz `lista` (pol Ž pre M, prezime, ime). Svaka grupa ima red-naslov `tr.klub-red[data-klub]` (`td colspan 7`, visina 44 px, pozadina `--sub`) sa: skraćenica (`skr`, 14 px bold) ili "Bez kluba"; puno ime (`sivo odseci`, samo za pravi klub); čip `status` sa brojem prijava u grupi (u prikazu, uz aktivan filter pola); za pravi klub desno `label.potvrda` (+ `potvrdjeno` ako je potvrđen) sa `checkbox value=klub_id` (`checked` ako potvrđen) i tekstom "Spisak potvrdio klub" (potvrđen: zelena pozadina).
- Red prijave `tr[data-id][data-klub]` visine 50 px (klasa `upozorenje-red` crvenkasta pozadina ako `lek_ne_vazi`):
  1. St. br.: `input.unos.broj.startni-broj` (tekst, 44 px, visina 32, centriran, placeholder "–", `inputmode=numeric`, aria-label "Startni broj"), vrednost = `startni_broj` ili prazno.
  2. Takmičar (title = "Prezime Ime"): gore "Prezime Ime" (`.ime`, bold 600, `odseci`); dole: ako `lek_ne_vazi` crven bold 12 px tekst "Lek. do {dd.mm.gggg.}" ili "Nema lekarskog" (zamenjuje drugi red), inače sivo `mali`: "{klub_skr ili 'bez kluba'} · {godina_rodjenja}" + (bez pol filtera) " · {Ž|M}".
  3. Kategorija: `select.unos.polje[data-polje=kategorija_id]` (92 px, visina 32, aria-label "Kategorija"), prva opcija "–" (value `''`), pa sve kategorije (`naziv`); izabrana trenutna.
  4. Program: isto sa `data-polje=program_id` (96 px, aria-label "Program"), opcije programi.
  5. Sprave: `div.sprave-red` sa po jednim `button.sprava-dugme[data-sprava][aria-pressed][title=naziv sprave]` (30x28 px, tekst = `skracenica`) za SVE sprave pola takmičara (`sprave[p.pol]`, po `redosled`); `aria-pressed=true` ako je sprava u `p.sprave` (crno), inače isprekidana ivica.
  6. Učešće: `div.izbor.izbor-mali.ucesce[role=group][aria-label=Učešće]` sa tri dugmeta `data-ucesce`: `ekipa` "Ekipa" (title/aria-label "Član ekipe"), `pojedinac` "Poj." ("Pojedinac"), `vk` "VK" ("Van konkurencije"); `aria-pressed=true` na `Priprema::ucesce(clan_ekipe, van_konkurencije)` (oba polja = 1 prikazuje se kao VK).
  7. Poslednja kolona (desno, padding 0 6 0 0): `button.dugme.dugme-ikona.obrisi` (ikona kanta 16, `title`/aria-label "Ukloni prijavu").
- Podnožje desne kartice (min visina 52 px, border-top): levo legenda (`sivo mali odseci`, `title` = isti tekst): "Poj. = pojedinac · VK = van konkurencije · " + za svaku spravu prikazanog pola(ova) "{SKR} {naziv malim slovima}" razdvojeno " · " (bez pol filtera ženske sprave pa muške; ključ je skraćenica, pa se iste skraćenice M i Ž spajaju u jednu, poslednja pobeđuje, npr. "PA parter"); desno link `#sledece.dugme-glavno` "Sledeće: Rotacije" + ikona strelica-desno 16 (vodi na `prijave/dalje`).

**Dijalog "Novi takmičar"** (`<dialog#dijalog-takmicar.dijalog aria-labelledby=dijalog-naslov>`, `form#forma-takmicar method=dialog`):
- `<h2>` "Novi takmičar"; siv tekst "Upisuje se u bazu takmičara i odmah prijavljuje na ovo takmičenje."; skriven `div#dijalog-greska.poruka.poruka-greska[role=alert]` za grešku servera.
- Red 1: "Prezime" (`name=prezime`, required), "Ime" (`name=ime`, required).
- Red 2: "ID broj" (110 px, `name=id_broj`, predpopunjeno `sledeciIdBroj`, required, `unos broj`), "Godina rođenja" (110 px, `name=godina_rodjenja`, `inputmode=numeric`, `maxlength=4`, required), "Pol": grupa `#dijalog-pol` sa dva dugmeta: `Ž` (`data-pol=Z`) i `M` (`data-pol=M`); izabran je `Ž` osim kad je aktivan filter `pol=M` (tada `M`).
- Red 3: "Klub" (`select name=klub_id`; opcije "bez kluba" (value `''`) + po klubu "{SKR} · {puno ime}"), "Lekarski važi do" (150 px, `name=lekarski_do`, `unos broj datum`, placeholder "dd.mm.gggg.").
- Akcije: `#dijalog-sacuvaj.dugme-glavno` submit "Sačuvaj i prijavi" + `<kbd>Enter</kbd>`; `#dijalog-otkazi` "Otkaži" + `<kbd>Esc</kbd>`.
- Esc zatvara `<dialog>` (podrazumevano ponašanje `showModal`).

### 6.5 API akcije koje koristi ekran (`app/Kontroleri/api.php`)
Sve su POST sa JSON telom (`index.php?r=api/<akcija>`, zaglavlje `X-CSRF`). Odgovor `{ok:true, ...}` (HTTP 200) ili `{ok:false, greska:"..."}`: HTTP 400 za `RuntimeException` i `InvalidArgumentException` (poruka izuzetka), HTTP 405 "Samo POST." za ne-POST, HTTP 404 "Nepoznata akcija: X", HTTP 500 za druge greške (poruka izuzetka, loguje se). Uvek se radi nad aktivnim takmičenjem (`aktivnoIdIliGreska()`: bez aktivnog 400 "Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja."). Pomoćne: `int(k) = (int)(t[k] ?? 0)`, `str(k) = trim((string)(t[k] ?? ''))`.

| akcija | ulaz | poziv | odgovor |
|---|---|---|---|
| `prijave-dodaj` | `takmicari: int[]` | `dodajVise(aktivno, ids)` | `{ok, dodato, preskoceno[], upozorenja[]}` |
| `prijave-izmeni` | `id`, `polje`, `vrednost` | `izmeniPolje(aktivno, id, polje, t.vrednost ?? null)` | `{ok, prijava: nadji(id)}` (red prijave + `pol, ime, prezime, sprave`) |
| `prijave-sprava` | `id`, `sprava_id`, `radi` (truthy) | `postaviSpravu(aktivno, id, sprava_id, !empty(radi))` | `{ok}` |
| `prijave-obrisi` | `id` | `obrisi(aktivno, id)` | `{ok}` |
| `prijave-ucesce` | `id`, `ucesce` | `postaviUcesce(aktivno, id, ucesce)` | `{ok}` |
| `prijave-potvrda` | `klub_id`, `potvrdjeno` | `potvrdiKlub(aktivno, klub_id, !empty(potvrdjeno))` | `{ok}` |
| `prijave-startni` | (prazno) | `dodeliStartneBrojeve(aktivno)` | `{ok, dodeljeno}` |
| `prijave-novi-takmicar` | `prezime, ime, id_broj, godina_rodjenja, pol, klub_id, lekarski_do` | vidi dole | `{ok, takmicar_id, prijava_id|null, dodato, preskoceno[], upozorenja[]}` |

`prijave-novi-takmicar`: sastavlja `novi = {id_broj: str, ime: str, prezime: str, godina_rodjenja: int, pol: str, klub_id: int ili null (0 -> null), drzavljanstvo: 'Srbija', lekarski_do: datum_parsiraj(str('lekarski_do'))}`. `Takmicari::proveri(novi, null)`; ako ima grešaka: HTTP 400 `{ok:false, greska: greške spojene razmakom}`. Poruke provere takmičara (doslovno): "ID broj je obavezan." / "ID broj {X} već postoji." / "Ime je obavezno." / "Prezime je obavezno." / "Godina rođenja nije ispravna." (van 1900..tekuća godina) / "Izaberite pol." (pol nije M ili Z) / "Klub ne postoji." / "Datum lekarskog nije ispravan (dd.mm.gggg)." (lekarski_do `false`). Prazan `lekarski_do` -> `null`. Zatim `sacuvaj(novi, null)` (`Takmicari::POLJA` filter; `kreirano/izmenjeno`), pa `dodajVise(aktivno, [takmicarId])`, `prijava_id` = id prijave tog takmičara na tom takmičenju ili `null` (kad je lekarski sprečio prijavu: `preskoceno` sadrži "{Prezime Ime} (lekarski ne važi na dan takmičenja)"; takmičar ostaje u bazi). Nije u jednoj transakciji (takmičar ostaje i kad prijava ne uspe).

### 6.6 JS (`prijave.js`) po ponašanju
Levi panel:
- `normalizuj(s)`: mala slova, `č,ć -> c`, `š -> s`, `ž -> z`, `đ -> d`. Filtriranje (`filtriraj`) na `input` pretrage i `change` kluba: red je vidljiv ako je (`q === ''` ili `normalizuj(data-tekst)` sadrži `normalizuj(trim(q))`) I (`f-klub` prazan ili `data-klub` jednak izabranom). Sakriveni redovi dobijaju `.sakriveno`. Pretraga je podniz, ne reč; redosled reči nije bitan jer `data-tekst` sadrži i "prezime ime" i "ime prezime" i ID broj.
- `oznaceni()` = checkbox-ovi koji su `checked` a nisu `disabled`; "Izabrano: N" se osvežava na svaki `change` u listi (i posle Enter auto-izbora).
- Pretraga, Enter: `preventDefault`; ako nema označenih i tačno JEDAN red je vidljiv i nije `vec` -> označi ga; zatim `dodaj()` (dakle Enter u pretrazi sa tačno jednim rezultatom ga prijavljuje; ako ima označenih, prijavljuju se označeni; ako ima više vidljivih a nijedan označen -> toast "Označite bar jednog takmičara." `upozorenje`).
- Pretraga, ArrowDown: fokus na checkbox prvog vidljivog (ne sakrivenog) reda (uključujući već prijavljene, koji su disabled pa ne primaju fokus).
- Lista, keydown na checkbox-u: ArrowDown/ArrowUp fokusira sledeći/prethodni vidljivi (po DOM redosledu, preskače sakrivene) checkbox; Enter -> `dodaj()`. Razmak označava (podrazumevano).
- `dodaj()`: `ids` = vrednosti označenih; prazno -> toast `upozorenje` "Označite bar jednog takmičara."; inače `App.api('prijave-dodaj', {takmicari: ids})`; uspeh: `sessionStorage['prijave-poruka'] = 'Prijavljeno: ' + dodato + '.'` + (ako ima preskočenih) ' Preskočeno: ' + preskoceno.join('; ') + '.'`, pa `window.location.reload()`; posle učitavanja poruka se čita iz `sessionStorage`, briše i prikazuje kao toast `ok`. Greška -> toast `greska` sa porukom. Upozorenja o lekarskom API vraća, ali JS ih ne prikazuje (vide se kao crvene trake i crvenkasti redovi posle reload-a).
- Dugme "Prijavi" (`#dodaj`) i prečica Enter u listi/pretrazi pozivaju `dodaj()`.
Desna tabela:
- Promena `select.polje` (kategorija/program): `prijave-izmeni {id, polje: data-polje, vrednost: select.value}` -> toast `ok` "Sačuvano." + `App.osveziDelove(['.koraci'])`; greška -> toast `greska`.
- Startni broj: na `change` (blur ili Enter) `prijave-izmeni {id, polje:'startni_broj', vrednost}`; uspeh: polje se postavlja na `r.prijava.startni_broj || ''`, skida klasa `greska`, toast "Sačuvano."; greška: klasa `greska` na polju, toast `greska` (npr. "Startni broj 21 već ima Test Ana."), fokus ostaje na polju.
- Enter u polju startnog broja: `preventDefault`, nađi sledeći `tr` (preskače naslove klubova i `.sakriveno` redove, tj. prelazi iz kluba u klub), `blur()` trenutnog (to okida `change` i snimanje), fokus + `select()` u sledećem polju startnog broja (ako ga ima).
- Klik na `.sprava-dugme`: `radi = aria-pressed !== 'true'`; `prijave-sprava {id, sprava_id, radi}`; uspeh: preklopi `aria-pressed`, osveži `.koraci`; greška -> toast `greska` (npr. "Na toj spravi već postoji uneta ocena. Prvo je obrišite u unosu ocena.") i dugme ostaje kako je bilo. Nema toasta "Sačuvano.".
- Klik na dugme učešća: ako je već pritisnuto (`aria-pressed=true`) ne radi ništa; inače `prijave-ucesce {id, ucesce}`; uspeh: pritisnuto samo kliknuto, toast "Sačuvano."; (ne osvežava `.koraci`).
- Klik na `.obrisi`: `App.potvrdi('Ukloniti prijavu za ' + ime + '?')` gde je `ime` tekst iz `.ime` ("Prezime Ime"); `prijave-obrisi {id}`; uspeh: `window.location.reload()` (bez toasta); greška (ocene) -> toast `greska` sa porukom modela.
- Kućica "Spisak potvrdio klub" (`change` na checkbox unutar `.klub-red`): `prijave-potvrda {klub_id: value, potvrdjeno: checked}`; uspeh: preklopi klasu `potvrdjeno` na labeli, toast `ok` "Spisak kluba je potvrđen." ili "Potvrda je uklonjena.", osveži `.koraci`; greška: vrati kućicu (`checked = !checked`) i toast `greska` (npr. "Klub nema prijava na ovom takmičenju.").
- Izbor kluba `#p-klub`: sakriva redove (`tr[data-klub]`, ukupno i naslove) drugih klubova (`.sakriveno`), broji prijave (`tr` sa `data-id`) i menja čip: bez filtera originalni tekst, sa filterom "{n} prijava|prijave · ukupno {data-ukupno}". Izbor se pamti u `sessionStorage['prijave-klub-' + takmicenjeId]` (briše se kad je "Svi klubovi"); pri učitavanju se vraća samo ako opcija postoji (inače se ključ briše). Filter kluba je nezavisan od leve liste.
- "Dodeli startne brojeve" (`#startni`): `prijave-startni {}`; `sessionStorage['prijave-poruka'] = 'Dodeljeno startnih brojeva: N.'` + reload (toast posle reload-a).
- "Uvezi iz fajla": `change` na `#uvoz-fajl` sa bar jednim izabranim fajlom odmah šalje `#forma-uvoz` (POST `uvoz/fajl`); nema dugmeta za potvrdu.
- Novi takmičar: `#novi-takmicar` click i `app:novi` (Alt+N, samo ako dijalog nije otvoren) -> sakrij grešku dijaloga; ako je levi filter kluba izabran, predizbor tog kluba u dijalogu; `showModal()`; fokus na Prezime. `#dijalog-otkazi` zatvara. Dugmad pola preklapaju `aria-pressed`. Submit (`preventDefault`): onemogući `#dijalog-sacuvaj`, `App.api('prijave-novi-takmicar', {prezime, ime, id_broj, godina_rodjenja: parseInt || 0, pol: izabrani data-pol, klub_id: parseInt || 0, lekarski_do: tekst})`. Uspeh: ako `prijava_id` postoji -> `sessionStorage['prijave-poruka'] = '{Prezime} {Ime} je upisan u bazu takmičara i prijavljen. Izaberite sprave i učešće.'` i `sessionStorage['prijave-fokus'] = prijava_id`; inače poruka '{Prezime} {Ime} je upisan u bazu takmičara, ali nije prijavljen: {preskoceno spojeno "; "}.'; zatim `window.location.href = 'index.php?r=prijave'` (bez `pol` filtera). Greška: dugme se ponovo omogući, tekst greške u `#dijalog-greska` (vidi se).
- Posle učitavanja, ako postoji `prijave-fokus`: ključ se briše; red `tr[data-id]` dobija klasu `izabran`, `scrollIntoView({block:'center'})`, fokus na prvo `.sprava-dugme`; ako je red sakriven filterom kluba, filter se resetuje na "Svi klubovi".
- Toast (`App.obavesti`): `ok` 2500 ms, `greska` 6000 ms, gore desno.
- Nema prevlačenja (drag) na ovom ekranu. Nema sortiranja klikom na zaglavlje.
- Nema potvrde za promenu kategorije/programa/sprava/učešća/startnog broja; jedina potvrda je brisanje prijave.
- Globalne prečice relevantne ovde: Alt+N (novi takmičar), Enter (prijavi u levom panelu), Esc (zatvara dijalog), F2/F4 navigacija (globalno).

---

## 7. Ekran Uvoz prijava iz fajla: tok, kontroler, pogled, JS

### 7.1 Rute i sesija (`app/Kontroleri/uvoz.php`)
- Sve rute zovu `trazimAktivno()` (bez aktivnog takmičenja: flash `upozorenje` "Prvo izaberite aktivno takmičenje." + redirect `takmicenja`).
- Stanje uvoza u sesiji: `$_SESSION['uvoz'] = ['takmicenje_id' => int, 'fajlovi' => [pripremljen fajl, ...]]`. Ako `takmicenje_id` nije jednak aktivnom, sesijsko stanje se odbacuje (`unset`). Pripremljeni fajl: struktura iz `Uvoz::pripremiFajl` (odeljak 8.1). Nijedna izbor korisnika (klub/pol/oznake/kućice) se NE čuva u sesiji, samo pripremljeni fajlovi.
- `nazad` = `prijave`, `ovde` = `uvoz`.

| ruta | metoda | ponašanje |
|---|---|---|
| `uvoz` (podrazumevano) | GET | ako nema sesije: flash `info` "Na ekranu Prijave kliknite „Uvezi iz fajla“ i izaberite prijavu kluba (.docx ili .xlsx)." + redirect `prijave`; inače prikaz pregleda |
| `uvoz/fajl` | POST multipart `fajlovi[]` | prijem i priprema |
| `uvoz/ukloni` | POST `i` | izbacuje jedan fajl iz sesije |
| `uvoz/otkazi` | POST | odbacuje sesiju |
| `uvoz/potvrdi` | POST `f[...]` | upis |
Svaka POST akcija kad nije POST (i `ukloni`/`potvrdi` kad nema sesije) preusmerava (`fajl`, `otkazi`, `potvrdi` na `prijave`; `ukloni` na `uvoz`).

### 7.2 `fajl`
- `fajlovi` = dosadašnji fajlovi iz sesije (ako postoje; novi se DODAJU na kraj, to je "Dodaj još fajlova") ili `[]`.
- Ako `$_FILES['fajlovi']` ne postoji ili nema niz `name`: greška "Nijedan fajl nije primljen. Izaberite .docx ili .xlsx fajl.".
- Za svaki primljeni fajl: `ime = basename(name)`; `UPLOAD_ERR_NO_FILE` se preskače; ostala greška: `"{ime}: fajl je prevelik."` (za `UPLOAD_ERR_INI_SIZE`, `UPLOAD_ERR_FORM_SIZE`) ili `"{ime}: fajl nije primljen (greška {kod})."`; ako `!is_uploaded_file(tmp)` tiho se preskače; inače `Uvoz::pripremiFajl(tmp, ime, aktivnoId)`; `RuntimeException` -> greška `"{ime}: {poruka}"` (poruke čitača, odeljak 8.3), ostali fajlovi se i dalje obrađuju. Ekstenzija se NE proverava na serveru (prepoznavanje je po sadržaju zip arhive); klijent ograničava `accept=".docx,.xlsx"`.
- Svaka greška se pojedinačno pušta kao flash `greska`.
- Ako je `fajlovi` prazan (nijedan nije uspeo i nema ranijih): `unset(sesija)` + redirect `prijave` (ostaju samo flash greške). Inače `sesija = {takmicenje_id, fajlovi: array_values(fajlovi)}` + redirect `uvoz` (uz eventualne flash greške za fajlove koji nisu uspeli).

### 7.3 `ukloni`
`i = post_int('i')`; ako postoji `fajlovi[i]`, izbaci ga; reindeksiraj. Ako je lista prazna: `unset(sesija)`, flash `info` "Uvoz je otkazan, ništa nije upisano." + redirect `prijave`. Inače snimi sesiju i redirect `uvoz` (indeksi preostalih fajlova se pomeraju; izbori korisnika u formi su izgubljeni jer je sve ponovo prikazano iz sesije).

### 7.4 `otkazi`
POST: `unset(sesija)`, flash `info` "Uvoz je otkazan, ništa nije upisano."; uvek redirect `prijave`.

### 7.5 `potvrdi`
- `izbor = $_POST['f']` (niz) ili `[]`; `Uvoz::upisi(aktivnoId, sesija.fajlovi, izbor)`.
- `RuntimeException` (greška provere, ništa nije upisano, vidi 8.6): flash `greska` sa porukom + redirect `uvoz` (sesija ostaje; izbori se gube jer se pregled ponovo crta iz sesije).
- Uspeh: `unset(sesija)`; poruke (redom) i redirect na `prijave`:
  1. `"Uvoz završen: prijavljeno {prijavljeno} (novih takmičara {novih}, postojećih {postojecih})."` + (ako `vec > 0`) `" Već prijavljenih: {vec}."`; vrsta `ok` ako je `prijavljeno > 0`, inače `upozorenje`.
  2. Ako `preskoceno` nije prazno: `upozorenje` `"Preskočeno: {stavke spojene sa '; '}."`
  3. Ako `upozorenja` nije prazno: `upozorenje` `"Lekarski ne važi na dan takmičenja: {imena spojena sa ', '}."`

### 7.6 Pregled (GET `uvoz`), šta se predaje pogledu
`takm`, `fajlovi` (iz sesije), `klubovi = Klubovi::svi()`, `kategorije`, `programi` (`Sifarnici::lista`), `stanje = stanjePripreme` (za traku koraka), `lekarskiSprecava = (lekarski_sprecava_prijavu === 'da')`, JS `uvoz.js`.

### 7.7 Pogled (`app/Pogledi/uvoz.php`)
- Traka koraka (`tekuci='prijave'`).
- `form#uvoz.uvoz[method=post action=uvoz/potvrdi data-nazad=prijave]` (kolona sa razmakom). Prvo uvodni pasus (`sek`, bez margine): "Pregled pre upisa: ništa još nije upisano. Zeleno su novi takmičari, žuto oni za koje program misli da već postoje u bazi (izaberite da li je to isti takmičar ili novi), plavo već prijavljeni, crveno redovi koji ne mogu da se uvezu." + ako je `lekarskiSprecava`: " Podešavanje „lekarski sprečava prijavu“ je uključeno: novi takmičari nemaju lekarski pregled, pa će biti upisani u bazu, ali ne i prijavljeni."
- Po jedan odeljak (`section.kartica`) za svaki fajl `fi`; imena polja `f[fi][...]`:
  - Zaglavlje: `<h2>` = ime fajla + čip `status status-info` sa `docx` ili `xlsx` velikim slovima ("DOCX"/"XLSX"). Desno: čip `status[data-brojac=fi]` (popunjava JS, odeljak 7.8) i dugme `dugme dugme-malo` type submit sa `formaction=uvoz/ukloni`, `name=i`, `value=fi`, `formnovalidate`, `title="Izbaci ovaj fajl iz uvoza"`, ikona iks 14 + "Ukloni fajl".
  - Za svaku grešku čitanja/tumačenja (`f.greske`, npr. "U fajlu nema tabele sa kolonama PREZIME i IME." ili "Tabela sa prijavama je prazna."): traka `div[role=alert].uvoz-upozorenje` (narandžasta, ikona upozorenje 16 + tekst).
  - Ako klub nije prepoznat (`klub_id === null` i `klub_tekst !== ''`): traka `uvoz-upozorenje`: "Klub iz fajla „{klub_tekst}“ nije pronađen u bazi klubova. Izaberite klub ispod ili ga prvo dodajte na ekranu Klubovi."
  - Blok podešavanja (`.uvoz-podesavanja`, flex wrap, razmak 10/16 px, dno ivica):
    - "Klub" + (ako `klub_tekst !== ''`) " (u fajlu: {klub_tekst})", `select name=f[fi][klub_id]` (širina 260 px, aria-label "Klub"); opcije: "bez kluba" (value `''`), pa svi klubovi "{SKR} · {puno ime}" (po `puno_ime`); izabran `f.klub_id` (ili "bez kluba" kad je `null`).
    - "Pol takmičara u fajlu": `select.uvoz-pol name=f[fi][pol]` (150 px, aria-label "Pol"); opcije: "izaberite" (`''`), "M · muški" (`M`), "Ž · ženski" (`Z`); izabrano `f.pol` (iz naslova dokumenta, ili ništa).
    - Za svaku oznaku `oi` iz `f.oznake`: `div.polje.uvoz-oznaka` sa oznakom "Oznaka u fajlu: **{oznaka}**" i dva `select`-a (150 px, jedan do drugog): `name=f[fi][oznake][oi][kategorija]` (aria-label "Kategorija za {oznaka}", title "Kategorija") sa prvom opcijom "kategorija: –" (`''`), svim kategorijama (izabrana ona sa `kategorija_id`), i, ako `kategorija_id === null` a `kategorija` tekst nije prazan, dodatna izabrana opcija `value="novo"` "+ nova: {kategorija}"; `name=f[fi][oznake][oi][program]` (title "Program") sa "program: –", svim programima, i opcijom `novo` "+ novi: {program}" po istom pravilu.
  - Tabela redova (samo ako `f.redovi` nije prazan): `table.tabela.tabela-zbijena.uvoz-tabela`. Kolone: kućica "sve" (40 px, `input.uvoz-sve`, aria-label "Uvezi sve iz fajla", title "Uvezi sve"), "#" (40), "Prezime" (150), "Ime" (130), "Rođen" (100), "Oznaka" (80), "Učešće" (100), "Stanje" (140), "Šta se radi" (ostatak).
  - Red `tr.uvoz-red.uvoz-{status}` (boje: `novi` zeleno `ok-soft`; `postoji` i `slican` žuto/narandžasto `warn-soft`; `greska` crveno `bad-soft`; `prijavljen` siv tekst bez pozadine; JS dodaje `uvoz-iskljucen` za odkačen red: bela pozadina, siv tekst, čip na 50% providnosti):
    1. Kućica `input.uvoz-uvezi name=f[fi][redovi][ri][uvezi] value=1 checked` (aria-label "Uvezi {Prezime Ime}") samo ako je `postupak !== 'nista'` (tj. za statuse `novi`, `postoji`, `slican`); za `prijavljen` i `greska` ćelija je prazna.
    2. `rb` (siv), 3. prezime (bold 600), 4. ime, 5. "Rođen": `datum_prikaz(datum)` ako ima pun datum, inače `"{godina}."` ako ima samo godinu, inače "–"; 6. Oznaka: tekst oznake ili "–"; 7. Učešće: "Ekipa" | "Pojedinac" | "Van konkurencije".
    8. Stanje (čip): `novi` -> `status-ok` "Novi"; `postoji` -> `status-warn` "Verovatno postoji"; `slican` -> `status-warn` "Isto ime, druga godina"; `prijavljen` -> `status-info` "Već prijavljen"; `greska` -> `status-bad` "Ne može".
    9. "Šta se radi": za `postoji` i `slican`: `select.uvoz-postupak name=f[fi][redovi][ri][postupak]` (visina 30, max širina 420, aria-label "Postupak za {Prezime Ime}") sa opcijama `postojeci`: "Prijavi postojećeg: {napomena bez početka 'u bazi: ' ili 'u bazi je '}" i `novi`: "Upiši kao novog takmičara"; izabrana opcija = `postupak` iz procene (`postoji` -> postojeci, `slican` -> novi). Za `novi`: skriveno `postupak=novi` + tekst "Upisuje se u bazu takmičara i prijavljuje". Za `prijavljen` i `greska`: samo tekst `ucfirst(napomena)` (greška crveno bold `uvoz-razlog`, prijavljen sivo).
- Podnožje (`div.kartica.uvoz-dno`, sticky na dnu, flex, razmak 10 px): levo `span#uvoz-zbir` (`data-pocetno`); razmak; `label.dugme` "Dodaj još fajlova" (ikona fascikla 16) sa skrivenim `input[type=file].uvoz-jos name=fajlovi[] accept=".docx,.xlsx" multiple form="uvoz-jos"`; `button#uvoz-otkazi.dugme` submit `formaction=uvoz/otkazi formnovalidate` "Otkaži" + `<kbd>Esc</kbd>`; `button#uvoz-potvrdi.dugme-glavno.dugme-veliko` submit "Uvezi prijave" + `<kbd>Ctrl+Enter</kbd>`.
- Posebna skrivena forma `form#uvoz-jos` (POST `uvoz/fajl`, multipart, `hidden`) kojoj pripada input "Dodaj još fajlova".

### 7.8 JS (`uvoz.js`)
- `prebroj()` (poziva se pri učitavanju i posle svakog `change` u formi): za svaki odeljak `section.kartica`: redovi `tr.uvoz-red`; `uvoz-prijavljen` -> `prijavljeni++`; `uvoz-greska` -> `greske++`; ostali: kućica `uvoz-uvezi` označena = izabran; klasa `uvoz-iskljucen` se postavlja kad nije izabran; izabrani se broje u `n`; izabrani red je "novi" ako nema `.uvoz-postupak` (status `novi`) ili je `select.value === 'novi'`, inače "postojeći". Čip odeljka: `"za uvoz: {n}"` + (ako `prijavljeni`) `" · već prijavljeni: {p}"` + (ako `greske`) `" · ne mogu: {g}"` (razdvajač je ` · `). Kućica "sve" je `checked` kad su sve kućice odeljka označene, `indeterminate` kad su neke. Zbir u dnu: ako je ukupno 0: "Nijedan red nije izabran za uvoz." inače `"Za uvoz: {ukupno} (novih takmičara {novih}, postojećih {postojecih})"`. Dugme "Uvezi prijave" je `disabled` kad je ukupno 0.
- `change`: `.uvoz-sve` postavlja sve `.uvoz-uvezi` svog odeljka; `.uvoz-jos` sa izabranim fajlovima odmah šalje `#uvoz-jos` (POST `uvoz/fajl`; nastavlja se ka sesiji, a ZATIM se izbori u pregledu gube); ostali `change` -> `prebroj()`.
- `keydown` (document): `Ctrl+Enter` ili `Meta+Enter` -> `preventDefault` i klik na `#uvoz-potvrdi` ako nije `disabled`.
- `app:otkazi` (Esc): `App.potvrdi('Otkazati uvoz? Ništa neće biti upisano.')`; ako da, klik na `#uvoz-otkazi` (POST `uvoz/otkazi`).
- `submit` forme: ako je pokretač `#uvoz-potvrdi`: pronađi prvi odeljak koji ima `.uvoz-pol` sa praznom vrednošću I bar jedan izabran red koji je "novi" (bez `.uvoz-postupak` ili sa vrednošću `novi`); ako postoji: `preventDefault`, toast `greska` "Izaberite pol takmičara u fajlu: potreban je za nove takmičare.", fokus na taj select; inače onemogući dugme (zaštita od dvostrukog slanja). (Klijentska provera ne uzima u obzir pol iz kolone `pol` u fajlu, server uzima.)
- Dugme "Ukloni fajl" i "Otkaži" imaju `formnovalidate`; kućice i selecti su podrazumevano u istoj formi (zato "Ukloni fajl" šalje i sve izbore, koje kontroler ignoriše).

---

## 8. Unutrašnjost uvoza (`app/Modeli/Uvoz.php`, `app/Uvoz/*`, `app/Jezgro/Zip.php`)

Tok: `Citac::procitaj` (sadržaj fajla -> tabele + tekst) -> `TumacPrijave::protumaci` (tabele -> klub, pol, redovi) -> `Uparivanje` (redovi, klub i stavke naspram baze) -> `Uvoz::pripremiFajl` (pregled, bez upisa) -> posle potvrde `Uvoz::upisi`.

### 8.1 `Uvoz::pripremiFajl(string $putanja, string $imeFajla, int $takmicenjeId): array`
Izlaz: `{ime, vrsta ('docx'|'xlsx'), klub_tekst, klub_id (int|null), pol ('M'|'Z'|null), oznake: [...], redovi: [...], greske: string[]}`.
1. `dok = Citac::procitaj`, `p = TumacPrijave::protumaci(dok)`; `takmicari = Takmicari::svi()` (sa `klub_skr`), `prijavljeni = prijavljeniTakmicari(takmicenje)`, `kategorije`/`programi` = `id, naziv ORDER BY redosled, id`.
2. Za svaki red `r` iz `p.redovi`: `o = Uparivanje::oceni(r, takmicari, prijavljeni, r.pol ?? p.pol)` (pol iz kolone u fajlu ima prednost nad polom iz naslova; pol iz naslova je automatski prepoznat, ne onaj koji korisnik kasnije izabere u pregledu). Ključ duplikata `Uparivanje::kljuc(prezime, ime)`; ako `o.status !== greska`: ako je ključ već viđen u OVOM fajlu -> red postaje `{status: greska, takmicar_id: null, postupak: 'nista', napomena: 'isti takmičar je već u redu ' + rb prvog}`; inače zapamti `rb`. (Duplikat se ne traži između različitih fajlova.)
3. Oznake: ako `r.oznaka !== ''`: oznaka se jednom dodaje u `oznake[]` (ključ = tačan tekst oznake) kao `{oznaka, kategorija, program, kategorija_id: Uparivanje::nadjiStavku(kategorija, kategorije), program_id: Uparivanje::nadjiStavku(program, programi)}`; red dobija `oznaka_i` = indeks u `oznake[]` (ili `null` ako nema oznake).
4. Red u izlazu = `r + o + {oznaka_i}`; dakle polja: `rb, prezime, ime, datum, godina, oznaka, kategorija, program, ucesce, pol, greske, status, takmicar_id, postupak, napomena, oznaka_i`.
5. `klub_id = Uparivanje::nadjiKlub(p.klub, Klubovi::svi())`.

### 8.2 `Citac::procitaj(string $putanja)` (`app/Uvoz/Citac.php`)
- Vrstu bira po SADRŽAJU zip arhive, ne po ekstenziji. `EKSTENZIJE = ['docx','xlsx']` (samo za prikaz/accept).
- `Zip::lista` baca `RuntimeException` (nije zip, oštećen) -> poruka: "Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Skeniran PDF ili slika ne mogu da se uvezu."
- Ako arhiva ima `word/document.xml` -> `Docx::procitaj + {vrsta:'docx'}`; ako ima `xl/workbook.xml` -> `Xlsx::procitaj + {vrsta:'xlsx'}`; inače "Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Stari .doc i .xls prvo sačuvajte kao .docx ili .xlsx."
- Rezultat: `{tabele: string[][][], tekst: string, vrsta}`.

### 8.3 Zip čitač (`app/Jezgro/Zip.php`): šta mora da podrži zamena (npr. `jszip`/`fflate`/`adm-zip` u Node-u)
- Čitanje: centralni direktorijum (EOCD se traži unazad u poslednjih 65536+22 bajta), stavke po imenu; metode **store (0)** i **deflate (8)**; bez zip64, bez enkripcije, bez multi-disk. Druge metode: greška "Nepodrzana metoda kompresije u zipu: N". Poruke: "Fajl nije zip arhiva.", "Ostecen centralni direktorijum zipa.", "U arhivi nema stavke {ime}", "Ostecen zapis u zipu: {ime}", "Ne mogu da raspakujem {ime}", "Ne mogu da otvorim {fajl}".
- Pisanje (`napravi`, koristi samo kopija/testovi): store ili deflate nivo 6 (deflate samo ako je manji), UTF-8 flag. Testovi prave minimalne docx/xlsx upravo ovim.
- Svaka greška zipa u `Citac` postaje ista poruka "Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Skeniran PDF ili slika ne mogu da se uvezu."

### 8.4 `Docx::procitaj` (`app/Uvoz/Docx.php`), izlaz `{tabele, tekst}`
- Čita samo `word/document.xml` (XML sa `LIBXML_NONET|LIBXML_NOENT`, imenski prostor wordprocessingml). Greške: "Fajl nije Word dokument (.docx).", "Word dokument je oštećen (document.xml nije ispravan XML).", "Word dokument nema sadržaj." (nema `w:body`).
- Obilazak tela: `w:tbl` -> nova tabela u `tabele` (redosledom nailaska); `w:p` van tabele -> trim-ovan tekst pasusa (ako nije prazan) ulazi u `tekst` (spojeno `\n`); drugi elementi (npr. `w:sdt` na nivou tela) se rekurzivno obilaze. Ugnježdene tabele (u ćeliji) ulaze kao zasebne tabele (po PHP redosledu izvršavanja ispred roditeljske); nema testa za to.
- Red/ćelija: `w:tr` i `w:tc` se traže i kad su umotani u `w:sdt`, `w:sdtContent`, `w:customXml`, `w:ins` (bez ulaska u ugnježdene tabele). Unutar `w:tc` obrađuju se samo direktna deca: `w:tcPr` (čita se `w:gridSpan/@w:val`, min 1), `w:p` (pasus), `w:tbl` (ugnježdena). Pasus umotan u `w:sdt` UNUTAR ćelije se ne čita.
- Tekst pasusa: spoje se svi `w:t` (iz više `w:r`), `w:tab`, `w:br`, `w:cr` postaju razmak; više razmaka -> jedan (`\s+` -> ` `); pasus se `trim`-uje. Pasusi u ćeliji (neprazni) spajaju se jednim razmakom ("DATUM" + "ROĐENJA" -> "DATUM ROĐENJA").
- `gridSpan = n`: ćelija se ponavlja n puta u redu (isti tekst), da kolone ostanu poravnate. `vMerge` se ne obrađuje (nastavak je prazna ćelija).
- Redovi mogu imati različit broj ćelija; ništa se ne dopunjava.

### 8.5 `Xlsx::procitaj` (`app/Uvoz/Xlsx.php`), izlaz `{tabele, tekst: ''}`
- Svaki radni list je jedna tabela (redosled iz `xl/workbook.xml` preko `xl/_rels/workbook.xml.rels`: `Target` je relativan na `xl/`, ili apsolutan ako počinje `/`; bez rels fajla ili bez rezultata: `xl/worksheets/sheetN.xml` prirodnim redosledom). Skriveni listovi se ne razlikuju. Greške: "Fajl nije Excel radna sveska (.xlsx).", "Excel fajl je oštećen (XML nije ispravan)."
- Deljeni nizovi `xl/sharedStrings.xml`: za svaki `si` spoje se svi `t` (uključuje formatirane delove).
- Datumski stilovi iz `xl/styles.xml`: ugrađeni formati {14-22, 27-36, 45-47, 50-58} su datumski; prilagođeni `numFmt` je datumski ako njegov `formatCode` (posle uklanjanja `[...]` i `"..."` delova) sadrži slovo d, m ili y a ne sadrži `#` ni `0`; stil ćelije = indeks u `cellXfs` (samo `xf` elementi), datumski ako je njegov `numFmtId` datumski.
- Redovi: `r` atribut reda određuje položaj; redovi koji nedostaju u XML-u popunjavaju se praznim nizovima, tako da indeks reda odgovara broju reda u Excelu (red 2 prazan ostaje `[]`). Ćelije: kolona iz `r` ("C7" -> 2; base-26 A..Z, AA...), praznine se dopunjavaju `''`; ćelija bez `r` ide na sledeću poziciju.
- Vrednost ćelije: `t=inlineStr` -> spojeni `t`; nema `v` -> `''`; `t=s` -> deljeni niz po indeksu (nepostojeći -> `''`); `t=b` -> "da"/"ne"; tip `''` ili `n` i numerička vrednost: ako je stil datumski -> `dd.mm.gggg.` iz serijskog broja (1900 sistem; `dana = floor(broj)`, za `dana > 59` oduzmi 1 zbog izmišljenog 29.02.1900; datum = 1.1.1900 + (dana - 1); razlomak sati se odbacuje; npr. 41640 -> `01.01.2014.`), inače ceo broj bez decimala ("2013.0" -> "2013") ili decimalni zapis; ostali tipovi (`str`, `e`...) -> sirov `v`.
- Svaka ćelija se na kraju `trim`-uje i više razmaka svodi na jedan. Spojene ćelije (merge) se NE šire (samo gornja leva ima vrednost). Datum 1904 sistem nije podržan.

### 8.6 `TumacPrijave::protumaci(dokument)` (`app/Uvoz/TumacPrijave.php`), čiste funkcije
Izlaz: `{klub: string, pol: 'M'|'Z'|null, redovi: Red[], greske: string[]}`.
- **Tabela takmičara**: za svaku tabelu redom traži se PRVI red za koji `kolone(red)` vraća zaglavlje; redovi pre njega (npr. tabela "Klub | ...") se preskaču; svi redovi posle zaglavlja su podaci. Svaka tabela može imati svoje zaglavlje; redovi iz svih tabela se nastavljaju (`rb` je 1..N kroz ceo fajl, `rb = count(redovi) + 1`). Ako nijedna tabela nema zaglavlje: greška "U fajlu nema tabele sa kolonama PREZIME i IME."; ako ga ima ali nema nijednog reda: "Tabela sa prijavama je prazna."
- **`normalizuj(s)`** (javno, koristi ga i Uparivanje): `mb_strtolower(trim)`, zamena `č,ć -> c`, `š -> s`, `ž -> z`, `đ -> dj`, `ñ -> n`, `ö -> o`, `ü -> u`, `é -> e`, `á -> a`; svaki niz znakova koji nije `[a-z0-9]` -> jedan razmak; trim. ("  Laudis-Nanaši " -> "laudis nanasi"; "Đorđe" -> "djordje".)
- **Prepoznavanje zaglavlja (`kolone`)**: za svaku neprazno ćeliju (normalizovanu `n`), prvi pogodak po redosledu provere (svaki ključ se postavlja samo jednom, prva kolona koja ga zadovolji):
  1. `ime_prezime` ako `n` počinje sa "ime i prezime" ili "prezime i ime" (`prezime_prvo = 1` ako počinje sa "prezime");
  2. `prezime` ako počinje sa "prezime";
  3. `ime` ako je `n == "ime"` ili počinje sa "ime ";
  4. `kategorija` ako sadrži "kategorija" ili `n == "kat"` ili počinje sa "kat ";
  5. `program` ako počinje sa "program";
  6. `datum` ako sadrži "datum", "rodj" ili "godi" (npr. "Datum rođenja", "Godište");
  7. `ucesce` ako sadrži "funkcija", "ekipa", "ucesce", "uloga" ili "pojedin";
  8. `pol` ako je `n == "pol"`.
  Red je zaglavlje ako ima `ime_prezime` ILI (`prezime` I `ime`); inače `null`. Nepoznate kolone ("#", "R.br.") se ignorišu.
- **Red podataka (`red`)**: vrednost kolone = trim ćelije na indeksu (nedostaje -> `''`).
  - Ime: sa `ime_prezime`: podeli po razmaku; ako ima ≥ 2 reči, POSLEDNJA reč je jedan deo, ostatak drugi: za "Prezime i ime" zaglavlje prezime = ostatak, ime = poslednja; za "Ime i prezime": prezime = poslednja, ime = ostatak (npr. "Ana Marija Kovač" -> prezime "Kovač", ime "Ana Marija"); jedna reč je prezime, ime `''`. Inače iz kolona `prezime` i `ime`.
  - **`lepoIme`**: skupi razmake; ako je ceo tekst VELIKIM ili malim slovima -> `MB_CASE_TITLE` ("NEORČIĆ" -> "Neorčić", "laudis nanaši" -> "Laudis Nanaši"); mešovita veličina slova ostaje netaknuta.
  - Prazan red (prezime i ime prazni) -> preskače se. Ponovljeno zaglavlje (red opet zadovoljava `kolone`) -> preskače se. Red sa ≥ 2 popunjene ćelije koje su SVE iste (spojena ćelija preko cele širine: napomena, naslov grupe) -> preskače se.
  - Greške reda (`greske[]`): "nedostaje prezime" ili "nedostaje ime" (kad je jedno prazno); "datum rođenja nije razumljiv: {sirov tekst ćelije}".
  - `datum`/`godina` iz `datum(c('datum'))`; `oznaka` = ćelija kategorije sa skupljenim razmacima; `kp = kategorijaProgram(oznaka)`; ako postoji kolona `program` sa neprazno vrednošću: `kp.program = mb_strtoupper(trim(ćelija, ' "\'„“”'))` i `oznaka = trim(oznaka + ' ' + ćelija programa)` (npr. kolone "III" + "c" -> oznaka "III c", kategorija "III", program "C"); `ucesce = ucesce(c('ucesce'))`; `pol = polIzTeksta(c('pol'))`.
  - Red: `{rb, prezime, ime, datum (Y-m-d|null), godina (int|null), oznaka, kategorija (string|null), program (string|null), ucesce, pol, greske}`.
- **`datum(string): {datum, godina, greska}`**: trim ` \t.` sa oba kraja i uklanjanje SVIH razmaka; prazno -> `{null, null, false}`; `d{1,2}[./-]d{1,2}[./-]d{2,4}` (sa viškom tačaka na kraju): godina < 100 -> `+2000` ako je `<= tekuća dvocifrena godina`, inače `+1900` ("13.5.14" -> 2014-05-13); `checkdate` -> `{Y-m-d, godina, false}`, neispravan (npr. 31.02.2012) -> `{null, null, true}`; `gggg-m-d` (bez kraja stringa) ako je ispravan datum; samo godina `^\d{4}\.?$` -> `{null, godina, false}`; sve ostalo -> `{null, null, true}`. (Trocifrena godina prolazi kao stvarna godina; nema testa.)
- **`kategorijaProgram(oznaka)`**: zameni navodnike (`„ “ ” " ' ’ ‘`) razmakom i skupi razmake; prazno -> `{null, null}`; regex `^([IVX]+|\d+)\s*\.?\s*(?:kat\w*\.?)?\s*(?:[-–,]\s*)?([A-C])?\s*(?:prog\w*\.?)?$` (slučaj-neosetljiv, unicode): pogodak -> `{kategorija: strtoupper(grupa1), program: strtoupper(grupa2) ili null}`; inače cela oznaka je kategorija, program `null`. Primeri iz testova: `I “B”` -> I/B; `III "A"` -> III/A; `IV` -> IV/null; `2. kat. C program` -> 2/C; `ii - a` -> II/A; `Kadeti` -> Kadeti/null.
- **`ucesce(s)`**: normalizuj; sadrži "van konk" ili `== "vk"` ili počinje "vk " -> `vk`; sadrži "ekip" ili "tim" -> `ekipa`; inače (i prazno) -> `pojedinac`.
- **`polIzTeksta(s)`** (kolona Pol): normalizovano `m` ili počinje "mu" -> `M`; `z`, `f` ili počinje "ze" -> `Z`; inače `null`.
- **`klub`**: prvo tabele: red čije su neprazne ćelije ≥ 2 i čija je prva (normalizovana) jedna od "klub", "naziv kluba", "klub drustvo", "drustvo" -> vraća DRUGU neprazno ćeliju (kod docx spojenih ćelija sa gridSpan ovo može vratiti ponovljen naslov; nema testa). Ako nema: u `tekst` (pasusi van tabela) regex `^\s*(?:naziv\s+)?klub[a]?\s*[:\-–]\s*(.+)$` (višerednom, slučaj-neosetljiv) -> trim prve grupe. Inače `''`.
- **`pol` (dokumenta)**: spoje se `tekst` i sve ćelije svih tabela, normalizuje; `Z` ako se javlja reč `zsg`, `zensk*` ili `devojcic*` (i nema muških); `M` ako `msg`, `musk*` ili `decac*` (i nema ženskih); ako se javljaju oba ili nijedan -> `null`. (Pretražuje se ceo dokument uključujući imena takmičara; rizik lažnog pogotka.)

### 8.7 `Uparivanje` (`app/Uvoz/Uparivanje.php`), čiste funkcije
Statusi: `NOVI='novi'`, `POSTOJI='postoji'`, `SLICAN='slican'`, `PRIJAVLJEN='prijavljen'`, `GRESKA='greska'`.
- **`kljuc(prezime, ime)`** = `normalizuj(prezime) . '|' . normalizuj(ime)`.
- **`kandidati(red, takmicari, pol)`**: takmičar je kandidat ako mu je ključ jednak `kljuc(prezime, ime)` ILI zamenjenom `kljuc(ime, prezime)`. `tezina = (istaGodina ? 2 : 0) + (istiPol ? 1 : 0)`; `istaGodina` je tačno kad je `red.godina === null` ili jednaka `godina_rodjenja`; `istiPol` kad je `pol === null` ili `t.pol === pol`. Sortirano opadajuće po težini (stabilno).
- **`oceni(red, takmicari, prijavljeni, pol)`** -> `{status, takmicar_id, postupak ('postojeci'|'novi'|'nista'), napomena}`, redom:
  1. `red.greske` nije prazno -> `greska`, `takmicar_id null`, `nista`, napomena = greške spojene sa `'; '`.
  2. Nema kandidata: `godina === null` -> `greska` napomena "nema godine rođenja, a takmičara nema u bazi"; inače `novi`, postupak `novi`, napomena `''`.
  3. Najbolji kandidat `k`, `opis = "{prezime} {ime} ({godina_rodjenja}, {klub_skr ili 'bez kluba'})"`. Ako je `k.id` u `prijavljeni` -> `prijavljen`, `takmicar_id = k.id`, `nista`, napomena "već prijavljen: {opis}" (proverava se samo najbolji kandidat).
  4. Ista godina (ili `red.godina === null`) -> `postoji`, postupak `postojeci`, napomena "u bazi: {opis}".
  5. Inače -> `slican`, postupak `novi`, `takmicar_id = k.id`, napomena "u bazi je {opis}, godina se razlikuje".
- **`nadjiKlub(tekst, klubovi)`** (klubovi: `id, puno_ime, skracenica`): `n = normalizuj(tekst)`; prazno -> `null`. Prvi prolaz: klub čija je normalizovana `skracenica == n` (cela vrednost) -> id. Drugi prolaz: `jezgro = jezgroKluba(n)`; za svaki klub `jk = jezgroKluba(normalizuj(puno_ime))`; ako je `jk` ili `jezgro` prazno preskače; `jk === jezgro` -> odmah vraća id; inače prvi klub kod koga jedno jezgro SADRŽI drugo (`str_contains` u oba smera) pamti se kao delimičan i vraća se ako nema potpunog pogotka. Redosled klubova: `Klubovi::svi()` (po `puno_ime`).
- **`jezgroKluba(n)`**: iz `" " + n + " "` redom uklanja reči (zamenom `" reč "` razmakom) iz liste `gd, g d, sd, gk, sgk, kg, ugk, gimnasticki, gimnasticko, sportsko, sportski, drustvo, klub, za, gimnastiku`, pa skupi razmake i trim. (Primer: "G.D.“PARTIZAN –ŽELJEZNIČAR“" -> "g d partizan zeljeznicar" -> "partizan zeljeznicar"; "Sportsko društvo Vojvodina" -> "vojvodina".)
- **`nadjiStavku(oznaka, stavke)`** (stavke: `id, naziv`): `null`/prazno -> `null`; `oblici(x)`: normalizuj, ukloni reči `kategorija|kategorije|kat|program|programi|prog`, skupi razmake; prazno -> `[]`; oblici = `[n]` plus: ako je `n` rimski broj `i..x` (i=1,..,x=10) -> arapski string; ako je `n` ceo broj 1..10 -> rimski (malim slovima). Vraća id PRVE stavke (po redosledu liste) čiji se oblici seku sa oblicima oznake. ("I" nalazi "I kategorija"; "1" nalazi "I kategorija" i obrnuto "II" nalazi "2"; "3. kategorija" nalazi "III"; "kadet" nalazi "Kadet"; "B" nalazi "B program" i "Program B"; ne nalazi: "IV" kad ga nema, "A" kad ga nema.)

### 8.8 `Uvoz::upisi(int $takmicenjeId, array $fajlovi, array $izbor): array`
Ulaz: `fajlovi` = pripremljeni fajlovi iz sesije (ključevi `fi` = redni brojevi); `izbor` = `$_POST['f']`:
`izbor[fi] = {pol: 'M'|'Z'|'', klub_id: id|'', oznake: {oi: {kategorija: id|'novo'|'', program: id|'novo'|''}}, redovi: {ri: {uvezi: '1', postupak: 'postojeci'|'novi'}}}`. Izlaz `{prijavljeno, novih, postojecih, vec, preskoceno: string[], upozorenja: string[]}`.

**Faza 1: provera i razrešenje izbora (nema upisa; greška prekida sve):** za svaki fajl:
- `pol = izbor.pol ?? f.pol ?? ''`.
- `klubId`: ako `izbor` ima ključ `klub_id` -> `(int)` (prazno = 0), inače `f.klub_id ?? 0`. Ako `klubId != 0` a klub ne postoji: `RuntimeException('Klub za fajl ' . f.ime . ' ne postoji.')`. `0` znači bez kluba (`null`).
- Oznake: za svaku oznaku `razresiStavku` za kategoriju i za program (izbor `izbor.oznake[oi].kategorija` ako postoji, inače `f.oznake[oi].kategorija_id`, inače `''`). Rezultat: `''` ili `'0'` -> `null` (bez kategorije/programa); `'novo'` -> `{novo: naziv}` gde je naziv `oznaka.kategorija` (ako je `null` onda `oznaka.oznaka`) odnosno `oznaka.program`, trim, prazno -> `null`; broj -> mora biti `ctype_digit` i postojati u tabeli, inače `RuntimeException('Izabrana stavka ne postoji (kategorije).')` ili `(programi)`; vraća `{id}`.
- Redovi: red se UVOZI samo ako je `izbor.redovi[ri].uvezi` neprazno I status nije `greska` ni `prijavljen` (ostali se tiho preskaču). `postupak = izbor.postupak ?? red.postupak`; ako je `postojeci` a `takmicar_id` je `null` -> `novi`; ako je `novi` i pol reda (`red.pol ?? pol fajla`) nije `M`/`Z` -> `RuntimeException('Izaberite pol (M ili Ž) za fajl ' . f.ime . ': potreban je za nove takmičare.')`; ako postupak nije `postojeci`/`novi` (npr. `nista`) -> preskače se.

**Faza 2: upis (red po red, bez zajedničke transakcije; svaka prijava se čuva odmah):**
- Pomoćna mapa `napravljene` (ključ `vrsta|normalizuj(naziv)` -> id) da ista NOVA kategorija/program iz dva fajla bude jedna. `stavkaId`: `{id}` -> id; `{novo}` -> prvo traži postojeću `nadjiStavku(naziv, SVE stavke tabele)` (bez redosleda), a ako je nema `Sifarnici::dodaj(vrsta, {naziv})` (dobija `redosled = max+1`, naziv je obavezan); `null` -> `null`. Kategorije/programi nove oznake se razrešavaju na početku obrade svakog fajla, pre njegovih redova (dakle se prave i kad nijedan red tog fajla ne bude upisan).
- Za svaki izabrani red:
  - `ime = "{prezime} {ime}"`.
  - `postojeci` -> `tid = takmicar_id`, `nov = false`.
  - `novi` -> ključ `kljuc(prezime, ime)`; ako je takmičar sa tim ključem već upisan u OVOM uvozu (drugi fajl) -> koristi njegov id, `nov = false`. Inače: ako je `godina === null` -> `preskoceno[] = "{ime} (nema godine rođenja)"` i nastavlja; ID broj: prvi put `Takmicari::sledeciIdBroj()`, posle toga `sledeci(idBroj)` (broj na kraju stringa +1, ista dužina, dopuna nulama; bez cifara na kraju dodaje "1"), i dok ID broj postoji u bazi uvećava dalje; novi takmičar `{id_broj, ime, prezime, godina_rodjenja: godina, pol: red.pol ?? pol fajla, klub_id: klub fajla (ili null), drzavljanstvo: 'Srbija', lekarski_do: null}`; `Takmicari::proveri(novi, null)`; ako ima grešaka: `preskoceno[] = "{ime} ({greške spojene razmakom})"` i nastavlja; inače `Takmicari::sacuvaj` i `nov = true`.
  - Kategorija i program reda = razrešeni po `oznaka_i` (ako je `null`: obe `null`).
  - `Prijave::dodajJednu(takmicenje, tid, kat, prog, red.ucesce)`:
    - `dodato` -> `prijavljeno++`, `nov ? novih++ : postojecih++`; ako `lekarski_ne_vazi && !nov` -> `upozorenja[] = ime` (novi takmičari nemaju lekarski, pa ih ne upozorava).
    - `vec` -> `vec++`.
    - ostalo (`preskoceno`, `nema`) -> ako je `nov`, `novih++` (takmičar je ipak upisan u bazu); `preskoceno[] = d.poruka` (npr. "Test Ana (lekarski ne važi na dan takmičenja)").
- Posle: zapis u dnevnik `"Uvoz prijava (takmičenje %d): prijavljeno %d, novih takmičara %d, preskočeno %d"`.
- Prijave dobijaju sve sprave pola takmičara (kao i svaka prijava), učešće iz fajla (ekipa/pojedinac/vk), kategoriju/program iz oznake; klub prijave = klub iz kartona (za nove takmičare klub izabran za fajl; klub postojećeg se ne menja). Potvrda kluba se poništava kao i pri običnoj prijavi (kroz `dodajJednu`).

---

## 9. PHP testovi koje treba portovati (sve tvrdnje koje se tiču ovih ekrana)

Pokretanje: `php testovi\pokreni.php [deo_imena]`; pomoćne `isto(ocekivano, dobijeno, poruka)` (strogo `===`), `tacno(uslov)`, `sadrzi(deo, tekst)`. Testovi baze koriste svežu bazu sa svim migracijama i brišu je na kraju.

### 9.1 Seme baze `tok_seme()` (`testovi/TokTest.php`)
- Klubovi: `k1` "Klub Jedan" (JED), `k2` "Klub Dva" (DVA).
- Takmičarke (prezime "Test", pol Z, godina 2012): Ana (k1, id_broj `001`, lekarski_do `2027-01-01`), Bea (k1, `002`, `2026-01-01`), Ceca (k2, `003`, `2027-01-01`), Dona (k2, `004`, bez lekarskog). Takmičar Marko Test (M, 2011, k1, id_broj `099`, bez lekarskog).
- Šifarnici: kategorija "Kadet" (redosled 1), program "C" (redosled 1); sprave: Ž Preskok (PR, 1), Ž Greda (GR, 2), M Parter (PA, 1).
- Takmičenje "Test kup": datum `2026-10-17`, mesto NS, 4 E sudije, `odbaci_krajnje`, `ekipno_broji` 1.
- Podešavanja po defaultu: `lekarski_prag_dana` 30, `lekarski_sprecava_prijavu` 'ne'.

### 9.2 `test_prijave_tok` (TokTest)
1. `dodajVise(takm, [Ana, Bea, Ceca, Dona, Marko])`: `dodato == 5`; `count(upozorenja) == 3` (Bea istekao, Dona i Marko nema lekarski; svi su ipak prijavljeni).
2. Ponovo `dodajVise([Ana])` -> `dodato == 0` (ista takmičarka dva puta ne).
3. `lista(takm, 'Z')`: 4 reda; `lista[0].sprave == [PR, GR]` (sve sprave pola, u ovom redosledu); `lista[0].kategorija_id == kat`; `lista[0].klub_id == k1` (klub iz kartona); `ana = lista[0].id`, `bea = lista[1].id` (sortirano po prezimenu pa imenu: Ana, Bea).
4. Promena kluba Ane u kartonu na k2 -> `nadji(ana).klub_id` ostaje `k1` (snapshot).
5. `izmeniPolje(takm, ana, 'startni_broj', '21')` i `izmeniPolje(takm, ana, 'clan_ekipe', true)` prolaze. `izmeniPolje(takm, bea, 'startni_broj', '21')` baca poruku koja sadrži "već ima". `izmeniPolje(bea, 'startni_broj', 'x')` baca grešku.
6. `dodeliStartneBrojeve(takm) == 4` (samo onima bez broja); Ana ostaje 21; Bea dobija **24** ("posle dve takmičarke kluba DVA"; redosled Ž pa M, kategorija, skraćenica kluba (DVA pre JED), prezime, ime: Ceca=22, Dona=23, Bea=24); Marko dobija **25** (muški posle ženskih). (Brojač kreće od `MAX(startni_broj)+1 = 22`.)
7. `postaviSpravu(takm, ana, PA /*muška*/, true)` baca grešku (sprava drugog pola). `postaviSpravu(takm, ana, GR, false)` -> `nadji(ana).sprave == [PR]`.
8. `lekarski_sprecava_prijavu = 'da'`; `obrisi(takm, bea)`; `dodajVise([Bea])` -> `dodato == 0`, `count(preskoceno) == 1`.
9. `Takmicari::lekarski`: ('2026-01-01', 30, '2026-10-17') -> `istekao`; ('2026-10-25', 30, '2026-10-17') -> `istice` i `dana == 8`; ('2027-10-25', 30, '2026-10-17') -> `vazi`; (null, 30) -> `nema`.

### 9.3 `test_priprema_potvrde_i_ucesce` (TokTest)
Počinje sa praznim takmičenjem: `stanjePripreme(takm).korak == 'prijave'`. Zatim `dodajVise([Ana, Bea, Ceca])`:
- `prijava == 3`, `nepotpune == 0` (nova prijava ima kategoriju, program i sprave), `nerasporedjeni == 3`, `korak == 'rotacije'`, `nepotvrdjeni_klubovi == 2`, `klubovi[k1].skracenica == 'JED'`, `klubovi[k1].prijava == 2`.
- `potvrdiKlub(k1, true)` i `potvrdiKlub(k2, true)` -> `nepotvrdjeni_klubovi == 0`. `dodajVise([Dona])` (klub k2): `klubovi[k2].potvrdjeno == false` (nova prijava poništava), `klubovi[k1].potvrdjeno == true`.
- `obrisi(prijava Bea)` -> `klubovi[k1].potvrdjeno == false`.
- `potvrdiKlub(takm, 99999, true)` baca grešku (klub bez prijava).
- `izmeniPolje(Ana, 'kategorija_id', '')` -> `nepotpune == 1`, `korak == 'prijave'`; vraćanje kategorije (`$s['kat']`) popravlja.
- Rotacije: grupa 'Z' sa Ana, Ceca, Dona (`Grupe::dodaj`, `premesti(takm, pid, grupa, 0)`) -> `korak == 'spremno'`.
- Učešće: `postaviUcesce(Ana, 'ekipa')` -> `[clan_ekipe, van_konkurencije] == [1,0]`; `'vk'` -> `[0,1]`; `'pojedinac'` -> `[0,0]`; `'x'` baca grešku.
- `Takmicari::sledeciIdBroj() == '100'` (u semenu su 001..004 i 099).

### 9.4 Takmičenja u `test_ocene_unos_ispravka_odustajanje` (TokTest, kraj)
(Takmičenje već ima unete ocene, status `uneto`.)
- `p = nadji(takm)`; `p.broj_e_sudija = 5`; `count(proveri(p, takm)) == 1` (zaključan broj E sudija zbog ocena).
- `proveri(['broj_e_sudija' => 1] + p, null) == []` (1 E sudija je dozvoljen); sa 0 i sa 7: `proveri(...) == ['Broj E sudija mora biti između 1 i 6.']`.
- `p.broj_e_sudija = 4`, `p.domacin = 'GK Partizan'`, `sacuvaj(p, takm)`, `postaviGrb(takm, 'grb_levo', 'grb/test.png')`; `nadji(takm)`: `domacin == 'GK Partizan'`, `grb_levo == 'grb/test.png'`, `grb_desno == ''`.
- `postaviGrb(takm, 'naziv', 'x')` baca `InvalidArgumentException`.
- U istom testu (utiče na Prijave): `postaviSpravu(takm, pid[2], GR, false)` pa unos ocene na toj spravi baca grešku (sprava koju takmičarka ne radi): ocene su van obima Faze 3, ali `postaviSpravu` sa `radi=false` mora da briše nacrt ocenu i da blokira kad postoji `uneto`/`odustao`.
- (`test_rezultati_iz_baze` i testovi grupa/rotacija koriste `dodajVise`/`izmeniPolje` samo kao pripremu; `izmeniPolje(clan_ekipe, true)` i `(van_konkurencije, true)` moraju ostati podržani kao polja.)

### 9.5 `PripremaTest.php` (čiste funkcije)
`test_priprema_ucesce`: `ucesce(0,0)=='pojedinac'`, `(1,0)=='ekipa'`, `(0,1)=='vk'`, `(1,1)=='vk'`; `poljaUcesca('ekipa')==[1,0]`, `'pojedinac'==[0,0]`, `'vk'==[0,1]`; tamo-nazad za sva tri; `poljaUcesca('nesto')` baca `InvalidArgumentException`.
`test_priprema_stanje` (`p(klub, kat=1, prog=1, sprava=4, grupa=true)`):
- `stanje([], [])`: `korak=='prijave'`, `prijava==0`, `klubovi==[]`.
- `stanje([p(1), p(1,null), p(2,1,1,0), p(2,1,null,4,false)], [1])`: `prijava==4`; `nepotpune==3`; `nerasporedjeni==1`; `korak=='prijave'`; `nepotvrdjeni_klubovi==1`; `klubovi[1]==['prijava'=>2,'nepotpune'=>1,'nerasporedjeni'=>0,'potvrdjeno'=>true]`; `klubovi[2]==['prijava'=>2,'nepotpune'=>2,'nerasporedjeni'=>1,'potvrdjeno'=>false]`.
- `stanje([p(1), p(2,1,1,4,false)], [])`: `korak=='rotacije'`, `nepotvrdjeni_klubovi==2`.
- `stanje([p(1), p(2)], [])`: `korak=='spremno'` (nepotvrđen spisak ne zaustavlja).
- `stanje([p(null), p(3)], [3])`: `nepotvrdjeni_klubovi==0`, `klubovi[0].potvrdjeno==false`, `klubovi[0].prijava==1`.
- `stanje([p(4)], [9])['nepotvrdjeni_klubovi']==1` (potvrda kluba bez prijava se ne računa).

### 9.6 `UvozTest.php`
Pomoćni uzorci (prave se u kodu, `Zip::napravi`):
- **`uvoz_docx_primer()`**: pasusi van tabela "I KOLO PGL VOJVODINE MSG A, B i C", "DEFINITIVNA I IMENIČNA PRIJAVA"; tabela 1: `[Klub | G.D.“PARTIZAN –ŽELJEZNIČAR“]`, `[Kontakt osoba | Robert M.]`; tabela 2: zaglavlje `# | PREZIME | IME | KATEGORIJA | (ćelija sa dva pasusa "DATUM" i "ROĐENJA") | FUNKCIJA-EKIPA`; redovi: `1. | Neorčić | "No"+"ah" (dva w:r) | I “B” | 12.02.2017. | pojedinac`; `2. | Herceg | Aron | IV “A” | 25.04.2012.. | ekipa`; `3. | Laudis Nanaši | Dragan | IV “A” | 14.11.2012. | (prazno)`; `4.` sa svim praznim ćelijama; red sa jednom ćelijom "napomena preko dve kolone" (gridSpan 2) + 4 prazne.
- **`uvoz_xlsx_primer()`**: deljeni nizovi `Klub, SD „Vojvodina“, Prezime, Ime, Kategorija, Datum rođenja, Učešće, Petrović, Mina, II A, ekipa`; stilovi: `cellXfs`: 0 (numFmtId 0), 1 (14), 2 (numFmt 164 `dd\.mm\.yyyy\.`); list: red 1 `A1 Klub, B1 SD „Vojvodina“`; red 3 zaglavlje (A3..E3); red 4 `Petrović | Mina | II A | D4 (s=2, broj 41640) | ekipa`; red 5 `inlineStr Jović | inlineStr Lena | (C5 nema) | D5 = 2013 (broj, bez stila)`.

Testovi:
- `test_uvoz_docx_citanje`: 2 tabele; `tekst` sadrži "MSG"; `tabele[0][0] == ['Klub','G.D.“PARTIZAN –ŽELJEZNIČAR“']`; `tabele[1][0] == ['#','PREZIME','IME','KATEGORIJA','DATUM ROĐENJA','FUNKCIJA-EKIPA']`; `tabele[1][1][2] == 'Noah'`; `count(tabele[1][5]) == 6` i `tabele[1][5][0] == tabele[1][5][1]` (gridSpan); `Citac::procitaj(f).vrsta == 'docx'`.
- `test_uvoz_xlsx_citanje`: 1 tabela; `t[0] == ['Klub','SD „Vojvodina“']`; `t[1] == []` (prazan red između); `t[3] == ['Petrović','Mina','II A','01.01.2014.','ekipa']`; `t[4] == ['Jović','Lena','','2013']`; `vrsta == 'xlsx'`.
- `test_uvoz_citac_odbija_tudj_fajl`: fajl `%PDF-1.4 nije zip` -> poruka sadrži "nije Word"; zip bez docx/xlsx stavki (`a.txt`) -> poruka sadrži ".doc i .xls".
- `test_uvoz_tumac_prijave` (nad docx uzorkom): `greske == []`; `klub == 'G.D.“PARTIZAN –ŽELJEZNIČAR“'`; `pol == 'M'`; 3 reda (prazan i napomena preskočeni); red 1: prezime 'Neorčić', ime 'Noah', datum '2017-02-12', godina 2017, oznaka 'I “B”', kategorija 'I', program 'B', ucesce 'pojedinac', greske []; red 2: datum '2012-04-25' (višak tačaka), ucesce 'ekipa', kategorija 'IV', program 'A'; red 3: prezime 'Laudis Nanaši', ucesce 'pojedinac' (prazno), `rb == 3`.
- `test_uvoz_tumac_razne_tabele`: dokument `tekst = "Prijava za ŽSG\nKlub: GK Beograd"`, tabela: zaglavlje `R.br. | Ime i prezime | Godište | Kat. | Program | Pol`; redovi `1 | Ana Marija Kovač | 2014 | III | c | ž`; ponovljeno zaglavlje; `2 | MARKOVIĆ | 13.5.14 | Kadeti | | `; `3 | Lena Jović | nepoznato | 2 | | `. Očekuje: `klub 'GK Beograd'`, `pol 'Z'`, 3 reda; red 1: prezime 'Kovač', ime 'Ana Marija', godina 2014, datum null, kategorija 'III', program 'C', pol 'Z'; red 2: prezime 'Marković', greske `['nedostaje ime']`, datum '2014-05-13', kategorija 'Kadeti', program null; red 3: greske `['datum rođenja nije razumljiv: nepoznato']`, kategorija '2'. Dokument bez zaglavlja (`[['a','b'],['c','d']]`): `greske == ['U fajlu nema tabele sa kolonama PREZIME i IME.']`; samo zaglavlje `[['Prezime','Ime']]`: `greske == ['Tabela sa prijavama je prazna.']`.
- `test_uvoz_tumac_pomocne`: `kategorijaProgram`: `'I “B”' -> I/B`, `'III "A"' -> III/A`, `'IV' -> IV/null`, `'2. kat. C program' -> 2/C`, `'ii - a' -> II/A`, `'Kadeti' -> Kadeti/null`, `'' -> null/null`. `datum`: `' 25. 04. 2012.. '` -> (2012-04-25, 2012, false); `'5/4/2012'` -> 2012-04-05; `'2012-04-25'` -> 2012-04-25; `'2012.'` -> (null, 2012, false); `'31.02.2012'` -> (null, null, true); `''` -> (null, null, false). `ucesce`: 'van konkurencije' -> vk; 'VK' -> vk; 'Ekipa' -> ekipa; 'pojedinac' -> pojedinac. `normalizuj('  Laudis-Nanaši ') == 'laudis nanasi'`; `normalizuj('Đorđe') == 'djordje'`.
- `test_uvoz_uparivanje` (baza: `{1 Lazić Pavle 2011 M PŽS}`, `{2 Lazic Pavle 2015 M VOJ}`, `{3 Jović Lena 2013 Z BGD}`): `oceni(LAZIC pavle 2011, pol M)` -> `postoji`, `takmicar_id 1`, postupak 'postojeci', napomena sadrži "Lazić Pavle (2011, PŽS)"; `oceni(Pavle Lazić 2015, pol null)` (zamenjen redosled) -> id 2, `postoji`; `oceni(Lazić Pavle 2009, M)` -> `slican`, postupak 'novi', `takmicar_id 1`; `oceni(Lazić Pavle null, M)` -> `postoji`; `oceni(Jović Lena 2013, prijavljeni=[3], Z)` -> `prijavljen`, postupak 'nista'; `oceni(Novak Ivan 2012)` -> `novi`, 'novi'; `oceni(Novak Ivan null)` -> `greska`; `oceni(Novak '' 2012, greske ['nedostaje ime'])` -> `greska`, napomena 'nedostaje ime'.
- `test_uvoz_probni_fajlovi`: `testovi/fajlovi/prijava-partizan.docx` (1838 B, 3 stavke u zipu: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml` 12018 B; struktura iz Worda): `greske == []`, `pol 'M'`, klub sadrži "PARTIZAN", **9 redova** ("prazni redovi 10 i 11 se preskaču"), red na indeksu 7 = Herceg / Aron / datum '2012-04-25' / kategorija 'IV' / program 'A' / učešće 'ekipa'. `testovi/fajlovi/prijava-vojvodina.xlsx` (2760 B, 7 stavki: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/sharedStrings.xml`, `xl/styles.xml`, `xl/worksheets/sheet1.xml`): `greske == []`, `pol 'Z'`, klub 'SD „Vojvodina“', **4 reda**, red 0 datum '2014-01-01' (iz Excel broja), red 2 godina 2011 (samo godište), red 3 učešće 'vk' i greske `['nedostaje ime']`. Ova dva fajla treba kopirati u novi projekat kao test fiksture (binarni, ne parsirati ovde).

### 9.7 `UvozUpisTest.php`
- `test_uvoz_klub_i_stavke` (čisto): klubovi `{1 SD „Vojvodina“ VOJ}`, `{5 GD „Partizan-Željezničar“ PŽS}`, `{6 SGK „ES-EM“ ESM}`: `nadjiKlub('G.D.“PARTIZAN –ŽELJEZNIČAR“') == 5`; `('Sportsko društvo Vojvodina') == 1`; `('esm') == 6`; `('GK Beograd') == null`; `('') == null`. Kategorije `{1 Kadet}, {2 I kategorija}, {3 2}, {4 III}`: `nadjiStavku('I')==2`; `('1')==2`; `('II')==3`; `('3. kategorija')==4`; `('kadet')==1`; `('IV')==null`; `(null)==null`. Programi `{7 B program}, {8 Program C}`: `('B')==7`; `('c')==8`; `('A')==null`.
- `test_uvoz_upis_u_bazu` (nad `tok_seme`): dodaje klub 'GD „Partizan-Željezničar“' (PŽS) `klubP`; Marko Test postaje "Neorčić Noah", 2017, klub `klubP`. `pripremiFajl(docx_primer, 'prijava.docx', takm)`:
  - `vrsta 'docx'`, `klub_id == klubP`, `pol 'M'`, 3 reda; red 0 status `postoji` i `takmicar_id == muski`; redovi 1 i 2 status `novi`; `count(oznake) == 2` (I “B” i IV “A”); `oznake[0].kategorija_id == null` (u bazi je samo Kadet), `oznake[0].program_id == null` (samo C); `redovi[0].oznaka_i == 0`, `redovi[1].oznaka_i == 1`.
  - Upis sa izborom `{0: {pol 'M', klub_id klubP, oznake: {0: {kategorija 'novo', program 'novo'}, 1: {kategorija kat(Kadet), program ''}}, redovi: {0: {uvezi 1, postupak postojeci}, 1: {uvezi 1, postupak novi}}}}` (red 2 nije izabran): `prijavljeno 2`, `novih 1`, `postojecih 1`, `preskoceno []`.
  - Nastala kategorija 'I' i program 'B'; Herceg: ime 'Aron', godina 2012, pol 'M', klub `klubP`, `id_broj == '100'`; ne postoji takmičar 'Laudis Nanaši'.
  - `lista(takm, 'M')` ima 2 reda: Neorčić (program = novi 'B', kategorija = nova 'I', `clan_ekipe 0`), Herceg (kategorija = Kadet, program `null`, `clan_ekipe 1`, sprave `[PA]`).
  - Ponovni uvoz istog fajla: redovi 0 i 1 su `prijavljen`; `oznake[0].kategorija_id == id nove kategorije I` (sada prepoznata). `upisi` sa `pol ''` i redom 2 (`novi`) baca grešku koja sadrži "Izaberite pol". `upisi` sa `pol 'M'`, `redovi {0: {uvezi 1}, 2: {uvezi 1, postupak novi}}` -> `prijavljeno 1`, `novih 1` (red 0 je `prijavljen` pa se preskače); `lista(takm,'M')` ima 3 reda.

### 9.8 Šta testovi NE pokrivaju (potrebno dodati nove testove u portu)
Kontroleri/rute, `Takmicenja::obrisi` i `sva`, `Takmicenja::status`, `lekarskiUpozorenja`, `brojevi`, `izmeniPolje` za kategoriju/program (osim '' u TokTest), `postaviSpravu` blokada sa unetom ocenom, `obrisi` prijave sa unetim ocenama, gridSpan/sdt/ugnježdene tabele preko ćelija, xlsx bez rels fajla, `datum` sa 3 cifre godine, duplikat takmičara u istom fajlu (status `greska` sa "isti takmičar je već u redu N"), dva fajla sa istom novom kategorijom, ID broj koji već postoji, `lekarski_sprecava_prijavu = 'da'` u uvozu (preskočen novi takmičar se ipak broji u `novih`).

---

## 10. Napomene za port (mane i neočigledna ponašanja koja treba svesno odlučiti)

1. Aktivno takmičenje je globalno podešavanje; i Takmičenja "Otvori" i sačuvano NOVO takmičenje ga postavljaju. Brisanje aktivnog ga prazni. Izmena (uključujući "završeno") ga ne menja.
2. Klik na red i Enter u listi takmičenja ne otvaraju formu nego aktiviraju (POST `otvori`); formu otvara samo "Izmeni".
3. `Takmicenja::status`: aktivno ima prednost nad "Završeno". Završeno takmičenje se može otvoriti i postaje aktivno.
4. Forma za izmenu ne prikazuje traku koraka za neaktivno takmičenje; checkbox "završeno" postoji samo u izmeni.
5. Nema ograničenja dužine polja u PHP-u (baza prijavljuje grešku). U SQLite ne postoji ograničenje, pa treba odlučiti o maksimumima (150/100/255).
6. `prijave-izmeni` za `startni_broj` je jedinstvenost samo u kodu (nema UNIQUE); `dodeliStartneBrojeve` počinje od `MAX+1`, ne popunjava rupe.
7. Promena polja/sprava/učešća ne poništava potvrdu kluba; samo dodavanje ili brisanje prijave.
8. `dodajVise` ne vraća upozorenja o `vec`/`nema`; UI prikazuje samo "Prijavljeno: N." i preskočene. Upozorenja o lekarskom se vide kroz crvene redove i trake.
9. Prijave: filter pola je serverski (menja i levu listu i desnu tabelu i čip "ukupno"), filter kluba je klijentski; pretraga je klijentska.
10. Upozorenje za lekarski na Prijavama se računa za `nema` i `istekao`; `istice` se ne prikazuje (Početna prikazuje i `istice`).
11. Uvoz: korisnički izbori u pregledu (klub, pol, oznake, kućice, postupci) se gube kad se doda još fajlova, ukloni fajl ili upis ne uspe (pregled se ponovo crta iz pripremljenih podataka). Port može da čuva izbore u stanju ekrana.
12. Pol za poređenje sa bazom u pregledu je onaj automatski prepoznat iz naslova; pol koji zapisničar izabere u pregledu važi samo za upis NOVIH takmičara (osim ako red ima pol iz kolone).
13. Duplikat imena se traži samo unutar jednog fajla; između fajlova ga hvata `noviUpisani` pri upisu (drugi fajl koristi već upisanog takmičara).
14. Novi takmičar iz uvoza nema lekarski pregled; sa `lekarski_sprecava_prijavu = 'da'` biće upisan u bazu ali neće biti prijavljen (poruka u "Preskočeno: ...") a ipak se broji u `novih`.
15. Upis nije atomski: greška u fazi 1 ne upisuje ništa, ali se u fazi 2 svaka prijava čuva odmah (nema rollback). U SQLite verziji razmotriti jednu transakciju.
16. Nove kategorije/programi iz uvoza se prave i kad nijedan red tog fajla ne bude upisan (razrešavaju se na početku obrade fajla).
17. Jezik poruka: sve srpski latinica; tipografski navodnici „ “ u porukama o takmičenju i uvozu; srednja tačka " · " kao razdvajač u čipovima i opisima koraka.
