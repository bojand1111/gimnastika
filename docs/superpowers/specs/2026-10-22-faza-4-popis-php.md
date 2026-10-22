# Faza 4: popis PHP verzije za ekran Rotacije (grupe, redosled po rotaciji)

Izvor: `C:\Users\bojan\Desktop\Takmicarski program` (PHP 8 + MySQL, verzija 1.2.0). Popis je samo čitanje, ništa u PHP projektu nije menjano.
Svi stringovi u navodnicima su doslovni (srpski, latinica sa dijakriticima). Putanje su relativne u odnosu na koren PHP projekta.
Notacija i zajednički helperi (`App.api`, `App.obavesti`, `App.potvrdi`, globalne prečice, `data-fokus`, `aktivnoIdIliGreska`, `trazimAktivno`) su opisani u popisima faze 2 i 3; ovde se ponavljaju samo razlike.

Gde se UI razlikuje od slike `dizajn/slike/07-rotacije.png` i odeljka 07 u `docs/SPECIFIKACIJA.md`, važi `docs/TOK-PRIPREME.md` (odeljak Rotacije) i kod. Razlike: traka ima i dugme "Nova grupa" (na slici je samo kućica pomeranja); zaglavlje grupe ima dugmad olovka (izmena) i kanta (brisanje prazne grupe) i, kad rotacija ima svoj redosled, dugme "Preuzmi redosled iz rotacije 1"; legenda ispod kolona je na slici (hvataljka, Alt+strelice, "Plava oznaka…"), a nova je rečenica "Promena redosleda ovde važi samo za rotaciju {rot}. Sastav grupe je isti u svim rotacijama." i dugme "Završi pripremu"; kartica van konkurencije ima čip "VK".

Fajlovi: `app/Kontroleri/rotacije.php` (71 red), `app/Pogledi/rotacije.php` (67), `public/assets/js/rotacije.js` (172), `app/Modeli/Grupe.php` (294), `app/Kontroleri/api.php` (akcije `grupe-*`, `takmicenje-pomeraj`), `testovi/TokTest.php` (`test_grupe_i_rotacije`, `test_redosled_po_rotaciji`, `test_rotacija_1_ne_menja_ostale`), `migracije/001_pocetna.sql` (`grupe`, `grupa_clanovi`), `migracije/004_redosled_po_rotaciji.sql` (`grupa_redosled`).

---

## 0. Zajedničko

### 0.1 Aktivno takmičenje
Sve rute `rotacije*` zovu `trazimAktivno()`: bez aktivnog takmičenja flash `upozorenje` "Prvo izaberite aktivno takmičenje." + redirect `takmicenja`. API akcije koriste `aktivnoIdIliGreska()` (400 "Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja."). U Electron verziji: isti helper `src/ekrani/aktivno.js` kao Prijave/Uvoz (faza 3), IPC baca `GreskaKorisnika` sa istom porukom.

### 0.2 Pojmovi
- **Grupa** pripada takmičenju i polu (`grupe.pol` = `M`|`Z`). Sastav grupe (`grupa_clanovi`) je isti u svim rotacijama. Jedna prijava je u najviše jednoj grupi (`UNIQUE prijava_id`).
- **Broj rotacija** = broj sprava tog pola (`sprave WHERE pol = ?`), najmanje 1. U rotaciji R grupa je na spravi sa pozicijom `pozicijaURotaciji(pocetna_pozicija, R, brojSprava)` (odeljak 2.1); sprava = `sprave[poz - 1]` po `redosled` (lista `Sifarnici::sprave(pol)`).
- **Osnovni redosled** = `grupa_clanovi.redosled` (redosled rotacije 1). **Ručni redosled** rotacije R = redovi `grupa_redosled` za `(grupa_id, R)`; postoje samo za rotacije u kojima je redosled ručno menjan.
- **Pomeranje** = `takmicenja.pomeraj_redosled` (0/1): u rotaciji R bez ručnog redosleda osnovni redosled se pomera za R−1 mesta (prvi ide na kraj).
- Pravila iz `docs/TOK-PRIPREME.md` (odluka naručioca 01.10.2026): promena redosleda važi samo za rotaciju u kojoj je napravljena; promena u rotaciji 1 prvo "zamrzne" rotacije koje još nemaju svoj redosled (dobijaju upisan redosled koji su do tada imale), pa ostaju kako su bile; grupa koja u izabranoj rotaciji ima svoj redosled ima u zaglavlju dugme "Preuzmi redosled iz rotacije 1" (briše ručni redosled te rotacije), bez tekstualne oznake; ručni redosled ima prednost nad pomeranjem; takmičar dodat u grupu posle toga ide na kraj; ako se u rotaciji 2+ složeni redosled poklopi sa onim koji bi rotacija imala i bez njega, ne pamti se ništa. Unos ocena (faza 5) koristi isti redosled preko `Grupe::grupaNaSpravi`.

---

## 1. Šema baze (već postoji u Electron migracijama 001 i 004, sa kaskadama)

### grupe
`id`, `takmicenje_id` (FK takmicenja ON DELETE CASCADE), `pol` CHAR(1), `naziv` VARCHAR(50), `redosled` INT (podrazumevano 0), `pocetna_pozicija` INT (podrazumevano 1), `kreirano`, `izmenjeno`. Indeks `(takmicenje_id, pol, redosled)`.

### grupa_clanovi
`grupa_id` (FK grupe CASCADE), `prijava_id` (FK prijave CASCADE), `redosled` INT (podrazumevano 0). PK `(grupa_id, prijava_id)`, UNIQUE `prijava_id`.

### grupa_redosled (migracija 004)
`grupa_id` (FK grupe CASCADE), `rotacija` INT, `prijava_id` (FK prijave CASCADE), `redosled` INT (podrazumevano 0). PK `(grupa_id, rotacija, prijava_id)`, indeks `prijava_id`.

Napomena: `grupe.naziv` je u MySQL `utf8mb4_croatian_ci`, ali `dodaj` poredi nazive strogim `in_array` (osetljivo na velika slova); SQLite kolona je `TEXT` bez kolacije, pa je ponašanje isto.

### Kaskade koje ovaj ekran koristi
- Brisanje prijave (ekran Prijave) briše i njen red u `grupa_clanovi` i `grupa_redosled` (test: "brisanje prijave brise i njen rucni redosled"). Electron `PRAGMA foreign_keys = ON` je uključen u `baza.cjs`.
- Brisanje grupe briše `grupa_clanovi` i `grupa_redosled` te grupe (model briše samo praznu grupu, pa je kaskada samo za `grupa_redosled` koji ne može da postoji bez članova; svejedno postoji).
- `Prijave.stanjePripreme` računa `nerasporedjeni` preko `u_grupi` (prijava ima red u `grupa_clanovi`); korak `rotacije` dok ima neraspoređenih (faza 3, `racun/priprema.mjs`).

---

## 2. Model Grupe (`app/Modeli/Grupe.php`)

### 2.1 Čiste funkcije (statičke)
- **`pozicijaURotaciji(pocetna, rotacija, brojSprava)`** → `brojSprava < 1 ? 1 : ((pocetna − 1 + rotacija − 1) mod brojSprava) + 1`. Testovi: `(1,1,4)=1`, `(1,2,4)=2`, `(4,2,4)=1`, `(2,6,4)=3`.
- **`redosledURotaciji(clanovi, rotacija, pomeraj, rucni = null)`** (clanovi po osnovnom redosledu; uz `rucni` svaki mora imati `prijava_id`; `rucni` = niz id-jeva prijava po redu):
  1. Ako `rucni` nije null i nije prazan: `mesto = flip(rucni)`; članovi sa id-jem u `mesto` idu po tom mestu (`ksort`), ostali (dodati kasnije, ili id iz `rucni` koga nema među članovima se preskače) idu na kraj po osnovnom redosledu.
  2. Inače: `n = count(clanovi)`; ako `!pomeraj || n < 2` vraća članove kakvi jesu; inače `k = (rotacija − 1) mod n`, vraća `slice(k) + slice(0, k)`.
  - Testovi: `(['a','b','c'], 3, false) = ['a','b','c']`; `(…, 2, true) = ['b','c','a']`; `(…, 3, true) = ['c','a','b']`; `(…, 4, true) = ['a','b','c']`; sa ručnim: `(c(1,2,3), 2, true, [3,1,2]) = [3,1,2]`; `(c(1,2,3,4), 2, false, [2,9,1]) = [2,1,3,4]` ("nepoznat id se preskace, novi clanovi idu na kraj"); `(c(1,2,3), 2, true, []) = [2,3,1]` ("prazan rucni redosled je isto sto i bez njega").
- **`grupaNaSpravi(grupe, pozicijaSprave, rotacija, brojSprava, pomeraj)`** (koristi faza 5): prva grupa iz `lista()` čija je `pozicijaURotaciji(pocetna_pozicija, rotacija, brojSprava) === pozicijaSprave`; vraća je sa `clanovi` zamenjenim sa `redosledURotaciji(clanovi, rotacija, pomeraj, rucni[rotacija] ?? null)`; inače `null`. Testovi (8.1): nad listom sa grupom A (`pocetna 1`, osnovni redosled `[pid0, pid2]`) i 2 sprave: `grupaNaSpravi(lista, 2, 2, 2, true)` → grupa A sa članovima `[pid2, pid0]`; `grupaNaSpravi(lista, 1, 2, 2, true) === null`. Pažnja: u tom testu rotacija 2 ima ZAMRZNUT ručni redosled (`premesti(pid2, a, 2)` u rotaciji 1 je bio pravi premeštaj unutar iste grupe, pa je rotacija 2 dobila upisan `[pid2, pid0, pid1]`, a odlazak pid1 u grupu B ga je izbacio → `[pid2, pid0]`); pomeranje za jedno mesto bi dalo isti niz, pa test prolazi i bez zamrzavanja. Port mora da zamrzava (8.3 to proverava).

### 2.2 Čitanje
- **`nadji(id)`** → red `grupe` ili `null`.
- **`lista(takmicenjeId, pol)`** → grupe `WHERE takmicenje_id = ? AND pol = ? ORDER BY redosled, id`, svaka sa `clanovi` (2.2 dole) i `rucni` (= `rucniRedosledi(id)`).
- **`rucniRedosledi(grupaId)`** → objekat `{rotacija: [prijava_id, ...]}` iz `grupa_redosled ORDER BY rotacija, redosled, prijava_id`; rotacije bez ručne izmene nisu u njemu (test: `isto([], rucniRedosledi(a))` kad ništa nije menjano; `[2 => [ceca, ana, bea]]` posle izmene u rotaciji 2).
- **`clanovi(grupaId)`** → redovi `gc.redosled, p.id AS prijava_id, p.startni_broj, p.kategorija_id, p.program_id, p.van_konkurencije, t.ime, t.prezime, t.pol, k.skracenica AS klub_skr, kat.naziv AS kategorija, pr.naziv AS program` (LEFT JOIN klubovi, kategorije, programi) `ORDER BY gc.redosled, gc.prijava_id`.
- **`nerasporedjeni(takmicenjeId, pol)`** → ista polja (bez `gc.redosled`) za prijave takmičenja čiji takmičar ima taj pol i `p.id NOT IN (SELECT prijava_id FROM grupa_clanovi)`, `ORDER BY kat.redosled, pr.redosled, k.skracenica, t.prezime, t.ime` (MySQL: NULL prvi; u portu `poredi` sa null-first kao u `prijave.cjs`, pa kolator za skraćenicu/prezime/ime).

### 2.3 Pisanje
- **`dodaj(takmicenjeId, pol)`** → id. `pol` mora biti `M`|`Z` (`RuntimeException('Nepoznat pol.')`). `postojece` = grupe tog takmičenja i pola `ORDER BY redosled`; `n = count`; `brojSprava = max(1, COUNT sprave pola)`; `slovo = 'A' + (n mod 26)`; `naziv = 'Grupa ' + slovo`; ako naziv već postoji među `postojece.naziv`: `'Grupa ' + slovo + i` za `i = 2, 3, …` dok ne bude jedinstven; upis `{takmicenje_id, pol, naziv, redosled: n + 1, pocetna_pozicija: (n mod brojSprava) + 1, kreirano, izmenjeno}`. Testovi: prva "Grupa A", druga "Grupa B" sa `pocetna_pozicija 2` ("druga grupa pocinje na drugoj spravi"; seme ima 2 ženske sprave).
- **`izmeni(takmicenjeId, id, naziv, pocetnaPozicija)`**: grupa mora postojati i pripadati takmičenju (`'Grupa ne postoji.'`); `trim(naziv) === ''` → `'Naziv grupe je obavezan.'`; `brojSprava` pola grupe; `pocetnaPozicija < 1 || > brojSprava` → `'Početna sprava mora biti između 1 i {brojSprava}.'`; `UPDATE grupe SET naziv = trim, pocetna_pozicija, izmenjeno`.
- **`obrisi(takmicenjeId, id)`**: grupa mora postojati i pripadati takmičenju (`'Grupa ne postoji.'`); `n = COUNT grupa_clanovi`; `n > 0` → `'Grupa ima {n} takmičara. Prvo je ispraznite.'`; `DELETE FROM grupe`.
- **`premesti(takmicenjeId, prijavaId, grupaId|null, pozicija, rotacija = 1)`** (`grupaId null` = neraspoređeni; `pozicija` = mesto u PRIKAZU izabrane rotacije, 0 = prvo):
  1. Prijava mora postojati i pripadati takmičenju: `'Prijava ne postoji.'` (čita `p.*` + `t.pol`).
  2. `brojSprava = 1`; ako `grupaId !== null`: grupa mora postojati, pripadati takmičenju i imati isti pol kao takmičar: `'Grupa ne postoji ili nije za taj pol.'`; `brojSprava = max(1, COUNT sprave pola grupe)`; `rotacija < 1 || > brojSprava` → `'Rotacija mora biti između 1 i {brojSprava}.'` (za `grupaId null` rotacija se ne proverava).
  3. `pomeraj` iz `takmicenja.pomeraj_redosled === 1`.
  4. U transakciji:
     - `stara` = `grupa_id` iz `grupa_clanovi` za prijavu (ili null); `istaGrupa = stara !== null && grupaId !== null && stara.grupa_id === grupaId`; `osnovni()` = id-jevi prijava `grupa_clanovi WHERE grupa_id = grupaId ORDER BY redosled, prijava_id`.
     - Ako `!istaGrupa`: `DELETE FROM grupa_clanovi WHERE prijava_id`; `DELETE FROM grupa_redosled WHERE prijava_id` (ručni redosledi stare grupe više ne sadrže ovu prijavu); ako je bila u staroj grupi: `prenumerisi(stara)` (redosled 1..n po postojećem redosledu); ako `grupaId === null`: kraj (odlazak u neraspoređene).
     - **Rotacija 1**: `stari = osnovni()`; `ids = stari bez prijavaId`; umetni `prijavaId` na `clamp(pozicija, 0, count(ids))`; ako `istaGrupa && ids !== stari` (pravi premeštaj unutar iste grupe): za svaku rotaciju `r = 2..brojSprava` koja NEMA red u `grupa_redosled` upiši ceo redosled `redosledURotaciji(stari, r, pomeraj)` kao ručni (zamrzavanje); zatim `DELETE grupa_clanovi WHERE grupa_id` i ponovo upiši `ids` sa `redosled = i + 1`; kraj.
     - **Rotacija 2+**: ako `!istaGrupa`: `INSERT grupa_clanovi (grupaId, prijavaId, redosled = count(osnovni()) + 1)` (nov član ide na kraj osnovnog redosleda); `clanovi = osnovni()` (sada sa prijavom); `rucni` = id-jevi iz `grupa_redosled` za `(grupaId, rotacija)`; `bezRucnog = redosledURotaciji(clanovi, rotacija, pomeraj)` (id-jevi); `ids = redosledURotaciji(clanovi, rotacija, pomeraj, rucni)` bez prijavaId, pa umetni `prijavaId` na `clamp(pozicija)`; `DELETE grupa_redosled WHERE grupa_id AND rotacija`; ako `ids === bezRucnog`: kraj (isto kao bez ručnog: ne pamti se); inače upiši `ids` kao `grupa_redosled` sa `redosled = i + 1`.
- **`vratiRedosled(takmicenjeId, grupaId, rotacija)`**: grupa mora postojati i pripadati takmičenju (`'Grupa ne postoji.'`); `DELETE FROM grupa_redosled WHERE grupa_id AND rotacija`. (Rotacija se ne proverava; brisanje za rotaciju 1 ne radi ništa jer takvih redova nema.)
- **`prenumerisi(grupaId)`** (privatno): `redosled = i + 1` po `ORDER BY redosled`.

### 2.4 Rezime pravila (za testove porta)
- Nov član u rotaciji 1 → ubačen na traženo mesto osnovnog redosleda; u rotaciji 2+ → na kraj osnovnog, na traženo mesto ručnog redosleda te rotacije.
- Premeštaj unutar iste grupe u rotaciji 1 → zamrzni rotacije bez ručnog redosleda (upiši im redosled koji su imale, uz pomeranje ako je uključeno), pa promeni osnovni.
- Premeštaj unutar iste grupe u rotaciji 2+ → pamti se samo za tu rotaciju, a ako je rezultat jednak "bez ručnog" (osnovni uz pomeranje), ručni redosled te rotacije se briše.
- Odlazak iz grupe (u drugu ili u neraspoređene) → briše prijavu iz svih ručnih redosleda stare grupe, prenumeriše osnovni redosled stare grupe.
- Rotacija van opsega → greška; grupa drugog pola → greška.
- Zamrzavanje pri premeštaju u rotaciji 1 upisuje CEO redosled svakoj rotaciji bez reda, i kad je jednak onome što bi pomeranje dalo (tu nema provere "ne pamti se", ona važi samo za premeštaj u rotaciji 2+); zamrznuta rotacija posle toga ne reaguje na promenu kućice pomeranja.
- Premeštaj u rotaciji 1 u DRUGU grupu (`!istaGrupa`) ne zamrzava ništa: u rotacijama bez ručnog redosleda nov član se pojavljuje na svom osnovnom mestu (pomera ostale), u rotacijama sa ručnim redosledom ide na kraj.
- Odlazak iz grupe briše prijavu iz ručnih redosleda stare grupe, ali ne briše ni ne normalizuje preostale ručne redoslede te grupe, čak ni kad su sada jednaki osnovnom; provera "ne pamti se" se radi tek pri sledećem premeštaju u toj rotaciji.

---

## 3. API akcije (`app/Kontroleri/api.php`), sve nad aktivnim takmičenjem

| akcija | ulaz | poziv | odgovor |
|---|---|---|---|
| `grupe-dodaj` | `pol` | `dodaj(aktivno, str('pol'))` | `{ok, grupa: nadji(id)}` |
| `grupe-obrisi` | `id` | `obrisi(aktivno, int('id'))` | `{ok}` |
| `grupe-izmeni` | `id, naziv, pocetna_pozicija` | `izmeni(aktivno, int('id'), str('naziv'), int('pocetna_pozicija'))` | `{ok}` |
| `takmicenje-pomeraj` | `vrednost` (truthy) | `UPDATE takmicenja SET pomeraj_redosled = !empty ? 1 : 0, izmenjeno WHERE id = aktivno` | `{ok}` |
| `grupe-premesti` | `prijava_id, grupa_id (0 = neraspoređeni), pozicija, rotacija` | `premesti(aktivno, int, int('grupa_id') ?: null, int('pozicija'), max(1, int('rotacija')))` | `{ok}` |
| `grupe-redosled-vrati` | `id, rotacija` | `vratiRedosled(aktivno, int('id'), int('rotacija'))` | `{ok}` |

Greške: `RuntimeException` i `InvalidArgumentException` → 400 `{ok:false, greska}` (u portu `GreskaKorisnika`); ostale → 500 sa porukom (u portu opšta greška + dnevnik); nepoznata akcija 404 "Nepoznata akcija: X"; ne-POST 405 "Samo POST.". `str()` radi `trim`, pa `pol` i `naziv` stižu već bez razmaka na krajevima.

---

## 4. Kontroler (`app/Kontroleri/rotacije.php`)

### 4.1 `zavrsi` ("Završi pripremu")
Nikad ne zaustavlja; samo kaže šta fali. `stanje = stanjePripreme(aktivno)`:
1. `stanje.prijava === 0` → flash `upozorenje` "Još nema prijava. Prvo prijavite takmičare." + redirect `prijave`.
2. `stanje.nerasporedjeni > 0` → flash `upozorenje` "Takmičari koji nisu raspoređeni u grupe: {N}. Njih neće biti u unosu ocena dok se ne rasporede."; inače flash `ok` "Priprema je završena: svi prijavljeni su raspoređeni u grupe."
3. Redirect `takmicenje` (Pregled takmičenja; u Electron verziji `#/takmicenje`, ekran faze 7, do tada `Prazno`).

### 4.2 Prikaz (`rotacije`, GET `?pol=&rot=&kp=`)
- `pol = get('pol', 'Z')`; sve osim `M`|`Z` → `Z` (podrazumevano ŽSG).
- `sprave = Sifarnici::sprave(pol)` (po `redosled`); `brojSprava = max(1, count)`; `rot = max(1, min(brojSprava, get_int('rot') ?? 1))`; `filter = get('kp')` = `"{kategorijaId}-{programId}"` ili `''` (samo filter prikaza; `0` za null); `pomeraj = takm.pomeraj_redosled === 1`.
- `grupe = lista(takm.id, pol)`; za svaku: `poz = pozicijaURotaciji(pocetna_pozicija, rot, brojSprava)`; `sprava = sprave[poz − 1] ?? null`; `redosled_rot = redosledURotaciji(clanovi, rot, pomeraj, rucni[rot] ?? null)`; `rucni_rot = isset(rucni[rot])`.
- `kombinacije` = `SELECT DISTINCT kat.id AS kid, kat.naziv AS kat, pr.id AS pid, pr.naziv AS prog FROM prijave p JOIN takmicari t … LEFT JOIN kategorije kat … LEFT JOIN programi pr … WHERE p.takmicenje_id = ? AND t.pol = ? ORDER BY kat.redosled, pr.redosled` (kombinacije koje postoje u prijavama tog pola, uključujući null).
- `nerasporedjeni = nerasporedjeni(takm.id, pol)`; `stanje` (za traku koraka).
- Pogledu: `takm, pol, rot, brojSprava, sprave, filter, kombinacije, pomeraj, grupe, nerasporedjeni, stanje`; `sadrzajKlasa = 'sadrzaj-fiksno'` (kartice skroluju, strana ne).

---

## 5. Pogled (`app/Pogledi/rotacije.php`)

### 5.1 Kartica takmičara (`$kartica(c, broj|null)`)
`li.rot-kartica[draggable=true][tabindex=0][data-prijava][data-kp="{kategorija_id|0}-{program_id|0}"][title="{Prezime} {Ime} · {kategorija ?? ''} · {program ?? ''}"]` + klasa `sakriveno` ako `filter !== '' && filter !== kp`. Sadržaj: `span.hvataljka` (ikona `hvataljka` 16); ako `broj !== null`: `span.rot-broj.broj` = broj; `span.rot-ime` = `"{Prezime} {prvo slovo imena}."` (`mb_substr(ime, 0, 1)`) + ako `van_konkurencije`: ` <span class="status status-vk" style="height:18px;padding:0 4px">VK</span>`; `span.rot-klub.broj` = `klub_skr ?? ''`.

### 5.2 Raspored
1. Traka koraka (`koraci`, `tekuci = 'rotacije'`).
2. `div.kartica#rot-traka` (red, razmak 16, padding 10/12, `flex-shrink 0`; `data-pol`, `data-rot`, `data-broj-sprava`):
   - `div.izbor[role=group][aria-label=Pol]`: linkovi "ŽSG" (`rotacije?pol=Z&rot=1`) i "MSG" (`rotacije?pol=M&rot=1`), aktivan `izabrano`. (Promena pola vraća na rotaciju 1 i briše filter `kp`.)
   - `select.unos#filter-kp[aria-label="Kategorija i program"]` širine 190 px: "Sve kategorije" (`''`) + za svaku kombinaciju `"{kat ?? '–'} · {prog ?? '–'}"` sa `value = "{kid}-{pid}"` (int, null → 0); izabran `filter`.
   - `span.oznaka` "Rotacija" + `div.izbor[role=group][aria-label=Rotacija]` sa linkom po rotaciji `1..brojSprava` (`rotacije?pol=&rot=r&kp=filter`, klasa `broj`, `min-width 40px`, aktivan `izabrano`).
   - razmak (`flex-grow 1`).
   - `label.kucica` sa `input#pomeraj[type=checkbox]` (`checked` ako `pomeraj`) i tekstom "Pomeraj redosled u svakoj rotaciji (prvi ide na kraj)".
   - `button#nova-grupa.dugme` (ikona `plus` 16) "Nova grupa".
3. `div.red.raste#rot-kolone` (`min-height 0; align-items stretch`):
   - `section.kartica.raste.rot-grupa[data-grupa=0]` (`overflow hidden`): `div.rot-zaglavlje` sa redom (`h2.kartica-naslov` "Neraspoređeni" + `span.broj.sivo.rot-brojac` = broj neraspoređenih (13 px, 600)) i redom visine 22 px (`span.mali.sivo` "Prevucite u grupu"); `ul.rot-lista.kartica-skrol` sa karticama bez broja.
   - Za svaku grupu: `section.kartica.raste.rot-grupa[data-grupa=id][data-naziv][data-pocetna]`: `div.rot-zaglavlje` sa redom (`h2.kartica-naslov.rot-naziv[title="Dupli klik za izmenu"]` = naziv; desno `span.rot-brojac` = broj članova, `button.dugme.dugme-ikona.rot-izmeni[aria-label="Izmeni grupu"]` 26x26 ikona `olovka` 14, `button.dugme.dugme-ikona.rot-obrisi[aria-label="Obriši praznu grupu"]` 26x26 ikona `kanta` 14 sa klasom `sakriveno` kad grupa ima članove) i redom visine 22 px (`span.status.status-info` = naziv sprave u izabranoj rotaciji ili "–"; ako `rucni_rot`: `button.dugme.dugme-ikona.rot-vrati` sa `aria-label="Preuzmi redosled iz rotacije 1"` i `title="Preuzmi redosled iz rotacije 1"`, `width 24px; height 22px`, ikona `vracanje` 14); `ul.rot-lista.kartica-skrol` sa karticama `redosled_rot` numerisanim od 1.
4. Podnožje (red, razmak 16, `flex-shrink 0`): `div.sek` (13 px, wrap, razmak 2/18) sa: ikona `hvataljka` 16 + "Prevucite karticu mišem, ili je izaberite pa:"; `<kbd>Alt</kbd><kbd>↑</kbd><kbd>↓</kbd>` "mesto u redosledu"; `<kbd>Alt</kbd><kbd>←</kbd><kbd>→</kbd>` "druga grupa"; "Plava oznaka pokazuje spravu grupe u izabranoj rotaciji."; "Promena redosleda ovde važi samo za rotaciju {rot}. Sastav grupe je isti u svim rotacijama."; desno `a#zavrsi.dugme.dugme-glavno` "Završi pripremu" + ikona `strelica-desno` 16 (vodi na `rotacije/zavrsi`).

### 5.3 CSS (već u `src/stil/app.css` iz faze 0 kopije; proveriti)
`.rot-grupa` (flex kolona, `min-width 0`), `.rot-grupa.rot-cilj` (unutrašnji okvir `--primary` 2 px), `.rot-zaglavlje` (kolona, razmak 4, padding 10/10/8, donja ivica), `.rot-lista` (bez tačaka, padding 8, razmak 4, min visina 60), `.rot-kartica` (36 px, razmak 8, padding 0 8, radijus 8, ivica 1 px `--line`, `cursor: grab`), `:focus-visible` okvir 3 px `--ink`, `.rot-kartica.izabran` (ivica `--ink` + senka 1 px), `.rot-kartica.vuce-se` (opacity .45, isprekidano), `.rot-kartica .hvataljka` (boja `--line-2`), `.rot-broj` (širina 18 px, 13 px, 600, `--muted`), `.rot-ime` (odseci), `.rot-klub` (12 px, 600, `--ink-2`), `.rot-senka` (36 px, isprekidano `--primary` 2 px, pozadina `--primary-soft`). `.status-vk`, `.sakriveno`, `.izbor`, `.kucica`, `.kartica-skrol`, `.dugme-ikona`, `kbd` postoje. PHP i Electron `app.css` imaju identična `.rot-*` pravila (redovi 238 do 250).

---

## 6. JS (`public/assets/js/rotacije.js`) po ponašanju

### 6.1 Pomoćne
`grupe()` = sve `.rot-grupa` po DOM redu (prva je Neraspoređeni, `data-grupa=0`); `lista(grupa)` = njen `ul`; `kartice(grupa)` = njene `.rot-kartica` (uključujući sakrivene filterom!).
- `prenumerisi(grupa)`: `rot-brojac` = broj kartica; u pravoj grupi svaka kartica dobija/ažurira `rot-broj` = indeks + 1, u Neraspoređenima se `rot-broj` uklanja; dugme `rot-obrisi` dobija `sakriveno` ako ima kartica.
- `premesti(li, grupa, prikazaniIndeks)`: `postojece` = kartice ciljne grupe bez `li`; ubaci `li` pre `postojece[prikazaniIndeks]` ili na kraj ako `>= count`; `prenumerisi(stara)` i, ako je druga grupa, `prenumerisi(nova)`; `App.api('grupe-premesti', {prijava_id, grupa_id (0 za Neraspoređene), pozicija: indeks li među karticama nove grupe, rotacija: rot})`; uspeh: ako `rot > 1` → `sessionStorage['rot-izabrana'] = prijava` + `reload` (zaglavlje grupe dobija ili gubi dugme `rot-vrati`), inače `osveziDelove(['.koraci'])`; greška → toast `greska` + `reload` (DOM se vraća na stanje servera; `reload` odmah obriše toast, pa ga korisnik u PHP-u praktično ne vidi; port zadržava toast, jer ponovno učitavanje podataka ne briše poruke). Napomena: `pozicija` se računa među svim karticama (i sakrivenim filterom), što je i indeks u prikazu rotacije.

### 6.2 Prevlačenje (HTML5 drag and drop)
- `dragstart` na kartici: `vuce = li`, `effectAllowed = move`, `setData('text/plain', prijava)`, posle 0 ms klasa `vuce-se`; `senka = li.rot-senka` (nova).
- `dragover` nad `.rot-grupa`: `preventDefault`; `cilj` = kartica pod mišem; ako postoji i nije `vuce` ni `senka`: senka ide pre ili posle cilja prema tome da li je `clientY` u donjoj polovini cilja; ako nema cilja a senka nije u DOM-u ili je u drugoj listi: senka na kraj liste; sve grupe dobijaju/gube klasu `rot-cilj` (samo ciljna je ima).
- `drop`: `preventDefault`; ako nije nad `.rot-grupa` ništa (a `dragover` van kolone ne zove `preventDefault`, pa drop tamo nije ni dozvoljen); inače `idx` = indeks senke među decom `ul` (ili `children.length` ako senka nije tu); `pre` = broj `.rot-kartica` pre `idx` koji nisu `vuce`; ukloni senku; `premesti(vuce, grupa, pre)`. `rot-cilj` skida tek `dragend`. (Grana `cilj !== senka` u `dragover` je mrtav kod: senka nije `.rot-kartica`.)
- `dragend`: skini `vuce-se`, ukloni senku, skini `rot-cilj` svima; `vuce = senka = null`.

### 6.3 Tastatura
- Klik ili `focusin` na kartici → `izaberi(li)`: prethodna gubi `izabran`, ova dobija.
- `keydown` na dokumentu (radi i kad je fokus u polju, čim postoji `izabrana`) kad postoji `izabrana` i `altKey`: `ArrowUp` (i > 0) → `preventDefault` + `premesti(izabrana, grupa, i − 1)`; `ArrowDown` (i < n − 1) → `premesti(…, i + 1)`; `ArrowLeft` (gi > 0) → `premesti(izabrana, g[gi − 1], count kartica te grupe)` (na kraj prethodne kolone, uključujući Neraspoređene); `ArrowRight` (gi < last) → na kraj sledeće kolone; u svim ostalim slučajevima (drugi taster, ili ivica: ↑ na prvom mestu, ← u prvoj koloni, → u poslednjoj) `return` bez `preventDefault` i bez fokusa; posle uspešne grane `izabrana.focus()`. Kartice su `tabindex=0` pa Tab ide po karticama. Indeksi `i` i brojevi kartica računaju i kartice sakrivene filterom `kp`, pa Alt+↓ preko sakrivene kartice može da izgleda kao da ništa nije uradio.
- `premesti` zove API pri svakom drop-u ili strelici i kad se mesto nije promenilo (nema prečice za "isto mesto"); u rotaciji 2+ svaki uspeh, pa i no-op ili odlazak u Neraspoređene, radi `reload`.
- Posle `reload` zbog premeštanja u rotaciji 2+: `sessionStorage['rot-izabrana']` se briše i kartica te prijave dobija fokus (pa i `izabran` preko `focusin`), da Alt+strelice mogu da se nastave. U rotaciji 1 nema `reload`-a, izbor ostaje. Posle "Nova grupa", brisanja, izmene i "vrati" nema vraćanja izbora ni fokusa.

### 6.4 Grupe
- `#nova-grupa` klik: `grupe-dodaj {pol}` → `reload`; greška → toast.
- Klik u koloni (ne Neraspoređeni): na `.rot-obrisi` → `App.potvrdi('Obrisati grupu „{naziv}“?')` → `grupe-obrisi {id}` → `reload`; na `.rot-izmeni` → `izmeniGrupu`; na `.rot-vrati` → `App.potvrdi('Preuzeti redosled iz rotacije 1 za grupu „{naziv}“ u rotaciji {rot}? Sadašnji redosled te rotacije se briše.')` → `grupe-redosled-vrati {id, rotacija: rot}` → `reload`.
- Dupli klik na `.rot-naziv` → `izmeniGrupu`.
- `izmeniGrupu(grupa)`: `window.prompt('Naziv grupe:', naziv)` (null = odustao); `window.prompt('Početna sprava u rotaciji 1 (redni broj sprave, 1 do {brojSprava}):', pocetna)` (null = odustao); `grupe-izmeni {id, naziv, pocetna_pozicija: parseInt}` → `reload`; greška → toast (prazan naziv → "Naziv grupe je obavezan."; `parseInt` NaN → JSON null → `int()` 0 → "Početna sprava mora biti između 1 i N."). (Electron ne podržava `window.prompt`: port koristi mali `<dialog>`, odeljak 10.)

### 6.5 Ostalo
- `#pomeraj` change: `takmicenje-pomeraj {vrednost: checked}` → `reload`; greška → toast.
- `#filter-kp` change: URL dobija `kp = value` (puna promena strane; `rot` i `pol` ostaju).
- Nema toasta "Sačuvano." ni za jednu radnju na ovom ekranu; promene se vide odmah u DOM-u, a server se sinhronizuje u pozadini (greška vraća stranu).

---

## 7. Traka koraka za ovaj ekran
`tekuci = 'rotacije'`; opis koraka Rotacije (`koraci.php`, već portovano u `src/koraciStanje.js`): "posle prijava" kad nema prijava, "neraspoređeni: N" kad `N > 0`, inače "svi su raspoređeni". Korak "Pregled takmičenja" je link kad god postoji aktivno takmičenje (ne samo kad je `korak === 'spremno'`). Posle uspešnog premeštaja u rotaciji 1 `App.osveziDelove(['.koraci'])` (ponovo učita stranu i zameni samo `.koraci`; neuspeh → toast `upozorenje` "Prikaz stanja nije osvežen: {greška}"); u portu: ponovo `stanje`. Napomena: `stanje.nerasporedjeni` broji prijave OBA pola, a kolona "Neraspoređeni" i njen brojač samo izabrani pol; brojevi se mogu razlikovati.

---

## 8. PHP testovi koje treba portovati (`testovi/TokTest.php`)

Seme `tok_seme()` = kao faza 3 (`tests/pomoc/seme.cjs`): klubovi k1/k2, takmičarke Ana/Bea/Ceca/Dona (Ž, 2012), Marko (M), 2 ženske sprave (PR, GR), 1 muška (PA), takmičenje. U testovima `pid` = id-jevi prijava po imenu takmičara (`ORDER BY t.ime`: Ana, Bea, Ceca, Dona).

### 8.1 `test_grupe_i_rotacije`
- Čiste: `pozicijaURotaciji` 4 slučaja i `redosledURotaciji` 4 slučaja (odeljak 2.1).
- `dodajVise(takm, [Ana, Bea, Ceca, Dona])`; `a = dodaj(takm, 'Z')`, `bb = dodaj(takm, 'Z')`: nazivi "Grupa A", "Grupa B"; `nadji(bb).pocetna_pozicija === 2`; `count(nerasporedjeni(takm, 'Z')) === 4`.
- `premesti(pid0, a, 0)`, `premesti(pid1, a, 1)`, `premesti(pid2, a, 0)` → `clanovi(a)` = `[pid2, pid0, pid1]` ("ubacivanje na poziciju"); `premesti(pid2, a, 2)` → `[pid0, pid1, pid2]` ("pomeranje u istoj grupi"); `premesti(pid1, bb, 0)` → `clanovi(a)` = `[pid0, pid2]` sa `redosled` `[1, 2]` ("redosled je prenumerisan"); `premesti(pid1, null, 0)` → `count(nerasporedjeni) === 2`.
- `obrisi(takm, a)` baca ("grupa sa clanovima se ne brise"); `obrisi(takm, bb)` prolazi.
- `lista = lista(takm, 'Z')`; `grupaNaSpravi(lista, 2, 2, 2, true)` → grupa `a` sa članovima `[pid2, pid0]` ("redosled pomeren za jedno mesto"); `grupaNaSpravi(lista, 1, 2, 2, true) === null`.

### 8.2 `test_redosled_po_rotaciji`
- Čiste sa ručnim redosledom (odeljak 2.1, 3 slučaja).
- Prijave 4 takmičarke; `a`, `bb` grupe; `premesti(ana, a, 0)`, `(bea, a, 1)`, `(ceca, a, 2)`. Pomoćna `uRot(grupa, rot, pomeraj=false)` = id-jevi iz `redosledURotaciji(gr.clanovi, rot, pomeraj, gr.rucni[rot] ?? null)` nad `lista()`.
- `premesti(ceca, a, 0, 2)` → `uRot(a, 2) = [ceca, ana, bea]`; `uRot(a, 1) = [ana, bea, ceca]`; `rucniRedosledi(a) = {2: [ceca, ana, bea]}`.
- `premesti(bea, a, 0, 1)` → `uRot(a, 1) = [bea, ana, ceca]`; `uRot(a, 2) = [ceca, ana, bea]`.
- `grupaNaSpravi(lista, 2, 2, 2, false)` → članovi `[ceca, ana, bea]`.
- `premesti(ceca, a, 2, 2)` → `uRot(a, 2) = [ana, bea, ceca]`; `premesti(bea, a, 0, 2)` → `rucniRedosledi(a) = {}` ("redosled jednak osnovnom se ne pamti").
- `premesti(dona, a, 0, 2)` → `uRot(a, 2) = [dona, bea, ana, ceca]`; `uRot(a, 1) = [bea, ana, ceca, dona]`.
- `premesti(ana, bb, 0, 2)` → `uRot(a, 2) = [dona, bea, ceca]`; `uRot(a, 1) = [bea, ceca, dona]`; `uRot(bb, 1) = [ana]`; `uRot(bb, 2) = [ana]`; `COUNT grupa_redosled WHERE prijava_id = ana === 0`.
- `uRot(a, 2, true) = [dona, bea, ceca]` ("rucni redosled ima prednost nad pomeranjem"); `vratiRedosled(takm, a, 2)`; `uRot(a, 2, true) = [ceca, dona, bea]`; `uRot(a, 2) = [bea, ceca, dona]`.
- `premesti(bea, a, 0, 3)` baca ("rotacija 3 ne postoji kad su dve sprave"); `premesti(dona, a, 0, 2)`; `DELETE FROM prijave WHERE id = dona` → `COUNT grupa_redosled WHERE prijava_id = dona === 0` (kaskada).

### 8.3 `test_rotacija_1_ne_menja_ostale`
- Prijave 4; `a`; `premesti(ana, a, 0)`, `(bea, a, 1)`, `(ceca, a, 2)`; `uRot(2) = [ana, bea, ceca]`; `rucniRedosledi(a) = {}` ("slaganje sastava grupe ne pravi svoj redosled rotacije 2").
- `premesti(ceca, a, 0, 1)` → `uRot(1) = [ceca, ana, bea]`; `uRot(2) = [ana, bea, ceca]` ("rotacija 2 je ostala kako je bila").
- `vratiRedosled(takm, a, 2)` → `uRot(2) = [ceca, ana, bea]`.
- `pomeraj_redosled = 1`: `uRot(2, true) = [ana, bea, ceca]`; `premesti(bea, a, 0, 1)` → `uRot(1, true) = [bea, ceca, ana]`; `uRot(2, true) = [ana, bea, ceca]` ("rotacija 2 je ostala kako je bila i uz pomeranje").
- `premesti(dona, a, 0, 1)` → `uRot(1, true) = [dona, bea, ceca, ana]`; `uRot(2, true) = [ana, bea, ceca, dona]`.

### 8.4 Što testovi NE pokrivaju (dodati u portu)
`dodaj` naziv sa brojem kad je slovo zauzeto (grupe A, B, obrisana A: `n = 1` → slovo B zauzeto → "Grupa B2"; sa A, B, C i obrisanom A → "Grupa C2"; "Grupa A2" se dobija tek sa 26 grupa) i `redosled = n + 1` (može da ponovi postojeću vrednost; `ORDER BY redosled, id` drži stabilan redosled; port ne sme MAX+1); `pocetna_pozicija` ciklus po broju sprava (treća grupa uz 2 sprave → 1); `izmeni` poruke (prazan naziv, pozicija van opsega, tuđe takmičenje); `premesti` greške (prijava drugog takmičenja, grupa drugog pola, grupa tuđeg takmičenja); `premesti` sa `pozicija` van opsega (clamp); `nerasporedjeni` redosled (kategorija/program null prvi, pa skraćenica, prezime, ime); `kombinacije` redosled i null kombinacija; `zavrsi` poruke; UI: filter prikaza, drag and drop, Alt+strelice, dijalog izmene grupe.

---

## 9. Pregled takmičenja (`takmicenje`) i ostali korisnici grupa
- `zavrsi` vodi na `takmicenje` (Pregled, faza 7). U fazi 4: `#/takmicenje` prikazuje `Prazno`; `najavi` poruke se prikazuju i tamo (flush na hashchange).
- `koraci` korak "Pregled takmičenja" je link kad god postoji aktivno takmičenje (faza 3); `'spremno'` je samo vrednost `korak` iz `Priprema.stanje` koju ekran Takmičenja koristi za skretanje posle "Otvori".
- Unos ocena (faza 5) koristi `grupaNaSpravi` i isti `redosledURotaciji`; čiste funkcije idu u `electron/racun/grupe.mjs` da ih faza 5 uveze bez baze.
- Početna (faza 7) pokazuje "rotacija u toku" iz ocena, ne iz ovog ekrana.

---

## 10. Napomene za port (odluke)
1. **`window.prompt` ne postoji u Electron-u** (Chromium u Electron-u baca grešku). Izmena grupe ide kroz mali `<dialog>` "Grupa" sa poljima "Naziv grupe" i "Početna sprava u rotaciji 1" (select 1..brojSprava sa nazivima sprava, ili broj kao u PHP-u), dugmad "Sačuvaj" (Enter) i "Otkaži" (Esc), greška modela u dijalogu. Otvara se iz olovke i iz duplog klika na naziv.
2. **`reload` posle svake radnje** (nova grupa, brisanje, izmena, vrati, pomeraj, premeštaj u rotaciji 2+) postaje ponovno učitavanje podataka ekrana (`gim.rotacije.podaci(pol, rot)`), uz zadržavanje izabrane kartice (fokus na istu prijavu) kao `rot-izabrana`.
3. **Optimistično premeštanje**: kao PHP, DOM/React stanje se menja odmah, pa ide IPC; greška → toast + ponovno učitavanje. U React-u: lokalno stanje `grupe` + `nerasporedjeni` se menja odmah (čista funkcija `premestiLokalno`), a posle odgovora u rotaciji 2+ se ponovo učitava (zbog `rot-vrati` dugmeta i mogućeg "ne pamti se" slučaja); u rotaciji 1 samo `stanje` za Koraci.
4. **Drag and drop** ostaje HTML5 (`draggable`, `dragover/drop`) kao u PHP-u (radi u Chromium-u); senka kao element u listi; `rot-cilj` na ciljnoj koloni.
5. **Filter `kp`** je samo klasa `sakriveno` na karticama; `pozicija` se računa među SVIM karticama grupe (i sakrivenim), isto kao PHP. Filter, pol i rotacija žive u hash-u (`#/rotacije?pol=Z&rot=2&kp=1-2`) da link-ovi iz trake koraka i osvežavanje rade isto kao u PHP-u.
6. **`takmicenje-pomeraj`** ide kao IPC `takmicenja.pomeraj(vrednost)` nad aktivnim (model `takmicenja.cjs` dobija `postaviPomeraj(id, vrednost)`); forma takmičenja ima istu kućicu (faza 3) pa oba mesta menjaju isto polje.
7. **Poruke** `zavrsi` idu kroz `najavi` (flush na hashchange, 6 s), kao `otvori` u fazi 3.
8. `nerasporedjeni` sortiranje: MySQL `ORDER BY kat.redosled, pr.redosled, k.skracenica, t.prezime, t.ime` sa NULL prvim; u SQLite NULL je takođe prvi u ASC, ali tekstualne kolone se sortiraju binarno: port sortira u JS (`poredi` null-first po `redosled`, pa `KOLATOR` za skraćenicu, prezime, ime) kao u `prijave.cjs`.
9. Ikone `hvataljka`, `olovka`, `kanta`, `vracanje`, `plus`, `strelica-desno` postoje u `src/ikone`.
10. Naziv grupe nema ograničenje dužine u proveri (kolona 50 znakova u MySQL; SQLite ne seče): kao faza 3, bez provere dužine.
