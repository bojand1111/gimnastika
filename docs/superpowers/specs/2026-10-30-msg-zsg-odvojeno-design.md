# MSG i ŽSG kao dva odvojena dela aplikacije

Status: dizajn, čeka Bojanovo odobrenje. Ništa od ovoga još nije napravljeno.

## 1. Zašto

Bojan, 2026-10-30: „treba da gore kod pocetne imam 2 razlicita programa tj posebno za msg posebno za zsg i da unutra zsg imam
samo zsg a unutar msg da imam samo msg“, i posle, uz sliku: „sprave i sve je razlicito dodaj gore da se izabere neka bude za
svaku posebno i sve odvojeno kao 2 aplikacije ali u jednoj“.

Danas su MSG i ŽSG izmešani: jedno takmičenje ima oba pola, a pol se bira posebno na svakom ekranu (Unos, Rang liste,
Rotacije, Prijave imaju svoj prekidač, Takmičari svoj filter) i ti izbori se ne slažu (Rotacije uvek otvaraju ŽSG, Prijave i
Takmičari prikazuju oba, Unos i Rang biraju sami). Zapisničar radi jedan pol, pa mu drugi samo smeta i lako se pogreši.

Uspeh: posle izbora MSG ili ŽSG zapisničar na nijednom ekranu ne vidi ništa od drugog pola i nigde ne bira pol.

## 2. Ciljevi

- Prekidač **MSG | ŽSG** u bočnom meniju, ispod logoa i naziva „Gimnastika“ (mesto koje je Bojan označio na slici, iznad
  stavke Početna). Uvek vidljiv, na svakom ekranu sa menijem.
- Izabrani pol važi za celu aplikaciju dok se ne promeni i pamti se posle ponovnog pokretanja.
- U izabranom delu postoji samo taj pol: takmičenja, takmičari, prijave, grupe i rotacije, sprave, kategorije, programi,
  unos ocena, rang liste, rezultati, štampa, bilten, pregled, Početna, uvoz prijava.
- Prekidači i filteri pola na pojedinačnim ekranima nestaju (Unos, Rang, Rotacije, Prijave, Takmičari, Uvoz).
- Postojeći podaci prelaze bez gubitka (odeljak 6).

## 3. Šta nije cilj

- Dve baze ili dva programa. Ostaje jedna baza, jedan exe, jedna rezervna kopija za oba dela.
- Prikaz oba pola zajedno bilo gde (zbirni pregled, zajednički bilten). Ako zatreba, to je novi zahtev.
- Promena pravila računanja ocena.

Neuspeh i kad tehnički radi: bilo koji podatak iz drugog pola se pojavi u izabranom delu (u listi, broju, rang listi, startnom
broju, uvozu), ili prelazak na novu verziju izgubi ili pomeša postojeće prijave i ocene.

## 4. Odluke (Bojanove)

- Jedna aplikacija, dva dela, „kao 2 aplikacije ali u jednoj“.
- Prekidač gore u bočnom meniju, ispod logoa.
- Sve je posebno po polu: sprave, takmičenja i njihova podešavanja, kategorije, programi, takmičari, rotacije, rezultati.
- Takmičenje pripada jednom polu. Kad na istom događaju rade i dečaci i devojčice, to su dva takmičenja (na primer
  „I kolo PGL“ u MSG i „I kolo PGL“ u ŽSG), svako sa svojim podešavanjima (broj E sudija, obračun E, ekipno), startnim
  brojevima, potvrdama klubova i biltenom. (Predlog u razgovoru, Bojan: „dada“.)
- Kategorije i programi su posebni za MSG i za ŽSG. (Predlog, Bojan: „dada“.)
- Klubovi su zajednički za oba dela (isti stvarni klubovi). (Pitanje „zajednički ili odvojeni“, odgovor „dada“, shvaćeno kao
  zajednički; Bojan može da ispravi.)
- Rezervna kopija ostaje jedna i čuva oba dela.
- Pravila obračuna i štampe iz Podešavanja su posebna za MSG i za ŽSG (Bojan: „Posebna“): `e_zaokruzivanje`,
  `plasman_isti_rezultat`, `viseboj_nepotpun`, `lekarski_sprecava_prijavu`, `organizator`, `grb_levo`, `grb_desno`.
  Rang liste, rezultati, štampa, bilten i prijave čitaju vrednosti pola kome takmičenje pripada.

## 5. Kako se ponaša, ekran po ekran

- **Bočni meni:** prekidač sa dve opcije, izabrana je istaknuta. Mora da radi i sa tastature (prečica prikazana kao `kbd`,
  pravilo „tastatura pre miša“). Promena pola vodi na Početnu tog dela.
- **Gornja traka:** aktivno takmičenje izabranog dela.
- **Aktivno takmičenje se pamti posebno za MSG i za ŽSG.** Povratak u deo vraća njegovo aktivno takmičenje.
- **Početna:** aktivno takmičenje tog dela, „Priprema po klubovima“, ostala takmičenja, lekarski pregledi samo za takmičare
  tog pola.
- **Takmičenja:** samo takmičenja tog pola; novo takmičenje dobija pol izabranog dela.
- **Pregled takmičenja:** sve pločice i brojevi samo za taj pol.
- **Klubovi:** zajednička lista (isti ekran u oba dela).
- **Takmičari:** samo takmičari tog pola; nov takmičar dobija pol izabranog dela. Mora ostati način da se ispravi pogrešno unet
  pol takmičara koji nema prijave (kako, odlučuje graditelj).
- **Prijave:** baza takmičara i lista prijava samo za taj pol; dijalog „Novi takmičar“ bez izbora pola.
- **Uvoz prijava:** izbor „Pol takmičara u fajlu“ nestaje; pol je pol izabranog dela, uvoz ide u aktivno takmičenje tog dela.
- **Rotacije, Unos ocena, Rang liste, Rezultati, Štampa, Bilten:** samo taj pol, bez prekidača; F2 i F4 vode na ekrane
  izabranog dela.
- **Podešavanja:** sprave, kategorije, programi i pravila obračuna i štampe (odeljak 4) samo tog pola. Opšta podešavanja
  računara (prag za lekarski, fascikla kopija, adresa i token sajta) su zajednička.
- **Rezervna kopija:** isti ekran u oba dela, kopija sadrži sve.

## 6. Podaci

- Nova numerisana migracija (sledeća je `005_...`); postojeće migracije se ne menjaju.
- `takmicenja`, `kategorije` i `programi` dobijaju pol. `takmicari.pol`, `sprave.pol` i `grupe.pol` već postoje.
- Prelaz postojećih podataka:
  - Pol takmičenja se određuje iz njegovih prijava i grupa zajedno (`grupe.pol`). (Odluka u pisanju dizajna: prazne ŽSG grupe
    u MSG takmičenju su verovatne jer Rotacije danas uvek otvaraju ŽSG.)
  - Takmičenje čije su sve prijave i grupe jednog pola dobija taj pol.
  - Takmičenje bez ijedne prijave i grupe (na primer tek napravljeno „test“) pojavljuje se u oba dela kao dva takmičenja; višak
    korisnik obriše. (Odluka u pisanju dizajna: ništa ne sme da nestane iz dela u kome ga zapisničar očekuje.)
  - Takmičenje sa prijavama ili grupama oba pola deli se na dva: jedno zadržava svoj id i jedan pol, drugo je novo sa istim podacima i
    podešavanjima i preuzima prijave (sa ocenama, E ocenama i izmenama), grupe i redosled drugog pola. Potvrde klubova se
    prepisuju u oba.
  - Svaka postojeća kategorija i svaki program postaju dve stavke (MSG i ŽSG) istog naziva i redosleda, bez obzira ko ih
    koristi, a prijave pokazuju na stavku svog pola. (Odluka u pisanju dizajna: kategorije su obično uzrasne i važe za oba pola;
    nijedan deo ne ostaje bez liste, višak korisnik obriše u Podešavanjima.)
  - Startni brojevi se ne menjaju.
  - Trenutne vrednosti pravila obračuna i štampe prepisuju se u oba dela. Za grbove i dalje važi pravilo iz `kopija.cjs`
    (`MESNI_KLJUCEVI`, `grbOk`): pri vraćanju kopije prelaze samo vrednosti oblika `grb/<ime>`, sve drugo se prazni. To pravilo
    mora da važi i za nove ključeve grbova po polu.
  - Aktivno takmičenje postaje aktivno u delu svog pola (ako je podeljeno, u oba dela).
- **Vraćanje starije kopije** (na primer `kopija_2026-10-30_1522.sqlite` iz 1.1.1, ili PHP .zip) mora da prođe isti prelaz.
  Pažnja: `kopija.cjs` danas pravi svežu, već migriranu bazu pa u nju prepisuje podatke iz kopije, tako da SQL migracija ne
  vidi stare podatke. Prelaz zato ne sme da živi samo u SQL migraciji.
- Sve u jednoj transakciji; pre migracije se pravi kopija `pre_migracije` kao i do sada.

## 7. Ograničenja

- Pravila projekta: srpski interfejs, latinica; ocene u celim brojevima; svaka izmena se čuva odmah; tastatura pre miša;
  ekran staje na 1366x768 bez vodoravnog skrolovanja.
- Nijedan postojeći test ne sme da se izgubi bez zamene; testovi koji danas mešaju polove u jednom takmičenju prelaze na
  odvojena takmičenja.
- Novo ponašanje mora imati testove: prelaz podataka (jedan pol, oba pola, zajednička kategorija, vraćanje stare kopije) i
  filtriranje po izabranom polu na svakom ulazu koji vraća podatke.
- Rezultati uživo (sinhro) šalju snimak aktivnog takmičenja; sada ih ima dva. (Odluka graditelja, predlog: šalju se oba.)

## 8. Prepušteno graditelju

- Gde se čuva izabrani pol (na primer ključ u `podesavanja`, po uzoru na `aktivno_takmicenje`) i kako ga ekrani čitaju.
- Izgled prekidača u okviru vizuelnog sistema, tačna prečica sa tastature.
- Koje od dva takmičenja zadržava stari id pri podeli.
- Redosled rada po fazama, uz pravilo: posle svake faze testovi prolaze i aplikacija radi.
