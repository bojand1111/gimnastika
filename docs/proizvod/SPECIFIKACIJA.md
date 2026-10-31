# Gimnastika: vođenje takmičenja. Specifikacija

Ovaj dokument opisuje šta aplikacija radi. Kako izgleda, vidi se u folderu `dizajn/` (slike i HTML svakog ekrana) i u `docs/VIZUELNI-SISTEM.md`. Ako se tekst i dizajn ne slažu, važi dizajn za izgled, a ovaj dokument za ponašanje i pravila.

## 1. Šta pravimo i za koga

Desktop web aplikacija za vođenje takmičenja u sportskoj gimnastici (muška MSG i ženska ŽSG).

- **MSG i ŽSG su dva odvojena dela jedne aplikacije.** Pol se bira jednom, prekidačem **MSG | ŽSG** na vrhu bočnog menija (Alt+M i Alt+Z), i svaki ekran prikazuje samo izabrani deo. Nijedan ekran nema svoj izbor ili filter pola, osim ispravke pola u kartonu takmičara.

- Radi na **jednom laptopu u sali**, bez interneta. Ekran je 1366x768 ili veći.
- Koristi je **jedna osoba, zapisničar**, koji tokom takmičenja prepisuje ocene sa papirnih sudijskih listića. Nema prijave korisnika ni uloga.
- **Brzina unosa sa tastature je najvažnija stvar.** Tab i Enter kroz polja, bez nepotrebnog klikanja.
- Ceo interfejs je na srpskom, latinicom. Decimalni zarez (13,050), datumi u obliku `17.10.2026.`
- Podaci ne smeju da se izgube: čuvanje odmah pri unosu, rezervne kopije, ažuriranja koja ne diraju unete podatke.

Kasnije (nije deo ovog posla, ali treba imati u vidu pri modelu podataka): rezultati uživo na sajtu i unos sa tableta za sudije.

## 2. Tehnologija i okvir

- **PHP 8.1+ i MariaDB/MySQL iz XAMPP-a za Windows**, Apache iz XAMPP-a.
- **Bez frameworka i bez spoljnih zavisnosti u radu** (nema Composer paketa, nema npm-a, nema build koraka). Mali sopstveni ruter, PDO sa pripremljenim upitima, PHP šabloni za HTML.
- **Frontend:** serverski renderovan HTML, čist CSS i čist JavaScript. JavaScript samo tamo gde donosi brzinu: unos ocena, prevlačenje u rotacijama, izmene u tabeli bez osvežavanja.
- **Bez interneta:** nijedan CDN, nijedan spoljni URL. Font Manrope je u `dizajn/fonts/` i kopira se u aplikaciju.
- **Browser:** Chrome ili Edge. Ne treba podrška za telefone.
- **Kodiranje:** UTF-8 svuda, baza `utf8mb4`. Za kolone sa imenima koristiti kolaciju `utf8mb4_croatian_ci` da sortiranje poštuje č, ć, đ, š, ž.
- **Ocene se računaju u celim brojevima (hiljaditi delovi)**, nikad u float tipu. U bazi `DECIMAL(6,3)`.
- Konfiguracija baze u `config/config.php`, koji se pravi pri instalaciji iz `config/config.example.php` i koji zakrpe nikad ne prepisuju.

Predlog strukture (može se prilagoditi, ali pravila iznad ostaju):

```
public/            index.php (jedina ulazna tačka), assets/ (css, js, fonts, ikone)
app/               ruter, kontroleri, modeli, pogledi (šabloni)
app/Racun/         čiste funkcije za računanje ocena i plasmana (bez baze, lako za test)
migracije/         001_pocetna.sql, 002_....sql (numerisano, samo dodavanje)
testovi/           pokreni.php (običan PHP, bez PHPUnit-a)
alati/             napravi-zakrpu.php, primer-podaci.php
config/            config.example.php
kopije/            podrazumevana fascikla za rezervne kopije (van public/)
VERZIJA            jedan red, npr. 1.0.0
```

## 3. Model podataka

Nazivi tabela i kolona su predlog. Važno je šta se čuva i kako je povezano.

**klubovi**: `id`, `puno_ime`, `skracenica` (jedinstvena, 2 do 4 slova), `grad`.

**takmicari** (trajni karton): `id`, `id_broj` (jedinstven, unosi ga korisnik, npr. `00203`), `ime`, `prezime`, `godina_rodjenja`, `pol` (M/Ž), `klub_id`, `drzavljanstvo`, `lekarski_do` (datum). Opciono: `broj_licence`, `trener`, `kontakt_roditelja`.

**kategorije**, **programi**: `id`, `pol` (M/Ž), `naziv`, `redosled`. Liste koje korisnik sam uređuje, posebne za MSG i za ŽSG.

**sprave**: `id`, `pol` (M/Ž), `naziv`, `skracenica`, `ikona` (ime jedne od ikona iz `dizajn/ikone/` ili prazno), `redosled`. Redosled sprava je i redosled kolona u višeboju i redosled rotacija. Početne vrednosti:
- muške: Parter (PA), Konj sa hvataljkama (KH), Karike (KA), Preskok (PR), Razboj (RA), Vratilo (VR)
- ženske: Preskok (PR), Dvovisinski razboj (DR), Greda (GR), Parter (PA)

**takmicenja**: `id`, `pol` (M/Ž; takmičenje pripada jednom delu), `naziv`, `datum`, `mesto`, `broj_e_sudija` (1 do 6), `pravilo_e` (`odbaci_krajnje` ili `prosek_svih`), `ekipno_broji` (koliko najboljih ocena po spravi ulazi u ekipni zbir, podrazumevano 3), `pomeraj_redosled` (da/ne), `zavrseno` (da/ne), `zaglavlje_biltena` (slobodan tekst za prvi red biltena, može biti prazno), `organizator`, `domacin` (slobodan tekst, može se izabrati klub iz baze), `grb_levo` i `grb_desno` (slika po takmičenju; ako je prazno, koristi se grb iz podešavanja). Kad na istom događaju nastupaju i muški i ženski takmičari, to su dva takmičenja (po jedno u MSG i u ŽSG), svako sa svojim podešavanjima, startnim brojevima i biltenom.

**prijave** (takmičar na takmičenju): `id`, `takmicenje_id`, `takmicar_id`, `klub_id` (prepisan iz kartona u trenutku prijave, da stari rezultati ne promene klub kad takmičar pređe u drugi), `kategorija_id`, `program_id`, `clan_ekipe`, `van_konkurencije`, `startni_broj` (nije obavezan). Jedan takmičar može biti prijavljen samo jednom na isto takmičenje.

**prijava_sprave**: koje sprave takmičar radi (`prijava_id`, `sprava_id`).

**grupe**: `id`, `takmicenje_id`, `pol`, `naziv` (Grupa A, B...), `redosled`, `pocetna_pozicija` (na kojoj spravi po redu grupa počinje u rotaciji 1).

**grupa_clanovi**: `grupa_id`, `prijava_id`, `redosled`. Jedna prijava je u najviše jednoj grupi.

**ocene**: `id`, `prijava_id`, `sprava_id`, `d`, `e` (izračunata konačna E), `odbitak`, `konacna`, `status` (`nacrt`, `uneto`, `odustao`), `broj_ispravki`, `uneto_u`. Jedan red po paru (prijava, sprava).

**ocene_e**: pojedinačne ocene E sudija (`ocena_id`, `sudija` 1..N, `vrednost`).

**izmene_ocena** (zapis ispravki): `id`, `ocena_id`, `vreme`, `razlog`, `staro` i `novo` (sve vrednosti reda pre i posle, kao JSON tekst).

**podesavanja**: ključ i vrednost (izabrani deo, aktivno takmičenje svakog dela posebno, fascikla za kopije, prag upozorenja za lekarski u danima, podrazumevano 30, pravila obračuna i štampe posebno za MSG i za ŽSG).

**migracije**: koje su migracije primenjene.

Brisanje: klub se ne može obrisati dok ima takmičare, takmičar dok ima prijave, stavke iz podešavanja dok se koriste. Poruka kaže zašto i koliko ih ima.

Za kasniji sajt sa rezultatima: svaka tabela ima `kreirano` i `izmenjeno` (datum i vreme), da kasnije može da se šalje samo ono što se promenilo.

## 4. Pravila računanja

Sve u hiljaditim delovima (13,050 je 13050).

**Konačna E ocena** iz ocena E sudija (broj sudija je podešavanje takmičenja):
- pravilo `odbaci_krajnje`: odbace se jedna najviša i jedna najniža, prosek ostalih. Ako su sudije samo dve, računa se prosek obe.
- pravilo `prosek_svih`: prosek svih.
- Kad prosek nema tačno tri decimale, **odseca se na tri decimale** (ne zaokružuje).

**Konačna ocena na spravi** = D + E − odbitak.

**Višeboj** = zbir konačnih ocena na svim spravama tog pola.

**Plasman po spravi:** po konačnoj oceni, opadajuće. **Plasman u višeboju:** po zbiru, opadajuće. U oba slučaja se rangira unutar iste kategorije, programa i pola.

**Van konkurencije (VK):** prikazuje se na mestu koje mu po oceni pripada, ali umesto mesta piše „VK" i ne pomera mesta ostalih. Ne ulazi u ekipu.

**Odustao/la:** na spravi na kojoj je odustao nema ocenu. Ocene sa sprava koje je radio važe za plasman po spravi i za ekipu. U višeboju nema zbir ni mesto i stoji na dnu liste, vidno označen.

**Ekipno:** ekipu čine takmičari istog kluba, pola, kategorije i programa kojima je označeno „član ekipe" i koji nisu VK. Po svakoj spravi se sabira `ekipno_broji` najboljih ocena. Zbir ekipe je zbir po spravama. U prikazu članova, ocene koje se ne broje su u zagradi.

**Isti rezultat:** takmičari sa istom ocenom dele mesto, sledeće mesto se preskače (1, 2, 2, 4).

### Primeri za testove

Ovi primeri su i u `dizajn/primer-podaci.json`, zajedno sa očekivanim plasmanima. Testovi za računanje moraju da ih prođu.

| D | E sudije | pravilo | E | odbitak | konačna |
|---|---|---|---|---|---|
| 4,800 | 8,300 8,100 8,400 8,200 | odbaci krajnje | 8,250 | 0,000 | 13,050 |
| 4,500 | 7,900 8,000 7,700 8,100 | odbaci krajnje | 7,950 | 0,100 | 12,350 |
| 5,100 | 7,600 7,400 7,800 7,500 | odbaci krajnje | 7,550 | 0,000 | 12,650 |
| 3,900 | 7,800 7,900 7,800 8,000 | odbaci krajnje | 7,850 | 0,000 | 11,750 |
| 4,000 | 8,100 8,200 8,400 | odbaci krajnje | 8,200 | 0,000 | 12,200 |
| 4,000 | 8,100 8,200 8,400 | prosek svih | 8,233 | 0,000 | 12,233 |
| 4,000 | 8,100 8,200 | odbaci krajnje | 8,150 | 0,000 | 12,150 |

Višeboj ŽSG iz primera: Petrović Ana 50,300 (1.), Nikolić Teodora 49,700 (2.), Stojanović Nina 49,100 (VK), Jovanović Milica 48,950 (3.). Ekipno: SD „Vojvodina" 144,550, GK „Beograd" 142,550, GK „Niš" 117,700.

## 5. Ekrani

Za svaki ekran postoje `dizajn/slike/<ime>.png` i `dizajn/ekrani/<ime>.html`. Bočni meni i gornja traka su isti svuda. Gornja traka uvek prikazuje aktivno takmičenje izabranog dela.

Na vrhu bočnog menija, ispod naziva programa, je prekidač **MSG | ŽSG** (Alt+M, Alt+Z). Izabrani deo važi za sve ekrane i pamti se posle ponovnog pokretanja. Svaki deo pamti svoje aktivno takmičenje, a promena dela vodi na Početnu tog dela. U izabranom delu postoje samo njegova takmičenja, takmičari, prijave, grupe, sprave, kategorije, programi, rang liste i bilteni. Klubovi i Rezervna kopija su zajednički za oba dela. Zato ekrani ispod ne biraju pol.

Od verzije 1.1.0 tok pripreme (Početna, Takmičenja, Prijave, Rotacije i novi Pregled takmičenja) opisuje `docs/TOK-PRIPREME.md`; gde se razlikuje od ovog odeljka, važi taj dokument.

### 01 Početna (`01-pocetna`)
- Kartica aktivnog takmičenja izabranog dela: naziv, datum, mesto, broj E sudija, broj prijavljenih, broj klubova, rotacija u toku. Link „Promeni aktivno takmičenje".
- Dve velike pločice: „Unos ocena" (nastavlja tamo gde se stalo: sprava, rotacija, koliko je uneto) i „Rang liste".
- Poslednja rezervna kopija (datum i vreme, oznaka ako je od danas) i dugme za novu kopiju.
- Verzija aplikacije u dnu bočnog menija (čita se iz fajla `VERZIJA`).
- Ako nema aktivnog takmičenja, umesto kartice stoji poruka i dugme „Napravi takmičenje".

### 02 Klubovi (`02-klubovi`)
- Tabela: puno ime, skraćenica, grad. Pretraga filtrira dok se kuca.
- Forma desno služi i za dodavanje i za izmenu. Alt+N prazni formu za novi klub, Enter čuva, Esc otkazuje.
- Skraćenica je obavezna i jedinstvena.

### 03 Takmičari (`03-takmicari`)
- Tabela: ID, prezime i ime, godište, klub (skraćenica), lekarski važi do.
- Pretraga (ime, prezime, ID) i filteri: klub, godište. Lista ima samo takmičare izabranog dela, pa filtera pola nema.
- Strelice gore i dole menjaju izabrani red, Enter otvara karton u formi desno.
- Karton: ID broj, ime, prezime, godina rođenja, pol, klub (puno ime), državljanstvo, lekarski važi do. Opciono: broj licence, trener, kontakt roditelja. Novi takmičar dobija pol izabranog dela. Pogrešno unet pol postojećeg takmičara (koji nema prijave) ispravlja se u kartonu: čuvanjem takmičar prelazi u drugi deo.
- **Lekarski:** ako ističe za 30 dana ili manje (prag je podešavanje), narandžasta oznaka „Ističe za N dana". Ako je istekao, crvena oznaka „Istekao". Isto i u formi pored polja.
- Datum se kuca kao `dd.mm.gggg` (tačke se mogu izostaviti, pa `25102026` postaje `25.10.2026.`).

### 04 Podešavanja (`04-podesavanja`)
- Tri liste izabranog dela: kategorije, programi i sprave (drugi deo ima svoje), i pravila obračuna i štampe za taj deo. Opšta podešavanja računara (prag za lekarski, adresa i token sajta) su zajednička.
- Svaka stavka: izmena na licu mesta (red postaje polje, Enter čuva, Esc otkazuje), brisanje, promena redosleda prevlačenjem.
- Dodavanje na dnu liste: polje i „Dodaj" (Enter u polju dodaje). Sprava ima i skraćenicu i izbor ikone.

### 05 Takmičenja (`05-takmicenja`)
- Lista (samo takmičenja izabranog dela): naziv i mesto, datum, broj E sudija, status. Status: „Aktivno" (ono koje je izabrano kao aktivno), „U pripremi", „Završeno".
- „Aktiviraj" postavlja takmičenje kao aktivno. Aktivno može biti samo jedno u svakom delu.
- Forma „Novo takmičenje" (novo takmičenje dobija pol izabranog dela): naziv, datum, mesto, broj E sudija (1 do 6), pravila (obračun E ocene, koliko ocena se broji za ekipu).
- Broj E sudija se ne može menjati kad takmičenje već ima unete ocene.

### 06 Prijave (`06-prijave`)
- Levo baza takmičara izabranog dela sa pretragom i filterima. Već prijavljeni su sivi sa oznakom „Prijavljen". Izbor kućicama, „Dodaj u prijave" (Enter).
- Desno prijavljeni na aktivno takmičenje. Za svakog u redu: startni broj (nije obavezan), kategorija, program, sprave koje radi (dugmići sa skraćenicama, uključeno ili isključeno), član ekipe, van konkurencije. Svaka izmena se čuva odmah.
- Nova prijava dobija podrazumevano sve sprave svog pola.
- „Dodeli startne brojeve" dodeljuje redom onima koji ga nemaju.
- **Upozorenje** ako lekarski ne važi na dan takmičenja: red je crvenkast, ispod imena piše do kada važi, a iznad tabele je traka sa punom porukom. Upozorenje ne sprečava prijavu.

### 07 Rotacije (`07-rotacije`)
- Grupe pripadaju takmičenju, a time i delu. Izbor kategorije i programa u traci je samo filter prikaza.
- Kolone: „Neraspoređeni" i po jedna za svaku grupu. Zaglavlje grupe pokazuje na kojoj je spravi grupa u izabranoj rotaciji.
- **Prevlačenje** kartice menja redosled u grupi ili prebacuje u drugu grupu. Dok se vuče, vidi se mesto gde će kartica pasti.
- **Tastatura:** izabrana kartica se pomera sa Alt+strelica gore/dole (redosled) i Alt+strelica levo/desno (druga grupa).
- Grupa u rotaciji R je na spravi sa pozicijom `(pocetna_pozicija + R − 1)` po modulu broja sprava. Broj rotacija je broj sprava tog pola.
- Ako je uključeno „Pomeraj redosled u svakoj rotaciji", u rotaciji R redosled u grupi se pomera za R − 1 mesta (prvi ide na kraj).
- Dugme za dodavanje nove grupe i brisanje prazne grupe (nije nacrtano, koristi iste komponente).

### 08 Unos ocena (`08-unos-ocena`). Najvažniji ekran

- Izbor: sprava, rotacija (pol je pol izabranog dela). Iz toga sledi grupa i spisak takmičara redom nastupa. Desno je napredak (obrađeno od ukupno, broj odustalih).
- Jedan takmičar je jedan red: redni broj, startni broj, ime sa klubom, kategorijom i programom, **D**, **E1..EN** (N je broj E sudija takmičenja), izračunata **E**, **odbitak**, **konačna**, status.
- **Stanja reda** (vidi i `00-vizuelni-sistem`):
  - *uneto*: vrednosti su zaključane (izgledaju kao tekst), oznaka „Uneto", olovka za ispravku
  - *trenutni*: svetlocrvena podloga i crveni okvir, polja otvorena, polje u fokusu ima crni okvir
  - *čeka*: siva podloga, prazna polja
  - *odustao/la*: bez polja, oznaka „Odustala/Odustao", dugme „Vrati"
  - *ispravljeno*: kao uneto, sa oznakom „Ispravljeno"
- **Tok unosa:**
  1. Po otvaranju ekrana fokus je na prvom praznom polju prvog neunetog takmičara.
  2. Tab ili Enter prelaze na sledeće polje u redu.
  3. E i konačna se računaju i prikazuju čim su sva E polja popunjena.
  4. Enter na polju „odbitak" potvrđuje red (prazan odbitak je 0), čuva ga i prebacuje fokus na D sledećeg takmičara.
  5. Strelice gore i dole prelaze na drugog takmičara bez potvrde.
- **Unos brojeva:** prihvata i zarez i tačku. `8,3` i `8.3` postaju `8,300`. Najviše tri decimale, vrednost od 0 do 20. Neispravan unos: polje dobija crveni okvir i fokus ostaje u njemu.
- **Čuvanje:** potvrđen red se čuva odmah na server. Nepotvrđen red se čuva kao nacrt kad god se napusti polje, da se ništa ne izgubi ako nestane struje. Ako čuvanje ne uspe, red to jasno pokazuje i nudi ponovni pokušaj.
- **Odustao (F8):** označava trenutnog takmičara kao odustalog na ovoj spravi i prelazi na sledećeg. „Vrati" poništava.
- **Ispravka (F9 ili olovka):** otključava uneti red. Pri potvrdi se traži kratak razlog (obavezno). Čuva se zapis: vreme, takmičar, šta je bilo, šta je sada, razlog. Poslednje izmene na ovoj spravi vide se ispod tabele.
- Natpis dugmeta i oznake prate pol takmičara (Odustao, Odustala).

### 09 Rang liste (`09-rang-liste`)
- Tabovi: po jedan za svaku spravu izabranog pola, zatim „Višeboj" i „Ekipno".
- Filteri: kategorija, program. Pola nema: lista je uvek za izabrani deo.
- Tab sprave: mesto, startni broj, takmičar, klub, D, E, odbitak, konačna.
- Višeboj: mesto, startni broj, takmičar, klub, ocena po svakoj spravi, ukupno.
- Ekipno: mesto, klub, zbir po spravi, ukupno, sa članovima ispod (kao u biltenu).
- Prva tri mesta imaju tamnu pločicu sa brojem. VK i odustali su označeni kako je nacrtano.
- **Ime takmičara je link** koji otvara ekran „Rezultati takmičara".
- „Pregled za štampu" otvara list za štampu za trenutni tab i filtere. „Bilten takmičenja" otvara bilten.

### 09c Rezultati takmičara (`09c-rezultati-takmicara`)
- Zaglavlje: ime, ID, godište, pol, klub, kategorija i program. „Otvori karton" vodi na karton. „Rang liste" vraća nazad.
- Gornja tabela: izabrano takmičenje, po spravi D, svaka E ocena (odbačene su precrtane), E, odbitak, konačna, mesto na spravi. Poslednji red je višeboj.
- Donja tabela: sva takmičenja tog takmičara (ocene po spravama, višeboj, mesto). Klik na takmičenje ga prikazuje u gornjoj tabeli.

### 09b Štampa rang liste (`09b-stampa-rang-lista`)
- A4 uspravno. Zaglavlje sa mestom za grb, naziv takmičenja, mesto i datum, šta se prikazuje, oznaka „Zvanično" sa vremenom štampe.
- Za svakog takmičara blok: mesto, startni broj, ime i klub, pa po spravi ocena, mesto na spravi u zagradi, D, E i odbitak ako postoji. Na kraju ukupno.
- Legenda, potpisi (glavni sudija, zapisničar), vreme štampe, broj strane.

### 09d i 09e Bilten (`09d-bilten-zsg`, `09e-bilten-msg`)
- Po uzoru na biltene Gimnastičkog saveza Srbije. ŽSG je A4 uspravno, MSG je A4 položeno (šest sprava).
- Zaglavlje: prvi red je tekst iz podešavanja takmičenja (`zaglavlje_biltena`, može biti prazan), zatim organizator, „BILTEN", naziv takmičenja, disciplina sa kategorijom i programom, mesto i datum, domaćin (ako je upisan). Dva mesta za grb (slika se bira u formi takmičenja, a ako je nema, u podešavanjima; nije obavezna).
- Delovi: „Rezultati ekipno", pa „Višeboj". Višeboj ima za svaku spravu D (jedna decimala), E i ocenu.
- Podnožje: mesto i datum, „Strana X/Y".
- Bilten se pravi za izabrani deo, kategoriju i program. Dugačke liste se prelamaju na više strana, zaglavlje tabele se ponavlja.

### 10 Rezervna kopija (`10-rezervna-kopija`)
- „Napravi rezervnu kopiju": pravi jedan fajl sa svim podacima, za MSG i ŽSG zajedno.
- „Vrati iz kopije": traži potvrdu, pre vraćanja automatski pravi kopiju trenutnog stanja, pa vraća.
- Fascikla za kopije se može promeniti (na primer USB).
- Lista prethodnih kopija: datum i vreme, fajl, veličina, vrsta (ručna, pre vraćanja, pre ažuriranja), „Vrati ovu".
- Deo „Ažuriranje" (nije nacrtan, koristi iste komponente): trenutna verzija i „Primeni zakrpu".

## 6. Tastatura

| Prečica | Šta radi |
|---|---|
| Alt+M, Alt+Z | Prebaci na MSG, odnosno na ŽSG |
| F2 | Unos ocena |
| F4 | Rang liste |
| Tab, Enter | Sledeće polje. U formama Enter na poslednjem polju čuva |
| Esc | Otkaži izmenu |
| Alt+N | Novi zapis na ekranima sa tabelom i formom |
| Strelice gore, dole | Izbor reda u tabeli, drugi takmičar u unosu ocena |
| F8 | Odustao/la (unos ocena) |
| F9 | Ispravka unete ocene (unos ocena) |
| Alt+strelice | Pomeranje kartice (rotacije) |
| Ctrl+P | Štampa |
| Ctrl+S | Napravi rezervnu kopiju (na ekranu kopija) |

Pravila: fokus je uvek vidljiv (crni okvir), redosled Tab prati redosled unosa, nijedna radnja ne zahteva miša. Prečice treba proveriti u Chrome-u i Edge-u. Ako se neka sudara sa browserom, predloži zamenu.

## 7. Štampa

- Štampa ide kroz browser (`window.print`) sa posebnim pogledima i CSS-om za štampu (`@page` A4, uspravno ili položeno).
- Na papiru: crn tekst, linije najmanje 1 px, bez pozadinskih boja osim svetlosive za red ekipe, najmanji tekst 9 pt.
- Bočni meni i dugmad se ne štampaju.

## 8. Rezervne kopije, instalacija i ažuriranje

**Kopija** je jedan zip fajl `kopija_GGGG-MM-DD_HHMM.zip` sa SQL izvozom svih tabela i malim fajlom sa opisom (verzija aplikacije, vreme, vrsta). Izvoz radi sam PHP, bez oslanjanja na `mysqldump`. Lista kopija se čita iz fascikle, ne iz baze.

**Vraćanje** proverava verziju kopije. Kopija iz starije verzije se vrati, pa se na nju primene migracije. Kopija iz novije verzije od aplikacije se odbija sa jasnom porukom.

**Instalacija na drugi laptop (sa USB-a):**
1. Instalirati XAMPP.
2. Prekopirati folder aplikacije u `htdocs`.
3. Otvoriti aplikaciju u browseru. Prvo pokretanje prikazuje kratak ekran za podešavanje: podaci za bazu (podrazumevano `root` bez lozinke), pravi bazu i tabele, upisuje `config/config.php`.
4. Uputstvo za ovo napisati u `docs/INSTALACIJA.md`, korak po korak, za nekoga ko nije programer.

**Ažuriranje zakrpama koje ne diraju podatke:**
- Šema baze se menja samo kroz numerisane migracije u `migracije/`. Migracije samo dodaju ili menjaju strukturu i nikad ne brišu podatke korisnika.
- Zakrpa je zip koji pravi `alati/napravi-zakrpu.php`: sadrži fajlove aplikacije i fajl sa opisom (iz koje u koju verziju). **Ne sadrži** `config/`, `kopije/` ni bilo kakve podatke.
- „Primeni zakrpu" u aplikaciji: proveri opis, napravi kopiju vrste „pre ažuriranja", raspakuje fajlove preko postojećih (osim zaštićenih foldera), pokrene nove migracije, prikaže novu verziju.
- Ako migracija ne uspe, prikazuje se poruka i nudi vraćanje iz upravo napravljene kopije.

## 9. Van obima za sada

- Rezultati uživo na sajtu.
- Unos sa tableta ili laptopova za sudije.
- Finale po spravama i kvalifikacije kao posebni delovi biltena.
- Više korisnika i prijava.

## 10. Otvorena pitanja za naručioca

Ovo su pretpostavke iz dizajna. Napravi ih kao podešavanja ili lako izmenjiva mesta u kodu i **pitaj pre nego što ih zaključaš**:

1. Odsecanje ili zaokruživanje proseka E ocene na tri decimale.
2. Po kom pravilu se sabira ekipno (koliko članova, koliko ocena se broji po spravi) i da li ekipa mora imati najmanji broj članova.
3. Deljenje mesta kod istog rezultata ili dodatno pravilo (viša E, pa viša D).
4. Da li na preskoku postoje dva skoka čiji se prosek računa (u nekim programima).
5. Da li takmičar koji ne radi sve sprave ulazi u višeboj.
6. Da li upozorenje za lekarski treba da spreči prijavu ili samo da upozori.
7. Da li su grupe i rotacije jedne za celo takmičenje (kako je ovde opisano) ili posebne po kategoriji.

## 11. Faze izrade

Radi fazu po fazu. Posle svake faze: pokreni testove, otvori ekrane u browseru, uporedi sa slikama iz `dizajn/slike/`, javi šta je urađeno i šta je ostalo, pa sačekaj potvrdu.

0. **Osnova:** struktura projekta, ruter, baza i migracije, prvo pokretanje, zajednički okvir (bočni meni, gornja traka), CSS komponente iz vizuelnog sistema, font, ikone. Interna stranica `/sistem` sa svim komponentama, za poređenje sa `00-vizuelni-sistem.png`.
1. **Baza:** Klubovi, Takmičari, Podešavanja.
2. **Takmičenje:** Takmičenja, Prijave.
3. **Rotacije.**
4. **Unos ocena** i modul za računanje sa testovima iz odeljka 4.
5. **Rezultati:** Rang liste, Rezultati takmičara, štampa rang liste, bilteni.
6. **Sigurnost podataka:** rezervna kopija, vraćanje, zakrpe, uputstvo za instalaciju, Početna.

Provera na kraju: `alati/primer-podaci.php` učita `dizajn/primer-podaci.json`, a rang liste i bilteni daju iste brojeve i mesta kao na slikama.
