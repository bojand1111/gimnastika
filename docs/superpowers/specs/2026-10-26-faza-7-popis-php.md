# Faza 7: popis PHP ponašanja (Početna, Pregled takmičenja, Rezervna kopija, uvoz PHP kopije)

Izvor: PHP 1.2.0 u `C:\Users\bojan\Desktop\Takmicarski program` (`app/Kontroleri/{pocetna,takmicenje,kopija}.php`,
`app/Pogledi/{pocetna,takmicenje,koraci,klubovi_stanje,stanje_oznake,kopija}.php`, `app/Jezgro/{Kopija,Zip,SqlDelilac,Migracije,Aplikacija,Podesavanja}.php`,
`app/Jezgro/pomocne.php`, `docs/INSTALACIJA.md`, `docs/TOK-PRIPREME.md`, slike `01-pocetna.png`, `10-rezervna-kopija.png`).
Tekstovi su doslovni. Gde se slika i kod razlikuju, važi kod (pravilo iz faze 2).

## 0. Obim i šta se ne prenosi

- Prenosi se: Početna (`pocetna`), Pregled takmičenja (`takmicenje`), Rezervna kopija (`kopija`: lista, napravi, vrati, fascikla),
  kopija pre migracija i pre ažuriranja, uvoz PHP zip kopije u SQLite, uputstvo za instalaciju, verzija 1.0.0.
- Ne prenosi se (PHP i XAMPP specifično): `instalacija.php` (ekran Prvo pokretanje), `Zakrpa.php` i deo „Ažuriranje“ sa zip zakrpom
  (zamena: postojeći electron-updater, kartica `AzuriranjeKartica` iz `src/okvir/Azuriranje.jsx` se seli na ekran Rezervna kopija),
  `kopija/preuzmi` (download preko HTTP; zamena: „Prikaži u fascikli“ kroz `shell.showItemInFolder`), `maksUpload` (nema upload-a),
  CSRF, `paket/` (PHP instaler, uklanjanje sa završnom kopijom).
- Već postoji u Electronu i koristi se: `Koraci.jsx` + `koraciStanje.js` (traka koraka, POPIS faze 3 odeljak 5), `StanjeOznake.jsx`,
  `prijave.stanjePripreme` (sa `redosled_klubova`), `prijave.lekarskiUpozorenja(pragDana)`, `prijave.brojevi(tid)`, `ocene.napredak(tid, pol, grupe, sprave)`,
  `racun/grupe.mjs grupaNaSpravi`, `racun/lekarski.mjs`, `gim.takmicenja.otvori(id)` (vraća `{korak, naziv, stanje}`; renderer emituje `app:aktivno`
  i ide na `#/prijave`, `#/rotacije` ili `#/takmicenje`), `gim.takmicenja.sva()` (svaki red ima `status` i `stanje`), `Azuriranje.jsx`,
  `electron/uvoz/zip.cjs` (`lista`, `procitaj`, `napravi`), App `app:kopija` na Ctrl+S (već u `precice.js` i `App.jsx`), stavke menija
  `pocetna`, `takmicenje` (naslov „Pregled“), `kopija` (naslov „Rezervna kopija“).

## 1. Početna (`pocetna`)

### 1.1 Kontroler (`pocetna.php`)
- `aktivnoId = app.aktivnoId()`; `takm = app.aktivno` (red takmičenja ili null).
- `ostala`: sva takmičenja (`Takmicenja::sva()`, redosled po datumu opadajuće pa id) bez aktivnog; svako dobija `stanje = stanjePripreme(id)`.
- `stanje` aktivnog: `stanjePripreme(aktivnoId)` ili null.
- `lekarski = lekarskiUpozorenja(podesavanja.dajInt('lekarski_prag_dana', 30))`.
- `poslednjaKopija = kopija.lista()[0] ?? null` (najnovija po vremenu fajla).
- Naslov ekrana: „Početna“.

### 1.2 Pogled (`pocetna.php`)
- `precice = [['Unos ocena', ['F2']], ['Rang liste', ['F4']], ['Sledeće polje', ['Tab', 'Enter']], ['Otkaži izmenu', ['Esc']], ['Novi zapis', ['Alt', 'N']]]`.
- `danas = poslednjaKopija && date('Y-m-d', vreme) === date('Y-m-d')` (lokalni datum fajla jednak današnjem).
- `imaNedovrseno = stanje !== null && stanje.prijava > 0 && (nepotpune > 0 || nerasporedjeni > 0 || nepotvrdjeni_klubovi > 0)`.
- Raspored: `div.red` > `div.kolona.raste` (levo) + `div.kolona` širine 340px, `flex-shrink:0` (desno).

Levo, kad `takm === null`:
- `section.kartica > div.prazno-stanje`: `h2` „Nema aktivnog takmičenja“; `p` „Napravite novo takmičenje“ + (ako `ostala` nije prazno) „ ili otvorite neko od postojećih iz liste ispod“ + „. Aktivno takmičenje je ono u koje idu prijave, rotacije, ocene i rang liste.“;
  link `#/takmicenja/novo` klase `dugme dugme-glavno dugme-veliko`, `data-fokus` (autofokus), ikona `plus` 16 + „Novo takmičenje“.

Levo, kad ima aktivnog:
- `section.kartica` (`padding:20px 24px; gap:12px`):
  - red: `span.status.status-ok` ikona `kvacica` 13 + „Aktivno takmičenje“; ako `zavrseno === 1` i `span.status` „Završeno“; desno link `#/takmicenja` klase `dugme dugme-tekst dugme-malo` „Sva takmičenja“ (slika 01 kaže „Promeni aktivno takmičenje“: važi kod).
  - `h2` naziv (`font-size:28px; line-height:36px; font-weight:800; letter-spacing:-0.02em`).
  - `div.sek` (flex, wrap, `gap:4px 20px`, 15px): ikona `meni-takmicenja` 16 + „{dan_u_nedelji(datum)}, “ + `span.broj` `datum_prikaz(datum)`; `mesto` ako nije prazno; `StanjeOznake(stanje)`.
  - red dugmadi (`gap:8px; padding-top:4px`): ako `stanje.korak === 'spremno'`: link `#/takmicenje` `dugme dugme-glavno dugme-veliko` `data-fokus` „Otvori takmičenje“ + ikona `strelica-desno` 16; inače link na `#/prijave` (korak `prijave`) ili `#/rotacije` (ostalo), isti stil, tekst „Nastavi pripremu: Prijave“ ili „Nastavi pripremu: Rotacije“ + ikona;
    zatim link `#/unos` `dugme dugme-veliko` „Unos ocena“ + `kbd` F2; link `#/rang` `dugme dugme-veliko` „Rang liste“ + `kbd` F4.
- `section.kartica` (`overflow:hidden`): zaglavlje `h2.kartica-naslov` „Priprema po klubovima“; ako `stanje.prijava > 0`: `span.status` `status-warn` sa ikonom `upozorenje` 13 „Nije sve dovršeno“ kad `imaNedovrseno`, inače `status-ok` ikona `kvacica` „Sve je dovršeno“.
  Telo: ako `stanje.klubovi` prazno: `p.prazno` „Još nema prijava. “ + link `#/prijave` „Prijavite takmičare.“; inače tabela `klubovi_stanje` (1.3).
- Ako `ostala` nije prazno: `section.kartica` (`overflow:hidden`): zaglavlje `h2.kartica-naslov` „Takmičenja“ (kad nema aktivnog) ili „Ostala takmičenja“; desno link `#/takmicenja/novo` `dugme dugme-malo` ikona `plus` 14 „Novo takmičenje“.
  `table.tabela.tabela-zbijena`, `thead`: „Naziv i mesto“, „Datum“ (100px), „Status“ (100px), „Priprema“ (290px), prazno (90px).
  Red (`height:48px`): kolona 1 `span` kolona (`line-height:17px; min-width:0`): `span.odseci` bold naziv, `span.mali.sivo.odseci` mesto; kolona 2 `span.broj` `datum_prikaz`; kolona 3 `span.status` „Završeno“ kad `zavrseno === 1`, inače `span.status.status-info` „U pripremi“;
  kolona 4 `StanjeOznake(t.stanje)`; kolona 5 (`desno`) dugme „Otvori“ (`dugme dugme-malo`, PHP: POST `takmicenja/otvori` sa id; Electron: `gim.takmicenja.otvori(id)` isto kao na ekranu Takmičenja).

Desno (`width:340px`):
- `section.kartica` (`overflow:hidden`) „Lekarski pregledi“: u zaglavlju `span.status.status-bad` ikona `upozorenje` 13 + broj kad ima upozorenja, inače `span.status.status-ok` ikona `kvacica` „U redu“.
  Kad nema: `p.sivo` (`padding:12px 16px; font-size:13px`) „Svim prijavljenima na nezavršena takmičenja lekarski važi.“
  Kad ima: `div` (`max-height:264px; overflow:auto`) sa redovima (`min-height:44px; padding:4px 16px; border-bottom:1px solid var(--line)`): levo kolona `span.odseci` bold „{prezime} {ime}“, `span.mali.sivo.odseci` sa `title` = naziv takmičenja: „{klub_skr ?? 'bez kluba'} · {takmicenje}“;
  desno: `lek.stanje === 'nema'` → `span.status.status-bad` „Nema lekarskog“; `'istekao'` → `span.status.status-bad` `title`="Ne važi na dan takmičenja ({datum_prikaz(datum)})" „Važio do “ + `span.broj` `datum_prikaz(lekarski_do)`;
  inače (`istice`) → `span.status.status-warn` `title`="Važi na dan takmičenja ({datum_prikaz(datum)}), ali ističe ubrzo posle" „Važi do “ + `span.broj` datum.
  Ispod: `p.sivo.mali` (`padding:8px 16px`) „Prijavljeni na nezavršena takmičenja. Datum lekarskog se menja u kartonu takmičara.“
- `section.kartica` „Poslednja rezervna kopija“, `div.kartica-telo`: red: `span.broj` (`font-size:22px; line-height:28px; font-weight:600`) `date('d.m.Y. H:i', vreme)` ili „Još nema kopije“; desno `span.status.status-ok` ikona `kvacica` „Danas“ kad `danas`, inače (kad kopija postoji) `span.status.status-warn` ikona `upozorenje` „Nije od danas“.
  Dugme `dugme` širine 100% ikona `kopija` 16 „Napravi rezervnu kopiju“ (PHP: POST `kopija/napravi` sa `nazad=pocetna`, posle poruke ostaje na Početnoj). Link `#/kopija` `dugme dugme-tekst dugme-malo` „Sve kopije i vraćanje“.
- `section.kartica` „Prečice na tastaturi“: `div` (`padding:6px 16px 14px`, kolona) sa redovima (`height:32px; border-bottom:1px solid var(--line)`, space-between): tekst + `span.precice` sa `kbd` po tasteru.

### 1.3 Deo `klubovi_stanje` (isti na Početnoj i Pregledu)
`table.tabela.tabela-zbijena`, `thead`: „Klub“, „Prijava“ (`desno`, 66px), „Prijave“ (120px), „Spisak“ (124px), „Rotacije“ (132px).
Po klubu iz `stanje.klubovi` (Electron: redosled `stanje.redosled_klubova`, 0 = bez kluba na kraju): kolona 1 `title` = puno ime; `kid === 0` → `span.sivo` „bez kluba“, inače `span.skr` skraćenica + razmak + `span.sivo` puno ime;
kolona 2 `desno` `span.broj` prijava; kolona 3 `nepotpune > 0` → `span.status.status-bad` ikona `upozorenje` 13 „Nepotpune: {n}“ inače `span.status.status-ok` ikona `kvacica` „Potpune“;
kolona 4 `kid === 0` → `span.sivo` „–“; `potvrdjeno` → `status-ok` ikona `kvacica` „Potvrđen“; inače `span.status.status-warn` „Nije potvrđen“;
kolona 5 `nerasporedjeni > 0` → `span.status.status-warn` „Neraspoređeni: {n}“ inače `status-ok` ikona `kvacica` „Raspoređeni“.

### 1.4 Pomoćne funkcije (`pomocne.php`)
- `dan_u_nedelji(ymd)`: `['Nedelja','Ponedeljak','Utorak','Sreda','Četvrtak','Petak','Subota'][date('w')]`; neispravan datum → ''.
- `velicina_prikaz(b)`: `>= 1048576` → `number_format(b/1048576, 1, ',', '.') . ' MB'`; `>= 1024` → `number_format(b/1024, 0, ',', '.') . ' KB'`; inače `b . ' B'`. (Primer: 2516582 → „2,4 MB“; 39695 → „39 KB“; 147 → „147 B“; hiljade sa tačkom: 1536000 → „1.500 KB“.)
- `pol_naziv`: `M` → „MSG“, `Z` → „ŽSG“, inače ''.
- `date('d.m.Y. H:i', vreme)` lokalno vreme fajla, npr. „17.10.2026. 09:42“.

## 2. Pregled takmičenja (`takmicenje`)

### 2.1 Kontroler (`takmicenje.php`)
- `takm = app.trazimAktivno()` (bez aktivnog: greška „Nema aktivnog takmičenja.“ i povratak; Electron: `obradiNemaAktivnog`).
- `pomeraj = takm.pomeraj_redosled === 1`.
- Napredak i „gde se stalo“: za `pol` u `['Z', 'M']` redom: `grupe = grupe.lista(tid, pol)`; prazno → preskoči. `sprave = sifarnici.sprave(pol)`;
  `n = ocene.napredak(tid, pol, grupe, sprave, pomeraj)`; `n.pol = pol`. Ako je `napredak === null || !n.gotovo`: `napredak = n`, pa `nastavi = null` i za svaku spravu
  `s` (indeks `i`): `g = grupaNaSpravi(grupe, i + 1, n.rotacija, max(1, count(sprave)), pomeraj)`; `null` → dalje; `ids` = prijava_id članova; `oc = ocene.zaSpravu(s.id, ids)`;
  `uneto` = broj `ids` čiji je `oc[pid].status ?? 'nacrt'` različit od `'nacrt'`; ako `uneto < count(ids)`: `nastavi = {sprava: s, rotacija: n.rotacija, uneto, ukupno: count(ids), pol}` i prekid petlje po spravama.
  Ako `!n.gotovo`: prekid petlje po polovima. (Dakle: prvi pol koji nije gotov; ako su oba gotova, ostaje poslednji sa grupama, tj. M.)
- `brojevi = prijave.brojevi(tid)` (`{prijava, klubova}`), `stanje = stanjePripreme(tid)`. Naslov ekrana „Pregled takmičenja“.

### 2.2 Pogled (`takmicenje.php`)
- Prvo `Koraci(stanje, 'pregled', takm.id)`.
- `div.red > div.kolona.raste`:
  - `section.kartica` (`padding:20px 24px; gap:12px`): red sa `span.status.status-ok` ikona `kvacica` 13 „Aktivno takmičenje“ (+ `span.status` „Završeno“ kad `zavrseno === 1`); desno dva linka `dugme dugme-tekst dugme-malo`: „Izmeni podatke“ → `#/takmicenja/izmeni?id={id}`, „Sva takmičenja“ → `#/takmicenja`.
    `h2` naziv (`font-size:32px; line-height:40px; font-weight:800; letter-spacing:-0.02em`).
    `div.sek` (flex, wrap, `gap:4px 20px`, 15px): ikona `meni-takmicenja` 16 + „{dan_u_nedelji}, “ + `span.broj` datum; mesto ako nije prazno; „{broj_e_sudija} E sudija“ (1) ili „... E sudije“ (ostalo); „Organizator: {organizator}“ ako nije prazno; „Domaćin: {domacin}“ ako nije prazno.
    `div.mreza-3` sa tri `div.plocica-broj` (`span.broj` + `span`): `brojevi.prijava` „prijavljenih takmičara“; `brojevi.klubova` „klubova“; `napredak ? rotacija + ' / ' + ukupno_rotacija : '–'` sa tekstom `napredak ? (gotovo ? 'sve rotacije su unete' : 'rotacija u toku (' + pol_naziv(pol) + ')') : 'grupe još nisu napravljene'`.
  - `div.mreza-2`: link `a.velika-plocica.velika-plocica-crvena` (`min-height:168px`, `data-fokus`) na `#/unos?pol=&sprava=&rot=` kad `nastavi` postoji (`pol`, `sprava.id`, `rotacija`), inače `#/unos`:
    prvi red ikona `meni-unos-ocena` 24 + `kbd` F2 (bela: `background:rgba(255,255,255,0.16); border-color:rgba(255,255,255,0.55); color:#fff`); `span.velika-plocica-naslov` „Unos ocena“;
    `span` 15px: `nastavi ? 'Nastavi: ' + sprava.naziv + ' · Rotacija ' + rotacija + ' · uneto ' + uneto + ' od ' + ukupno : (napredak && napredak.gotovo ? 'Sve ocene su unete' : 'Prepisivanje ocena sa sudijskih listića')`.
    Link `a.velika-plocica` (`min-height:168px`) na `#/rang`: ikona `meni-rang-liste` 24 + `kbd` F4; naslov „Rang liste“; `span.sek` 15px „Po spravi, višeboj i ekipno“.
  - `section.kartica` (`overflow:hidden`): zaglavlje „Priprema po klubovima“ + `StanjeOznake(stanje)`; telo kao 1.2 (prazno: „Još nema prijava. “ + link „Prijavite takmičare.“; inače `klubovi_stanje`).
- Meni: stavka „Pregled“ (`takmicenje`) istaknuta.

## 3. Rezervna kopija (`kopija`)

### 3.1 Jezgro `Kopija.php`
- `VRSTE = {rucna: 'Ručna', pre_vracanja: 'Pre vraćanja', pre_azuriranja: 'Pre ažuriranja', pre_migracije: 'Pre migracije', uvoz: 'Uvezena'}`.
- `napravi(vrsta = 'rucna')`: pravi fasciklu ako ne postoji (greška „Ne mogu da napravim fasciklu {fascikla}“); ime `kopija_` + `date('Y-m-d_Hi')`; ako fajl postoji dodaje `_2`, `_3`...;
  `opis = {aplikacija: 'gimnastika', verzija: APP_VERZIJA, baza_verzija: verzijaBaze(), vreme: 'Y-m-d H:i:s', vrsta}`; zip sa `opis.json` i `baza.sql`; vraća punu putanju.
- `verzijaBaze()`: `MAX(verzija)` iz tabele `migracije` (0 bez tabele).
- `opis(putanja)`: zip mora imati `opis.json` i `baza.sql` (greška „Fajl nije rezervna kopija ove aplikacije (nedostaje opis.json ili baza.sql).“); `aplikacija` mora biti `gimnastika` (greška „Opis kopije nije ispravan.“); vraća `{verzija, baza_verzija, vreme, vrsta}` (podrazumevano '', 0, '', '').
- `vrati(putanja)`: `version_compare(opis.verzija, APP_VERZIJA, '>')` → greška „Kopija je iz novije verzije aplikacije ({v}) nego što je instalirana ({app}). Prvo ažurirajte aplikaciju.“; izvršava naredbe iz `baza.sql`;
  greška na naredbi: „Vraćanje prekinuto na naredbi {i} od {n}: {poruka}“. Pozivalac pre toga pravi kopiju `pre_vracanja` i posle pokreće migracije.
- `lista()`: svi `*.zip` u fascikli, za svaki `{putanja, ime, velicina (filesize), vreme (filemtime), opis (ili null kad opis baci grešku)}`, sortirano po `vreme` opadajuće.
- `putanja(ime)`: ime mora biti `^[A-Za-z0-9_.-]+\.zip$` bez `..` („Nevažeće ime fajla.“) i fajl mora postojati („Fajl ne postoji: {ime}“).
- `Podesavanja::fasciklaKopija()`: ključ `kopije_fascikla` bez završnih kosih crta; ako nije prazan i fascikla postoji, ta; inače podrazumevana (`ROOT/kopije`; Electron: `%APPDATA%\Gimnastika\kopije`, `putanje.fasciklaKopija()`).
  Komentar iz PHP-a: ako izabrana fascikla ne postoji (USB isključen, baza vraćena sa drugog računara) koristi se podrazumevana.
- `Aplikacija::pokreniMigracije()`: kad ima migracija na čekanju i baza nije prazna, prvo kopija `pre_migracije` (dnevnik „Kopija pre migracije: {ime}“), pa migracije; poruka `info` „Baza je ažurirana (migracije: {lista}). Kopija je napravljena pre ažuriranja.“
- `Zakrpa::primeni`: kopija `pre_azuriranja` pre primene (Electron: `preInstalacije` u `createUpdater`, main.cjs komentar „Faza 7: ovde kopija baze vrste pre_azuriranja.“).

### 3.2 Kontroler (`kopija.php`)
- `index`: `kopije = lista()`, `fascikla`, `podrazumevana = podesavanja.daj('kopije_fascikla') === ''`, `bazaVerzija = migracije.trenutnaVerzija()`. Naslov „Rezervna kopija“.
- `napravi` (POST): `f = napravi('rucna')`; dnevnik „Rucna kopija: {ime}“; poruka `ok` „Rezervna kopija je napravljena: {ime} ({velicina_prikaz}).“; nazad na Početnu kad je `nazad=pocetna`, inače na `kopija`.
- `vrati` (POST): fajl iz upload-a (čuva se kao `kopija_{Y-m-d_Hi}_uvoz.zip` u fascikli) ili `f` iz liste; `opis(f)`; provera novije verzije (ista poruka kao u 3.1); `sigurnosna = napravi('pre_vracanja')`; `n = vrati(f)`; `pokreniMigracije()`;
  dnevnik „Vracena kopija {ime} ({n} naredbi), stanje pre vracanja: {sigurnosna}“; poruka `ok` „Podaci su vraćeni iz {ime} (verzija {v}, {vreme}). Stanje pre vraćanja je sačuvano kao {sigurnosna}.“;
  greška (bilo koja): dnevnik + poruka `greska` „Vraćanje nije uspelo: {poruka}“. Uvek nazad na `kopija`.
- `fascikla` (POST): `nova` = unos bez završnih kosih crta i razmaka; prazno → `kopije_fascikla = ''` i poruka `ok` „Kopije se ponovo čuvaju u podrazumevanoj fascikli.“; ne postoji i ne može da se napravi → `greska` „Fascikla ne postoji i ne može da se napravi: {nova}“;
  proba upisa fajla `.proba_xxxxxx` → neuspeh `greska` „U fasciklu ne može da se upisuje: {nova}“; uspeh → `kopije_fascikla = nova`, poruka `ok` „Fascikla za kopije je promenjena: {nova}“.
- `zakrpa`: ne prenosi se.

### 3.3 Pogled (`kopija.php`)
- `poslednjaTekst`: „Još nema nijedne kopije.“ ili „Poslednja kopija: “ + (isti dan → „danas u {H:i}“, inače „{d.m.Y. H:i}“) + „.“.
- `div.mreza-2`:
  - `section.kartica` (`padding:20px; gap:12px`): `h2.kartica-naslov` 18px „Napravi rezervnu kopiju“; `p.sek` „Čuva celu bazu, sva takmičenja i sve ocene u jedan fajl. {poslednjaTekst}“; dugme `dugme dugme-glavno dugme-veliko` `data-fokus` ikona `kopija` 16 „Napravi rezervnu kopiju“ + `kbd` Ctrl+S.
  - `section.kartica`: „Vrati iz kopije“; `p.sek` „Zamenjuje sve trenutne podatke podacima iz kopije. Pre vraćanja se automatski pravi kopija trenutnog stanja.“; forma: `input[type=file]` (`accept=.zip`, aria „Fajl kopije“) + dugme `dugme dugme-opasno dugme-veliko` ikona `vracanje` 16 „Vrati iz kopije“,
    potvrda „Vratiti podatke iz izabranog fajla? Svi trenutni podaci se zamenjuju (pre toga se pravi kopija trenutnog stanja).“; `span.sivo.mali` „Fajl može biti i sa drugog računara (npr. sa USB-a). Najveća veličina: {maksUpload}.“ (Electron: bez „Najveća veličina“).
- `section.kartica` (red, `align-items:center; gap:12px; padding:12px 16px`): ikona `fascikla` 18; kolona (`flex:1 1 0; min-width:0`): `span.oznaka` „Fascikla za kopije“ + „ (podrazumevana)“ kad `podrazumevana`; `span.broj` bold putanja (sa obrnutom kosom crtom na Windows-u, `overflow:hidden; text-overflow:ellipsis`);
  forma: `input.unos` širine 340px, placeholder „npr. E:\Gimnastika\kopije (prazno = podrazumevana)“, aria „Nova fascikla“ + dugme `dugme` „Promeni fasciklu“.
- `section.kartica` (`overflow:hidden`): zaglavlje „Prethodne kopije“ + `span.broj.sivo` (13px, 600) broj kopija. `table.tabela`, `thead`: „Datum i vreme“ (170px), „Fajl“, „Veličina“ (`desno`, 100px), „Vrsta“ (150px), „Verzija“ (100px), prazno (210px).
  Bez kopija: red `td[colspan=6].prazno` „Još nema rezervnih kopija.“ Red: `span.broj` `d.m.Y. H:i`; `span.broj` ime; `desno` `span.broj` veličina; vrsta `VRSTE[opis.vrsta] ?? opis.vrsta`, a bez opisa `span.status.status-bad` „neispravan fajl“; `span.broj.sivo` verzija (prazno bez opisa);
  `desno`: link „Preuzmi“ (`dugme dugme-malo dugme-tekst`; Electron: „Prikaži u fascikli“), i kad ima opisa dugme „Vrati ovu“ (`dugme dugme-malo`) sa potvrdom „Vratiti podatke iz {ime}? Svi trenutni podaci se zamenjuju (pre toga se pravi kopija trenutnog stanja).“
- `section.kartica` „Ažuriranje“ sa zakrpom: ne prenosi se; na tom mestu ide `AzuriranjeKartica` (tekst „Trenutna verzija: {v}“, dugme „Proveri ažuriranje“).
- Skripta: Ctrl+S (i Cmd+S) na ovom ekranu šalje formu „napravi“ (Electron: `app:kopija` događaj iz App-a; drugi ekrani ga ne hvataju).

## 4. Format PHP kopije (za uvoz u SQLite)

- Zip (`Zip.php`, store ili deflate, bez zip64) sa tačno dve stavke: `opis.json` i `baza.sql`. Electron čita ga sa `electron/uvoz/zip.cjs` (`lista`, `procitaj`).
- `opis.json`: `{"aplikacija": "gimnastika", "verzija": "1.1.1", "baza_verzija": 2, "vreme": "2026-10-01 22:11:32", "vrsta": "pre_migracije"}` (verzija PHP aplikacije; poslednja PHP verzija je 1.2.0, baza_verzija najviše 4).
- `baza.sql` (`Kopija::upisiSql`): zaglavlje sa komentarima `-- ...`, zatim `SET NAMES utf8mb4;`, `SET FOREIGN_KEY_CHECKS=0;`, `SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';`, pa po tabeli (abecedno, kako MariaDB vrati `SHOW TABLES`):
  `-- Tabela: ime`, `DROP TABLE IF EXISTS \`ime\`;`, pun `CREATE TABLE \`ime\` (...) ENGINE=InnoDB ...;`, pa `INSERT INTO \`ime\` (\`k1\`, \`k2\`) VALUES\n(...),\n(...);` u paketima po 200 redova; na kraju `SET FOREIGN_KEY_CHECKS=1;` i `-- kraj`.
- Literali (`Kopija::literal` + PDO quote): `NULL`; int/float bez navodnika; sve ostalo (uključujući DECIMAL i DATETIME, koje PDO vraća kao string) u jednostrukim navodnicima sa MySQL escape-om (`\'`, `\\`, `\n`, `\r`, `\0`, `\Z`...; PDO MySQL koristi backslash, ne dupli navodnik).
  Primer: `(1, 1, 1, '4.200', '8.700', '0.000', '12.900', 'uneto', 0, '2026-10-01 18:44:06', ...)`.
- Deljenje na naredbe: `SqlDelilac::podeli` (poštuje `'`, `"`, `` ` `` stringove sa backslash escape-om i dupliranim navodnikom, komentare `-- `, `#`, `/* */`; deli na `;`).
- Tabele PHP šeme (migracije 001 do 004) i mapiranje u SQLite (iste tabele i kolone, `electron/baza/migracije/001..004`):
  `podesavanja`, `klubovi`, `takmicari`, `kategorije`, `programi`, `sprave`, `takmicenja` (+`domacin`, `grb_levo`, `grb_desno` od 002), `prijave`, `prijava_sprave`, `grupe`, `grupa_clanovi`, `ocene`, `ocene_e`, `izmene_ocena`, `potvrde_klubova` (003), `grupa_redosled` (004), `migracije` (PHP: `verzija INT, naziv, primenjeno`; SQLite: `ime TEXT, primenjeno`; ne uvozi se).
- Pretvaranje vrednosti: `DECIMAL(6,3)` kolone `ocene.d/e/odbitak/konacna` i `ocene_e.vrednost` → celi hiljaditi delovi (`'4.200'` → 4200; isto kao `racun/broj.mjs` `izBaze`/parsiranje sa tačkom); `TINYINT(1)` → 0/1 kako jeste; `DATE`/`DATETIME` ostaju tekst
  (`0000-00-00` nije moguće: PHP pravi `NULL`); `izmene_ocena.staro/novo` JSON tekst ostaje; `podesavanja`: ključevi `kopije_fascikla`, `grb_levo`, `grb_desno` se ne uvoze (putanje PHP instalacije), `aktivno_takmicenje` se uvozi;
  `takmicenja.grb_levo/grb_desno` → `''` (fajlovi iz `public/grb` nisu u kopiji).
- Verzija kopije mora biti PHP verzija ≤ 1.2.0 i `aplikacija === 'gimnastika'`; kopija starije PHP verzije (manje kolona) je u redu jer `INSERT` navodi kolone, a SQLite šema ima podrazumevane vrednosti.

## 5. Uputstvo (`docs/INSTALACIJA.md` PHP verzije)

Struktura koju Electron uputstvo zadržava (za nekoga ko nije programer, Windows, bez interneta): 1. Instalacija na novi laptop (instaler, „Windows protected your PC“ → „More info“ → „Run anyway“, prečica, pokretanje i zatvaranje);
2. Prenos podataka sa drugog računara (kopija na USB, vraćanje); 3. Rezervne kopije (fajl, prečica Ctrl+S, fascikla na USB-u sa porukom o nedostupnoj fascikli, kopija pre vraćanja i pre ažuriranja, preporuka kad praviti kopiju);
4. Ažuriranje (Electron: iz programa, dugme u traci i kartica na ekranu Rezervna kopija, kopija pre ažuriranja); 5. Ako nešto ne radi (dnevnik `dnevnik.log`, nestalo struje: potvrđene ocene su sačuvane, nacrt čeka);
6. Za programera (komande iz README-a). Dodatak za Electron: prenos podataka iz PHP verzije (zip kopija → „Vrati iz kopije“ prihvata i PHP zip).

## 6. Odluke porta (Electron)

- 6.1 Kopija je SQLite fajl `kopija_GGGG-MM-DD_HHMM.sqlite` (dodatak `_2`, `_3` kad postoji) napravljen sa `VACUUM INTO` (konzistentna kopija uz WAL), u koji se posle upiše tabela `kopija_opis (kljuc TEXT PRIMARY KEY, vrednost TEXT)`
  sa `aplikacija=gimnastika`, `verzija` (package.json), `baza_verzija` (poslednje ime migracije, npr. `004_redosled_po_rotaciji`), `vreme` (`Y-m-d H:i:s` lokalno), `vrsta`. `lista()` čita `*.sqlite` iz fascikle (read-only otvaranje; fajl bez `kopija_opis` ili bez `aplikacija=gimnastika` → `opis: null`, „neispravan fajl“); PHP `*.zip` u fascikli se takođe prikazuju (opis iz `opis.json`, vrsta `VRSTE` + verzija PHP, „Vrati ovu“ ih uvozi).
- 6.2 Vraćanje SQLite kopije: provera opisa i verzije (`verzija` kopije > verzija programa → ista poruka kao PHP, poređenje semver brojeva), kopija `pre_vracanja`, zatvaranje žive baze, zamena fajla (`gimnastika.sqlite`; `-wal` i `-shm` se brišu pre zamene), ponovno otvaranje iste `Baza` instance (`baza.otvoriPonovo()` menja `this.db`, pa IPC moduli ne moraju da se prave iznova),
  brisanje tabele `kopija_opis` iz žive baze, migracije, `pocetniPodaci`. Renderer posle toga emituje `app:aktivno` (traka) i ponovo učitava ekran. Greška bilo gde: poruka „Vraćanje nije uspelo: {poruka}“; ako je fajl već zamenjen a otvaranje ne uspe, vraća se `pre_vracanja` kopija (i to se loguje).
- 6.3 Vraćanje PHP zip kopije = uvoz: nova prazna baza u privremenom fajlu, migracije do kraja, `pocetniPodaci` se NE zovu pre uvoza (sprave dolaze iz kopije), uvoz `INSERT` naredbi (odeljak 4) u jednoj transakciji sa `PRAGMA foreign_keys = OFF` tokom upisa, zatim zamena kao 6.2. Vrsta kopije u poruci: „Uvezena“. Isto radi i `alati/uvezi-php-kopiju.cjs <zip> [GIM_PODACI]` za komandnu liniju.
- 6.4 „Vrati iz kopije“ bez liste: `dialog.showOpenDialog` (filteri „Rezervne kopije“ `sqlite, zip`), pa ista potvrda kao PHP u in-app dijalogu (`<dialog>` kao DijalogGrupa/DijalogRazlog: tekst, dugmad „Vrati“ (opasno) i „Odustani“, Esc = odustani, fokus na „Odustani“).
- 6.5 „Promeni fasciklu“: `dialog.showOpenDialog({properties: ['openDirectory', 'createDirectory']})` umesto tekstualnog polja; provera upisa i poruke kao PHP; pored toga dugme „Vrati podrazumevanu“ (vidi se samo kad fascikla nije podrazumevana) = PHP prazno polje. Nedostupna izabrana fascikla → koristi se podrazumevana (kao PHP) i u ekranu stoji „ (podrazumevana)“ sa dodatnom napomenom „Izabrana fascikla {x} nije dostupna.“
- 6.6 „Preuzmi“ → „Prikaži u fascikli“ (`shell.showItemInFolder`). Nema upload-a ni ograničenja veličine.
- 6.7 Kopija `pre_migracije` u `main.cjs` pre `baza.migriraj()` kad `baza.naCekanju()` nije prazno i baza ima tabele (prva instalacija nema), kopija `pre_azuriranja` u `preInstalacije` (greška kopije ne sme da zaustavi ažuriranje, samo se loguje i javlja porukom). Poruka posle migracija kao PHP ide u dnevnik (nema sesije), a renderer je ne prikazuje.
- 6.8 Početna i Pregled: jedan IPC poziv po ekranu (`pocetna.podaci`, `takmicenje.podaci`) koji vraća sve što pogled treba, sa `dan_u_nedelji` i `velicina_prikaz` kao čiste funkcije u `electron/racun/datum.mjs` (`danUNedelji`) i novom `electron/racun/velicina.mjs` (`velicinaPrikaz`), da ih koriste i testovi i renderer.
- 6.9 `AzuriranjeKartica` se seli sa ekrana Sistem na ekran Rezervna kopija (ekran Sistem ostaje bez nje); dugme „Nova verzija“ u traci ostaje.
- 6.10 Verzija 1.0.0: `package.json` `1.0.0`, `beleske/1.0.0.md`, `README.md` dopuna, `docs/INSTALACIJA.md` novo. Instaler `release/Gimnastika-Setup-1.0.0.exe` se pravi na kraju faze; objavljivanje na GitHub (`publish-release`) ostaje na Bojanov znak.
- 6.11 Nema `takmicenja/otvori` POST forme: Početna koristi `gim.takmicenja.otvori(id)` i isti tok kao Takmičenja (poruka otvaranja, `app:aktivno`, skok na korak).
- 6.12 Otvaranje ekrana Početna: ruta `#/pocetna` i prazan hash (`#/` ili bez hasha) vode na Početnu (do sada prazan hash daje `Prazno`).

## 7. Testovi (očekivane vrednosti)

- 7.1 `velicinaPrikaz`: 147 → „147 B“; 1024 → „1 KB“; 39695 → „39 KB“; 1536000 → „1.500 KB“; 1048576 → „1,0 MB“; 2516582 → „2,4 MB“.
- 7.2 `danUNedelji('2026-10-17')` → „Subota“; `'2026-10-19'` → „Ponedeljak“; neispravno → ''.
- 7.3 Napredak na Pregledu nad primer podacima (`alati/primer-podaci.cjs`, 100 ocena, Sara odustala na GR i PA): oba pola gotova → `napredak.pol === 'M'`, `gotovo === true`, pločica „4 / 4“ (M ima 6 sprava → „6 / 6“) sa tekstom „sve rotacije su unete“, `nastavi === null`, tekst pločice „Sve ocene su unete“, link `#/unos`.
  Nad `tests/pomoc/seme.cjs` sa jednom grupom Z na PR i GR bez ocena: `napredak = {rotacija: 1, ukupno_rotacija: 2, pol: 'Z', gotovo: false}`, `nastavi.sprava` = sprava na poziciji 1 u rotaciji 1 za grupu sa `pocetna_pozicija` 1 (PR), `uneto 0`, `ukupno` = broj članova koji rade PR; bez grupa → `napredak null`, pločica „–“ i „grupe još nisu napravljene“.
- 7.4 Kopija: `napravi('rucna')` pravi fajl sa `kopija_opis` (5 ključeva), `lista()` ga vraća prvim sa `opis.vrsta 'rucna'`; drugi poziv u istom minutu daje `_2`; fajl koji nije SQLite ili nema opis → `opis null`; `vrati` kopije sa `verzija '9.9.9'` baca poruku iz 3.1; vraćanje menja podatke (klub dodat posle kopije nestaje) i pravi `pre_vracanja` kopiju; `kopija_opis` ne postoji u živoj bazi posle vraćanja.
- 7.5 Uvoz PHP zip-a (test pravi zip sa `zip.cjs` od sintetičkog `baza.sql` po formatu iz odeljka 4, uključujući `\'` u nazivu kluba, `NULL` lekarski, decimalne ocene `'12.900'`, `migracije` tabelu i `podesavanja` sa `kopije_fascikla`): posle uvoza `ocene.konacna === 12900`, naziv kluba sa apostrofom tačan, `kopije_fascikla` nije uvezen, `aktivno_takmicenje` jeste, `migracije` tabela SQLite ima sve 4 migracije; zip bez `baza.sql` → poruka iz 3.1; `verzija '2.0.0'` → odbijen.
- 7.6 Početna nad primer podacima: `stanje.korak === 'spremno'`, dugme „Otvori takmičenje“, lekarski lista ima Simić Dunju (istekao 2026-10-09 pre 2026-10-17), Stanković Luku (istekao) i Nikolić Teodoru (ističe 2026-10-25, u roku od 30 dana posle 17.10.), redosled po datumu takmičenja pa prezimenu; bez aktivnog takmičenja: prazno stanje sa tekstom iz 1.2.
