# Automatski raspored po grupama i turnusi

Datum: 2026-11-12. Status: odobreno 12.11.; dopunjeno primerom sa Memorijala 2025.

## Zašto

Zapisničar sada ručno prevlači svakog takmičara iz „Neraspoređeni” u grupe. Na pravom takmičenju (slika od 12.11.: 48 takmičara MSG, 6 sprava) to traje dugo, a 48 takmičara ne staje u 6 grupa po 6 (36 mesta). Tada se takmičenje deli na dva turnusa. Aplikacija danas ne zna za turnuse: svaka grupa ima samo početnu spravu, pa dve grupe na istoj spravi u istoj rotaciji ne mogu da postoje.

## Šta je Bojan rekao

- Za prvu rotaciju trebaju parametri: najviše 6 takmičara po spravi (grupi), a može i manje.
- Grupisanje po kategoriji i klubu.
- Drugi turnus kad je potreban.
- Podela po turnusima ide po kategorijama: mlađi u prvom turnusu, stariji u drugom.
- Maksimalan broj takmičara po grupi mora da se zada.
- Na karticama grupa umesto teksta sprave („Parter”, „Karike”...) idu slike sprava.

## Primer sa pravog takmičenja (Memorijal 2025, MSG, Bojan poslao 12.11.)

Startna lista je tabela: red je kategorija sa svojim terminom, kolona je početna sprava (zaglavlje su piktogrami sprava, redosled FIG), ćelija su klubovi sa brojem takmičara.

- 5 kategorija, svaka u svom turnusu i terminu (petak 09–11, 12–14, 15–17; subota 09–11, 12–14). Mlađe kategorije prve.
- Po kategoriji 13 do 22 takmičara, uvek 6 grupa (jedna po spravi).
- Klub se u kategoriji nikad ne deli: klub od 5 je sam u grupi. Grupe su zato neujednačene (1 do 5 takmičara) i imaju 1 do 3 kluba.
- Termini (dan i sat) nisu deo ovog posla.

Zaključak (odluka izvođača posle primera): dijalog dobija kućicu „Svaka kategorija u svom turnusu”, podrazumevano uključenu jer tako izgleda pravo takmičenje. Kad je isključena, važi pakovanje kategorija u što manje turnusa (pravila 3 do 5). Celina kluba je jača od ujednačenosti grupa.

## Ciljevi

1. Jedno dugme na ekranu Rotacije pravi ceo raspored: grupe, njihove početne sprave i turnuse.
2. Turnusi postoje u podacima i rade svuda gde se koriste grupe: Rotacije, Unos ocena, zapisnici (popunjeni i prazni), Pregled takmičenja i napredak.
3. Posle automatskog rasporeda sve ostaje ručno izmenljivo kao danas (prevlačenje, Alt+strelice, izmena grupe).
4. Slike sprava na karticama grupa.

## Šta nije cilj

- Raspored ne optimizuje vreme trajanja niti sudije.
- Ne menja se računanje ocena, rang liste ni bilten (oni ne zavise od grupa).
- Ne pravi se raspored za više od jednog dela (MSG i ŽSG se raspoređuju svaki u svom delu, kao i sve ostalo).

## Šta ne sme da se desi

- Gubitak ili izmena unetih ocena. Ocene su vezane za prijavu i spravu, ne za grupu, i tako ostaje.
- Postojeća takmičenja posle ažuriranja izgledaju i rade isto kao pre (sve postojeće grupe su turnus 1).
- Tihi pregažen ručni raspored: zamena postojećeg rasporeda traži potvrdu.

## Podaci

- Nova migracija `008_turnus.sql`: `ALTER TABLE grupe ADD COLUMN turnus INTEGER NOT NULL DEFAULT 1`. Postojeće migracije se ne menjaju.
- Rezervna kopija i vraćanje kopije nose novu kolonu (proveriti `kopija.cjs`; stara kopija bez kolone se vraća kao turnus 1).
- Grupa jednog turnusa ima početnu spravu 1..broj sprava; u jednom turnusu dve grupe ne smeju imati istu početnu spravu samo ako ih pravi automatski raspored (ručno, kao danas, nema provere).

## Automatski raspored

### Dijalog „Rasporedi automatski”

Dugme na traci ekrana Rotacije, pored „Nova grupa”. Otvara dijalog sa:

- **Najviše takmičara po grupi**: broj, podrazumevano 6, dozvoljeno 1 do 30.
- **Ista kategorija zajedno**: kućica, uključena.
- **Isti klub zajedno**: kućica, uključena.
- **Svaka kategorija u svom turnusu**: kućica, uključena; onemogućena kad je „Ista kategorija zajedno” isključena. Uključena: svaka kategorija je svoj turnus (redom iz šifarnika); kategorija veća od jednog turnusa deli se na `ceil(veličina / (maksimum × broj sprava))` turnusa što ujednačenije; prijave bez kategorije su poslednji turnus. Isključena: pravila 3 do 5.
- **Pregled pre potvrde**: koliko takmičara, koliko turnusa, koje kategorije idu u koji turnus i veličine grupa (na primer „Turnus 1: Pioniri, Kadeti, 26 takmičara, grupe 5, 5, 4, 4, 4, 4”). Pregled se računa odmah pri promeni parametara.
- Dugmad „Rasporedi” i „Otkaži”. Sve radi tastaturom.

### Koga raspoređuje

Sve prijave izabranog dela (pola). Ako već postoje grupe sa takmičarima, dijalog upozorava da se postojeći raspored briše i pravi novi, i „Rasporedi” traži potvrdu. Brisanje briše grupe tog dela i njihov ručni redosled po rotacijama, ne prijave i ne ocene.

Ako je za taj deo uneta bar jedna ocena (status nije nacrt), automatski raspored je zabranjen sa porukom; ručne izmene ostaju dozvoljene kao danas.

### Pravila (po prioritetu)

1. Nijedna grupa nema više od zadatog maksimuma. Broje se članovi grupe, bez obzira na to ko na kojoj spravi nastupa.
2. Broj grupa u jednom turnusu je broj sprava tog dela (MSG 6, ŽSG 4), a manje samo kad turnus ima manje takmičara nego sprava (tada jedna grupa po takmičaru). Svaka grupa počinje na drugoj spravi (početne sprave 1..k). Prazne grupe se ne prave.
3. Broj turnusa je najmanji koji staje: `ceil(broj takmičara / (maksimum × broj sprava))`.
4. Kategorije idu redom iz šifarnika (samo polje redosled, kako ih je korisnik poređao u Podešavanjima): prve (mlađe) u turnus 1, sledeće u turnus 2 itd. Kategorija se ne deli između turnusa, osim ako je sama veća od jednog turnusa.
5. Granica između turnusa pada samo na granicu kategorija. Od mogućih granica bira se ona sa kojom su turnusi najujednačeniji, a nijedan ne prelazi kapacitet (maksimum × broj sprava). Pravilo 4 je jače od ujednačenosti: 48 takmičara sa granicom kategorija na 20/28 daje 20/28, ne 24/24. Ako nijedna granica kategorija ne daje turnuse u kapacitetu, kategorija koja ne staje deli se tako da prethodni turnus bude pun, a ostatak ide u sledeći.
6. U turnusu: takmičari iste kategorije stoje u susednim grupama (grupa sme da ima kraj jedne i početak sledeće kategorije, jer grupa ima koliko i sprava); takmičari istog kluba iste kategorije stoje u istoj grupi kad god to dozvoljava maksimum. Klub veći od maksimuma deli se na što manje delova, a ti delovi su u susednim grupama.
7. Grupe u turnusu što ujednačenije po veličini, kad to ne kvari pravila 1 do 6 (klub se ne deli radi ujednačenosti; na pravom takmičenju grupe su od 1 do 5).
8. Redosled u grupi: kategorija, program, klub, prezime, ime (kao sadašnja lista Neraspoređeni).
9. Prijave bez kategorije idu posle svih kategorija.

Kad je „Ista kategorija zajedno” isključena, kategorija se ne gleda ni za turnuse ni za grupe: redosled je klub, prezime, ime, a turnusi se dele na ujednačene delove. Kad je „Isti klub zajedno” isključen, klub se ne gleda: redosled je kategorija, program, prezime, ime.

Zamena rasporeda briše grupe i njihov ručni redosled po rotacijama (`grupa_redosled`), a podešavanje „Pomeraj redosled” ostaje kakvo jeste.

Logika je čista funkcija `rasporedi(prijave, { brojSprava, maksimum, poKategoriji, poKlubu, turnusPoKategoriji })` u `electron/racun/raspored.mjs`, sa testovima, u celim brojevima, bez baze.

### Nazivi grupa

Turnus 1: Grupa A, B, C... Turnus 2 nastavlja slova (G, H... za MSG). Nazivi se posle mogu menjati kao danas.

## Turnusi u ostatku aplikacije

Turnusi idu jedan za drugim: turnus 2 počinje kad turnus 1 završi sve rotacije. Brojač rotacija je u svakom turnusu od 1 do broja sprava. Nema jedinstvenog indeksa na (turnus, početna sprava); ako ručno dve grupe istog turnusa imaju istu početnu spravu, Unos uzima prvu, kao danas.

- **Rotacije**: na traci izbor „Turnus 1, 2, ...” (vidi se samo kad postoji više od jednog turnusa). Kolone prikazuju Neraspoređeni i grupe izabranog turnusa. „Nova grupa” pravi grupu u izabranom turnusu. U dijalogu grupe može da se promeni turnus. Turnus je u hashu (`tu`), kao rotacija.
- **Unos ocena**: izbor turnusa na traci pored rotacije (samo kad ih je više). Grupa na spravi traži se u izabranom turnusu. Kad se ulazi bez izbora, nastavlja se gde se stalo: prvi turnus sa nezavršenim unosom.
- **Napredak i Pregled takmičenja**: rotacija u toku računa se unutar turnusa; tekući turnus je prvi nezavršen. Prikaz „Rotacija 3 od 6” dobija „Turnus 2,” ispred kad turnusa ima više.
- **Zapisnici (popunjeni i prazni)**: listovi po turnusu, pa po spravi i rotaciji; naslov lista sadrži turnus kad ih ima više. Prave se iz grupa, kao danas.
- **Pregled takmičenja**: turnus se dodaje samo u tekst napretka, ne uz svaku grupu.
- `grupaNaSpravi` i `napredak` u `electron/racun` dobijaju turnus; poziv bez turnusa ponaša se kao danas.

## Slike sprava na karticama grupa

U koloni grupe umesto oznake sa tekstom sprave stoji ikona sprave (iste ikone kao na Unosu ocena, polje `sprave.ikona`). Naziv sprave je u `title` i `aria-label`. Ako sprava nema ikonu, ostaje tekst kao danas.

## Šta je prepušteno izvođaču

- Tačan algoritam koji zadovoljava pravila 1 do 9 (pohlepno punjenje po blokovima kategorija/klub je dovoljno ako testovi prolaze).
- Izgled dijaloga po postojećim dijalozima (`DijalogGrupa.jsx`) i `docs/VIZUELNI-SISTEM.md`; mora da stane na 1366x768.

## Testovi

- `raspored.mjs`: 48 takmičara / 6 sprava / max 6 daje 2 turnusa, mlađe kategorije u turnusu 1; nijedna grupa preko maksimuma; klub nije razdvojen kad staje; kategorija veća od turnusa se deli; max 4 i 4 sprave; prazan ulaz; bez kategorije na kraju.
- Migracija 008 na bazi sa postojećim grupama: sve su turnus 1, rotacije i Unos rade isto.
- Unos, zapisnici i napredak sa dva turnusa.
- QA u aplikaciji na probnoj bazi (nikad na `%APPDATA%\Gimnastika`).
