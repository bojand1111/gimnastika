# Automatski raspored i turnusi: plan izrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dugme „Rasporedi automatski” na Rotacijama pravi grupe i turnuse po kategoriji i klubu; turnusi rade u Rotacijama, Unosu, zapisnicima i Pregledu; ikone sprava na karticama grupa.

**Architecture:** Čista funkcija `rasporedi` u `electron/racun/raspored.mjs` računa raspored; model `grupe.cjs` ga upisuje u jednoj transakciji. Nova kolona `grupe.turnus` (migracija 008, podrazumevano 1). Svi potrošači grupa prvo filtriraju grupe po turnusu (`grupeTurnusa`), pa koriste postojeće `grupaNaSpravi`/`pozicijaURotaciji` nepromenjene.

**Tech Stack:** Electron 44, React 19, Vite, node:sqlite, node:test. Repo `C:\Posao\gimnastika`, testovi `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-12-raspored-turnusi-design.md`

## Global Constraints

- Sav tekst interfejsa srpski, latinica; bez em crte (U+2014) u tekstu, kodu i commit porukama.
- Nazivi u kodu i bazi srpski bez kvačica (`turnus`, `maksimum`, `poKategoriji`, `poKlubu`, `turnusPoKategoriji`); komentari kratki, srpski.
- Šema se menja samo novom migracijom `electron/baza/migracije/008_turnus.sql`; postojeće migracije se ne diraju.
- Ocene, prijave i podaci korisnika se nikad ne brišu; zamena rasporeda briše samo grupe (`grupe`, `grupa_clanovi`, `grupa_redosled`) tog takmičenja i pola.
- Tastatura pre miša; fokus vidljiv; ekran staje na 1366x768 bez vodoravnog skrola.
- Bez novih npm zavisnosti.
- Subagenti ne commit-uju i ne push-uju; Bojan odobrava svaki commit. Koraci „Commit” znače: zaustavi se, zapiši koje fajlove bi commit-ovao.
- QA samo na probnoj bazi (`GIM_PODACI` i `LOCALAPPDATA` u scratchpad), nikad `%APPDATA%\Gimnastika`.

## Review Focus

1. Postojeće takmičenje sa grupama posle migracije: sve grupe turnus 1, Unos, zapisnici i Pregled daju isto kao pre (Task 2 i Task 4 testovi).
2. Takmičenje bez grupa: Unos i zapisnici i dalje prikazuju „Svi prijavljeni” (Task 4 test).
3. Automatski raspored kad je uneta ocena: odbijen sa porukom, grupe netaknute (Task 2 test).
4. Hash sa turnusom koji ne postoji (`tu=5` kad postoji 1): pada na turnus 1 ili prvi nezavršen, bez greške (Task 4 i Task 5 testovi).
5. Prijava bez kluba i bez kategorije u automatskom rasporedu: ne puca, ide na kraj (Task 1 test).

---

### Task 1: Čista funkcija rasporeda

**Files:**
- Create: `electron/racun/raspored.mjs`
- Test: `tests/racun-raspored.test.mjs`

**Interfaces:**
- Produces:
  - `rasporedi(prijave, { brojSprava, maksimum, poKategoriji, poKlubu, turnusPoKategoriji = false })` vraća
    `{ turnusi: [{ turnus: 1, grupe: [{ pocetna_pozicija: 1, clanovi: [prijava_id, ...] }, ...] }, ...] }`.
    Ulazni element: `{ prijava_id, kategorija_id|null, kat_redosled|null, kategorija|null, program_id|null, prog_redosled|null, klub_id|null, klub_skr|null, prezime, ime }`. Ulaz se ne menja.
  - `sazetak(raspored, prijave)` vraća `{ ukupno, turnusi: [{ turnus, broj, kategorije: [naziv...], velicine: [n...] }] }` (kategorije jedinstvene, redom; bez kategorije je `'bez kategorije'`).

**Algoritam (presuda izvođača, spec ga prepušta):**
1. Sortiraj kopiju: kat_redosled (null na kraj), kategorija_id, prog_redosled (null na kraj), program_id, klub_skr, prezime, ime, prijava_id; tekst sa `new Intl.Collator('hr', { sensitivity: 'base' })` (isti kao `sortiranje.cjs`). Bez `poKategoriji` izbaci ključeve kategorije i programa iz sortiranja; bez `poKlubu` izbaci klub.
2. `kap = maksimum × brojSprava`. Sa `turnusPoKategoriji` (i `poKategoriji`): svaki blok kategorije (bez kategorije je poslednji blok) je svoj turnus; blok veći od kap deli se na `ceil(veličina / kap)` turnusa što ujednačenije (razlika najviše 1, po redu); korak 3 se preskače. Inače `T = ceil(n / kap)` i korak 3.
3. Turnusi: blokovi su uzastopne prijave iste kategorije (bez `poKategoriji` svaka prijava je svoj blok). Probaj sve podele blokova na T uzastopnih delova sa svakim delom ≤ kap; izaberi onu sa najmanjim najvećim delom, pa najmanjom razlikom. Ako nijedna ne postoji, puni redom: svaki turnus do kap, ostatak u sledeći (može da preseče kategoriju). Bez `poKategoriji` blokovi su pojedinačni pa ovo daje ujednačene turnuse.
4. Grupe u turnusu od m prijava: `k = min(brojSprava, m)` uzastopnih grupa od 1 do `maksimum`. Rezovi se biraju dinamičkim programiranjem po ceni, redom važnosti: što manje rezova usred kluba (klub se ne deli radi ujednačenosti; primer Memorijal 2025 ima grupe 1 do 5), pa što više rezova na granici kategorije, pa najmanji zbir kvadrata veličina (ujednačenost). (Prvobitno pohlepno pomeranje reza oko `ceil(ostalo / ostaloGrupa)` zamenjeno posle završne recenzije: delilo je klub iako je postojao raspored sa celim klubovima.)
5. `pocetna_pozicija` je redni broj grupe u turnusu (1..k).

- [ ] **Step 1: Napiši testove** (pomoćna `p(id, katRed, klub)` pravi prijavu; `kategorija_id = katRed`, `kategorija = 'K' + katRed`):
  - `48 takmicara, 6 sprava, max 6: dva turnusa po granici kategorija`: kategorije 1:12, 2:14, 3:10, 4:12; turnus 1 sadrži tačno kategorije 1 i 2 (26), turnus 2 kategorije 3 i 4 (22); svaki turnus 6 grupa; `pocetna_pozicija` 1..6.
  - `nijedna grupa preko maksimuma`: isti ulaz, max 5; svaka grupa ≤ 5, svi id-jevi tačno jednom.
  - `klub ostaje ceo kad staje`: jedna kategorija, klubovi veličina 5,5,4,4,4,4 (26), 6 sprava, max 6; svaka grupa je tačno jedan klub.
  - `klub veci od maksimuma se deli u susedne grupe`: 7 prijava istog kluba, 6 sprava, max 6; 6 grupa, zbir veličina 7, nijedna > 6.
  - `kategorija veca od turnusa: prvi turnus pun`: jedna kategorija 40, 6 sprava, max 6; turnus 1 ima 36, turnus 2 ima 4 u 4 grupe.
  - `ZSG: 4 sprave, max 4`: kategorije 9 i 11; dva turnusa 9 i 11, po 4 grupe, sve ≤ 4.
  - `prazan ulaz`: `{ turnusi: [] }`.
  - `bez kategorije i bez kluba ide na kraj`: jedna prijava sa `kat_redosled: null, klub_skr: null` je poslednji član poslednje grupe.
  - `bez poKategoriji: ujednaceni turnusi`: ulaz iz prvog testa, `poKategoriji: false`; turnusi 24 i 24.
  - `kategorije susedne u turnusu`: za prvi test redni broj kategorije kroz grupe 1..6 i članove u grupi nikad ne opada.
  - `sazetak`: za prvi test `{ ukupno: 48, turnusi: [{ turnus: 1, broj: 26, kategorije: ['K1','K2'], velicine: [...] }, ...] }`, zbir `velicine` jednak `broj`.
  - `ulaz se ne menja`: `structuredClone` pre i `deepEqual` posle.
  - `turnus po kategoriji: svaka kategorija svoj turnus` (oblik Memorijala 2025): kategorije 1:19, 2:22, 3:20, 4:13, 5:17, 6 sprava, max 6, `turnusPoKategoriji: true`; 5 turnusa, turnus i sadrži samo kategoriju i, svaki 6 grupa.
  - `turnus po kategoriji: kategorija veca od turnusa deli se ujednaceno`: jedna kategorija 40, max 6; turnusi 20 i 20.
  - `turnus po kategoriji: bez kategorije je poslednji turnus`: kategorije 1:8 i jedna prijava bez kategorije; 2 turnusa, drugi ima samo nju.
  - `klub se ne deli radi ujednacenosti`: jedna kategorija, klubovi 1,6,6,6,6,5 (30), 6 sprava, max 6; veličine grupa [1,6,6,6,6,5], svaka grupa jedan klub.
- [ ] **Step 2:** `node --test tests/racun-raspored.test.mjs`: FAIL (modul ne postoji).
- [ ] **Step 3:** Implementiraj po algoritmu iznad.
- [ ] **Step 4:** Isti test PASS; `npm test` sve prolazi.
- [ ] **Step 5: Commit** `feat(rotacije): racun automatskog rasporeda po turnusima` (fajlovi iz ovog taska).

### Task 2: Migracija 008 i model grupa

**Files:**
- Create: `electron/baza/migracije/008_turnus.sql`
- Modify: `electron/modeli/grupe.cjs`
- Test: `tests/baza.test.cjs`, `tests/modeli-grupe.test.cjs`

**Interfaces:**
- Consumes: `rasporedi`, `sazetak` (Task 1).
- Produces (u objektu koji vraća `napravi(baza)`):
  - `lista(takmicenjeId, pol)`: grupe sada imaju `turnus` (broj); sortirano `turnus, redosled, id`.
  - `dodaj(takmicenjeId, pol, turnus = 1)`: slovo naziva nastavlja se preko svih turnusa (postojeće ponašanje); `pocetna_pozicija = (broj grupa u tom turnusu % brojSprava) + 1`.
  - `izmeni(takmicenjeId, id, naziv, pocetnaPozicija, turnus)`: `turnus` ceo broj ≥ 1 i ≤ (najveći postojeći turnus + 1), inače `GreskaKorisnika('Turnus mora biti između 1 i N.')`; izostavljen `turnus` se ne menja.
  - `turnusi(takmicenjeId, pol)` vraća `[1, 2, ...]` (jedinstveni, rastuće; prazno ako nema grupa).
  - `zaRaspored(takmicenjeId, pol)` vraća sve prijave tog pola u obliku ulaza Task 1.
  - `predlogRasporeda(takmicenjeId, pol, { maksimum, poKategoriji, poKlubu, turnusPoKategoriji })` vraća `{ ...sazetak, imaGrupa: boolean, imaOcena: boolean }`.
  - `primeniRaspored(takmicenjeId, pol, parametri)` vraća `{ grupa: broj, turnusa: broj }`. Proverava `maksimum` ceo 1..30 (`'Najviše takmičara po grupi mora biti između 1 i 30.'`); ako postoji ocena sa statusom različitim od `'nacrt'` za prijavu tog takmičenja i pola: `GreskaKorisnika('Ocene su već unete. Automatski raspored nije moguć; grupe menjajte ručno.')`. U jednoj transakciji briše grupe tog takmičenja i pola (kaskadno `grupa_clanovi`, `grupa_redosled`) i upisuje nove: nazivi „Grupa A”, „Grupa B”... redom kroz sve turnuse, `redosled` 1..N globalno, `turnus`, `pocetna_pozicija`, članovi sa `redosled` 1..m. Ne dira `takmicenja.pomeraj_redosled`.

- [ ] **Step 1: Testovi.**
  - `baza.test.cjs`: dodaj `'008_turnus'` u očekivane liste migracija; novi test `migracija 008: postojece grupe dobijaju turnus 1` (baza do 007 sa jednom grupom; posle `migriraj()` `SELECT turnus` daje 1).
  - `modeli-grupe.test.cjs`:
    - `primeniRaspored: 48 prijava daje 12 grupa u 2 turnusa, nazivi Grupa A..Grupa L, svaka prijava u tacno jednoj grupi`.
    - `primeniRaspored: zamenjuje postojece grupe i brise rucni redosled` (pre toga ručna grupa i red u `grupa_redosled`; posle nema starih id-jeva, `grupa_redosled` prazan za takmičenje).
    - `primeniRaspored: odbija kad postoji uneta ocena` (ocena status `'uneto'`: baca tačnu poruku; broj grupa isti kao pre).
    - `primeniRaspored: ocena nacrt ne smeta`.
    - `primeniRaspored: ne dira drugi pol ni drugo takmicenje`.
    - `primeniRaspored: maksimum 0 i 31 odbijeni`.
    - `predlogRasporeda: ne menja bazu i javlja imaGrupa/imaOcena`.
    - `dodaj sa turnusom 2: pocetna pozicija racuna se u turnusu`.
    - `izmeni: turnus van opsega odbijen; bez turnusa ostaje isti`.
    - `turnusi: [1] za stare grupe, [1,2] posle rasporeda`.
- [ ] **Step 2:** `node --test tests/baza.test.cjs tests/modeli-grupe.test.cjs`: FAIL.
- [ ] **Step 3:** `008_turnus.sql`: `ALTER TABLE grupe ADD COLUMN turnus INTEGER NOT NULL DEFAULT 1;` i `CREATE INDEX IF NOT EXISTS ix_grupe_turnus ON grupe (takmicenje_id, pol, turnus, redosled);`. Implementiraj model.
- [ ] **Step 4:** Isti testovi PASS; `npm test` sve prolazi (ispravi samo očekivanja broja migracija u drugim testovima ako ih ima).
- [ ] **Step 5: Commit** `feat(rotacije): turnus grupa i automatski raspored u modelu`.

### Task 3: Turnus u računu napretka

**Files:**
- Modify: `electron/racun/grupe.mjs`, `electron/racun/napredak.mjs`
- Test: `tests/racun-grupe.test.mjs`, `tests/racun-napredak.test.mjs`

**Interfaces:**
- Produces:
  - `turnusGrupe(g)`: `Number(g.turnus) || 1`.
  - `turnusiGrupa(grupe)`: jedinstveni turnusi rastuće (`[]` za prazno).
  - `grupeTurnusa(grupe, turnus)`: grupe tog turnusa (nov niz).
  - `napredak(ocene, grupe, sprave, radiSpravu)` vraća dodatno `turnus` (turnus prve nepotpune rotacije, inače poslednji turnus; 1 kad nema grupa) i `broj_turnusa` (`turnusiGrupa(grupe).length || 1`). `rotacija` je unutar tog turnusa. Petlja: turnus, pa rotacija 1..n, pa grupe tog turnusa. `ukupno`/`obradjeno` su zbir svih turnusa. Sa grupama bez polja `turnus` rezultat je isti kao danas plus `turnus: 1, broj_turnusa: 1`.
  - `grupaNaSpravi` se ne menja (pozivaoci daju grupe jednog turnusa).
- [ ] **Step 1: Testovi:** `grupeTurnusa filtrira, grupe bez turnusa su turnus 1`; `turnusiGrupa`; `napredak: dva turnusa, turnus 1 gotov, turnus 2 rotacija 1 nepotpuna` daje `{ turnus: 2, rotacija: 1, broj_turnusa: 2 }`; `napredak: dve grupe na istoj spravi u razlicitim turnusima ne mesaju se`; postojeći testovi napretka prolaze (dopuni `deepEqual` očekivanja sa `turnus: 1, broj_turnusa: 1`).
- [ ] **Step 2:** FAIL. **Step 3:** implementacija. **Step 4:** PASS i `npm test`.
- [ ] **Step 5: Commit** `feat(rotacije): napredak po turnusima`.

### Task 4: IPC: Rotacije, Unos, zapisnici, Pregled

**Files:**
- Modify: `electron/moduli.cjs` (rotacije, unos, zapisnici), `electron/pregled-paket.cjs`, `electron/preload.cjs`, `electron/ipc.cjs` ako tamo stoji spisak kanala
- Test: onaj od `tests/ipc-faza*.test.cjs` gde su testovi `rotacije.podaci`, `unos.podaci`, zapisnika i pregleda

**Interfaces:**
- Consumes: Task 2 model, Task 3 `grupeTurnusa`, `turnusiGrupa`, `napredak` sa `turnus`.
- Produces (renderer API `gim.*`):
  - `gim.rotacije.podaci(rot, tu)`: dodato `turnus` (izabrani; 1 ako `tu` nije među turnusima), `turnusi` (niz; `[1]` kad nema grupa); `grupe` samo izabranog turnusa; svaka grupa dobija `turnus` i `sprava.ikona` (`sprave.ikona ?? ''`). `nerasporedjeni` ostaje cela lista.
  - `gim.rotacije.dodaj(tu)`: grupa u turnusu `tu` (podrazumevano 1).
  - `gim.rotacije.izmeni(id, naziv, pocetna, turnus)`.
  - `gim.rotacije.predlog({ maksimum, poKategoriji, poKlubu, turnusPoKategoriji })`: `predlogRasporeda`.
  - `gim.rotacije.rasporedi({ maksimum, poKategoriji, poKlubu, turnusPoKategoriji })`: `primeniRaspored`.
  - `gim.unos.podaci(sprava, rot, tu)`: dodato `turnus`, `turnusi`; grupa se traži u `grupeTurnusa(grupe, turnus)`. Bez `tu` (ili nepostojeći): `napredak.turnus`; bez `rot`: `napredak.rotacija` ako je turnus jednak `napredak.turnus`, inače 1. Automatski izbor sprave („nastavi gde se stalo”) radi nad grupama izabranog turnusa.
  - Prazni i popunjeni zapisnici: svaki list dobija `turnus` (broj) i `turnusa` (ukupno); listovi idu turnus, pa sprava, pa rotacija. Bez grupa `turnus: null`.
  - `pregled-paket.cjs` `napredakINastavi`: `grupaNaSpravi` nad `grupeTurnusa(grupe, napredak.turnus)`; `nastavi` dobija `turnus`; hash nastavka `#/unos?sprava=..&rot=..&tu=..`.
- [ ] **Step 1: Testovi** (u postojećem stilu IPC testova): `rotacije.podaci sa dva turnusa vraca samo grupe izabranog turnusa`; `rotacije.podaci tu=5 pada na 1`; `rotacije.rasporedi pa podaci: turnusi [1,2]`; `unos.podaci: turnus 2 sprava 1 rot 1 daje prvu grupu turnusa 2`; `unos.podaci bez tu nastavlja u prvom nezavrsenom turnusu`; `zapisnici sa dva turnusa: listovi turnus 1 pa turnus 2, polje turnus`; `bez grupa: Svi prijavljeni kao pre, turnus null`; postojeći testovi prolaze.
- [ ] **Step 2:** FAIL. **Step 3:** implementacija. **Step 4:** PASS i `npm test`.
- [ ] **Step 5: Commit** `feat(rotacije): turnus u unosu, zapisnicima i pregledu`.

### Task 5: Ekran Rotacije: turnus, dijalog rasporeda, ikone

**Files:**
- Create: `src/ekrani/rotacije/DijalogRaspored.jsx`
- Modify: `src/ekrani/Rotacije.jsx`, `src/ekrani/rotacije/RotTraka.jsx`, `src/ekrani/rotacije/RotKolona.jsx`, `src/ekrani/rotacije/DijalogGrupa.jsx`, `src/ekrani/rotacijeStanje.js`, CSS fajl sa `rot-*` klasama
- Test: `tests/rotacije-stanje.test.mjs`

**Interfaces:**
- Consumes: Task 4 API.
- Produces: `hashRotacija(rot, filter = '', tu = 1)` (bez `tu` u hashu kad je 1) i `parRotacije(hash)` vraća `{ rot, kp, tu }` (`tu` ceo ≥ 1, inače 1).

UI odluke:
- `RotTraka`: posle izbora rotacije izbor „Turnus” (isti stil `izbor` kao rotacija) samo kad `d.turnusi.length > 1`; dugme „Rasporedi automatski” (ikona iz postojećih u `Ikona.jsx`) levo od „Nova grupa”. „Nova grupa” zove `gim.rotacije.dodaj(d.turnus)`.
- `DijalogRaspored`: `<dialog>` kao `DijalogGrupa`. Polja: „Najviše takmičara po grupi” (number, 6, min 1, max 30), kućice „Ista kategorija zajedno”, „Isti klub zajedno” i „Svaka kategorija u svom turnusu” (sve uključene; treća onemogućena i šalje se kao false kad je prva isključena). Pregled se osvežava na svaku promenu pozivom `gim.rotacije.predlog`: po turnusu red „Turnus N: K1, K2 · X takmičara · grupe 5, 5, 4, 4, 4, 4”. Ako `imaOcena`: upozorenje „Ocene su već unete. Automatski raspored nije moguć; grupe menjajte ručno.” i „Rasporedi” onemogućeno. Ako `imaGrupa`: upozorenje „Postojeći raspored grupa biće obrisan i napravljen nov. Prijave i ocene ostaju.” Posle „Rasporedi” (uz `window.confirm` kad `imaGrupa`) poziva `gim.rotacije.rasporedi`, zatvara dijalog, prelazi na `hashRotacija(1, filter, 1)` i učitava; toast „Raspoređeno: N grupa u T turnusa.” (za T = 1: „u 1 turnusu”).
- `DijalogGrupa`: polje „Turnus” (number, min 1) samo kad postoji više od jednog turnusa ili je grupa u turnusu većem od 1; šalje se u `izmeni`.
- `RotKolona`: umesto `<span className="status status-info">{naziv}</span>` prikaži `<Ikona ime={sprava.ikona} velicina={22} />` u elementu sa `title` i `aria-label` jednakim nazivu sprave; kad je `ikona` prazna, ostaje tekst kao danas.
- [ ] **Step 1: Testovi** za `hashRotacija`/`parRotacije` sa `tu` (round-trip; `tu=0` i `tu=x` daju 1; bez `tu` je 1; `hashRotacija(2,'',1)` nema `tu`).
- [ ] **Step 2:** FAIL. **Step 3:** implementacija. **Step 4:** PASS, `npm test`, `npm run build` bez greške.
- [ ] **Step 5: Commit** `feat(rotacije): dijalog automatskog rasporeda, turnus i ikone sprava`.

### Task 6: Unos, zapisnici i Pregled: prikaz turnusa

**Files:**
- Modify: `src/ekrani/unosStanje.js` (`hashUnos`, `parUnos`), `src/ekrani/Unos.jsx`, `src/ekrani/unos/UnosTraka.jsx`, `src/ekrani/zapisniciStanje.js` (`naslovZapisnika`), `src/ekrani/Zapisnici.jsx`, `src/ekrani/Prazno.jsx`, `src/ekrani/pocetnaStanje.js` (`tekstRotacije`, `tekstPlocice`, `hashNastavi` ako gradi hash Unosa)
- Test: `tests/unos-stanje.test.mjs`, `tests/zapisnici-stanje.test.mjs`, `tests/pocetna-stanje.test.mjs`

**Interfaces:**
- Consumes: Task 4 (`turnus`, `turnusi`, `turnusa`, `napredak.turnus`, `napredak.broj_turnusa`).
- Produces: `hashUnos(spravaId, rot, tu)` (bez `tu` kad je null/undefined), `parUnos(hash)` vraća dodatno `tu` (null kad ga nema).
- Unos traka: izbor „Turnus” pored rotacije, samo kad `d.turnusi.length > 1`; linkovi sprava i rotacija nose `tu`.
- Zapisnici i prazni zapisnici: kad je `list.turnusa > 1`, iznad „Rotacija R” piše „Turnus T”, i `naslovZapisnika` uključuje „Turnus T” u istom stilu kao postojeći format.
- `tekstRotacije(napredak)`: kad je `broj_turnusa > 1`, tekst počinje sa „Turnus T, ” pa postojeći tekst.
- [ ] **Step 1: Testovi** za `hashUnos`/`parUnos` sa `tu`, `naslovZapisnika` sa turnusom i bez, `tekstRotacije` sa `broj_turnusa: 2` i bez polja (isto kao danas).
- [ ] **Step 2:** FAIL. **Step 3:** implementacija. **Step 4:** PASS, `npm test`, `npm run build`.
- [ ] **Step 5: Commit** `feat(unos): izbor turnusa i turnus na zapisnicima`.

### Task 7: QA u aplikaciji (bez koda)

- [ ] Pokreni probnu aplikaciju (CDP, probna baza sa 48 MSG prijava u 4 kategorije). Proveri na 1366x768:
  - Rotacije: „Rasporedi automatski”; pregled pokazuje 2 turnusa; „Rasporedi” daje turnus 1 i 2 na traci, 6 grupa svaki, ikone sprava na karticama, fokus vidljiv, ceo tok tastaturom.
  - Prevlačenje kartice i izmena turnusa grupe i dalje rade.
  - Unos: izbor turnusa, grupa turnusa 2 na spravi 1.
  - Zapisnici i prazni zapisnici: listovi turnusa 1 pa 2 sa natpisom.
  - Pregled: „Turnus 1, rotacija ...”.
  - Takmičenje sa starim grupama (bez rasporeda): izgleda kao pre, nema izbora turnusa.
- [ ] Zapiši šta je izvršeno, a šta nije; ne commit-uj.
