# Faza 6: popis PHP verzije za Rang liste, Rezultate takmičara, štampu rang liste i bilten

Izvor: `C:\Users\bojan\Desktop\Takmicarski program` (PHP 8 + MySQL, verzija 1.2.0). Popis je samo čitanje, ništa u PHP projektu nije menjano.
Svi stringovi u navodnicima su doslovni (srpski, latinica sa dijakriticima). Putanje su relativne u odnosu na koren PHP projekta.
Zajednički helperi (`trazimAktivno`, `aktivnoIdIliGreska`, `pol_naziv` = `MSG`/`ŽSG`, `pol_slovo` = `M`/`Ž`, `datum_prikaz` = `dd.mm.gggg.`, `Broj::prikaz`, `Broj::prikazD`) su opisani u ranijim popisima; ovde samo razlike.

Gde se UI razlikuje od slika (`dizajn/slike/09-rang-liste.png`, `09b-stampa-rang-lista.png`, `09c-rezultati-takmicara.png`, `09d-bilten-zsg.png`, `09e-bilten-msg.png`) i odeljaka 09, 09b, 09c, 09d/e u `docs/SPECIFIKACIJA.md`, važi kod. Slike se poklapaju sa kodom; razlike: kod koristi pun `naziv` sprave u tabovima i kolonama (slika "Dv. razboj"; za više od 4 sprave kod koristi skraćenicu u kolonama); slika 09c ima više takmičenja u "Sva takmičenja" (primer podaci imaju jedno).

Fajlovi: `app/Kontroleri/rang.php` (32), `rezultati.php` (60), `stampa.php` (70), `bilten.php` (79); `app/Pogledi/rang.php` (133), `rezultati.php` (82), `stampa.php` (98), `bilten.php` (97), `okvir_stampa.php` (25); `app/Modeli/Rezultati.php` (214); `app/Racun/Plasman.php` (već portovan u fazi 1: `electron/racun/plasman.mjs` sa `mesta`, `viseboj`, `ekipno`, `ISTI_DELI`, `ISTI_VISA_E_PA_D`); `public/assets/css/stampa.css` (87); `testovi/TokTest.php` (`test_rezultati_iz_baze`), `testovi/RacunTest.php` (plasman testovi, već portovani: `tests/racun-plasman.test.mjs`).

---

## 0. Zajedničko

### 0.1 Aktivno takmičenje
`rang`, `stampa`, `bilten` zovu `trazimAktivno()` (bez aktivnog: flash "Prvo izaberite aktivno takmičenje." + redirect `takmicenja`). `rezultati` NE traži aktivno (radi za bilo kog takmičara); `aktivnoId()` koristi samo kao podrazumevano takmičenje.

### 0.2 Podešavanja koja ulaze u račun (faza 2, `podesavanja.cjs`)
`plasman_isti_rezultat` (`deli` | `visa_e_pa_d`), `viseboj_nepotpun` (`ulazi` | `ne_ulazi`), `grb_levo`, `grb_desno` (relativne putanje `grb/<ime>`), `organizator`. Na takmičenju (faza 3): `ekipno_broji`, `pravilo_e`, `zaglavlje_biltena`, `organizator`, `domacin` (u `POLJA`) i `grb_levo`, `grb_desno` (poseban par `GRBOVI`, pišu ih `sacuvajGrb`/`postaviGrb`). Klub ima `grad` (kolona postoji u Electron migraciji 001; koristi se samo u redu ekipe na listu i biltenu).

### 0.3 Pravila (SPECIFIKACIJA 4, već u `plasman.mjs`)
Plasman po spravi po konačnoj opadajuće, višeboj po zbiru, unutar iste (pol, kategorija, program). VK na mestu koje mu pripada sa oznakom "VK", ne pomera ostale, ne ulazi u ekipu. Odustao: na spravi bez ocene; u višeboju bez zbira i mesta, na dnu. Ekipno: član ekipe, nije VK, isti klub; po spravi se sabira `ekipno_broji` najboljih; ocene koje se ne broje u zagradi. Isti rezultat deli mesto, sledeće se preskače (1, 2, 2, 4); uz `visa_e_pa_d` tie-break viša E pa viša D.

---

## 1. Model Rezultati (`app/Modeli/Rezultati.php`)

### 1.1 `kombinacije(takmicenjeId, pol = null)`
`SELECT t.pol, kat.id AS kategorija_id, kat.naziv AS kategorija, pr.id AS program_id, pr.naziv AS program, COUNT(*) AS broj FROM prijave p JOIN takmicari t … LEFT JOIN kategorije kat … LEFT JOIN programi pr … WHERE p.takmicenje_id = ? [AND t.pol = ?] GROUP BY t.pol, kat.id, pr.id ORDER BY t.pol DESC, kat.redosled, pr.redosled` (pol Z pre M; null kategorija/program su posebna kombinacija; u SQLite `GROUP BY` sa NULL radi isto; redosled sa NULL prvim kao MySQL: sortirati u JS `poredi` null-first po `redosled`).

### 1.2 `izborIzUrl(takm)` → `{ima, pol, kat, prog, kategorije, programi, kat_naziv, prog_naziv}`
- `sve = kombinacije(takm.id)`; `pol = get('pol')`; nije `M`|`Z` → `sve[0].pol ?? 'Z'` (prva kombinacija: Ž ako ima ženskih prijava).
- `kombinacije` = one sa tim polom. `kat = get('kat') === '' ? null : (int)`, `prog` isto.
- `kategorije` = lista parova `(kategorija_id|0, naziv ?? '–')` po redu kombinacija (`(int)` null → 0). Ako `kat` nije među ključevima → `kat = (int) kombinacije[0].kategorija_id` (null kategorija → 0; null samo kad nema kombinacija).
- `programi` = parovi `(program_id|0, naziv ?? '–')` za kombinacije te kategorije (poređenje `(int)` obe strane); ako `prog` nije ključ → prvi (ili null).
- Interno su `kat`/`prog` celi brojevi (0 = null kategorija/program); `kat_naziv`/`prog_naziv` se traže tim brojem (null kategorija → "–"). Vraća `ima = kombinacije !== []`, `kat: kat ?: null` (0 → null), `prog` isto. Null kategorija se filtrira kao `kategorija_id IS NULL`; u URL-u je `kat=0` (option value 0), a `url()` ISPUŠTA null vrednosti iz upita.
- **Zamka redosleda za port**: PHP nizovi čuvaju redosled ubacivanja; JS objekti sa celobrojnim ključevima ga ne čuvaju. `kategorije`, `programi`, `prijave`, `po_spravi` liste, `viseboj` i članovi ekipe moraju biti nizovi (ili `Map`), a `plasman.viseboj` se hrani `Map`-om ili nizom stavki (vidi komentar u `plasman.mjs`). `mesta()` vraća objekat sa string ključevima: pretvoriti `Number()` i sortirati po `redosled`.

### 1.3 `izracunaj(takm, pol, kategorijaId|null, programId|null)` → `{sprave, prijave, po_spravi, viseboj, ekipno}`
1. `sprave` = sprave pola po `redosled, id`; `sids`; `isti = plasman_isti_rezultat` (podrazumevano `deli`); `nepotpun = viseboj_nepotpun` (podrazumevano `ulazi`).
2. `redovi` = prijave takmičenja čiji takmičar ima taj pol i `kategorija_id <=> ?`, `program_id <=> ?` (NULL-safe jednakost: u SQLite `IS`), sa `t.id_broj, ime, prezime, godina_rodjenja, pol, k.skracenica AS klub_skr, k.puno_ime AS klub_ime` i `sprave_ids` (GROUP_CONCAT iz `prijava_sprave`), `ORDER BY t.prezime, t.ime` (port: kolator). `prijave = {prijava_id: red + sprave: int[]}`.
3. `sveOcene = Ocene::zaTakmicenje(tid)`. Za svaku prijavu i svaku njenu spravu: nema ocene → ključ se preskače (ne radi ili još nije uneto); `status odustao` → `ocene[pid][sid] = null`, `detalji[pid][sid] = {status: 'odustao'}`; `uneto`|`ispravljeno` → `ocene[pid][sid] = konacna`, `detalji = {status, d, e, odbitak, konacna, e_sudije, odbacene: odbaceniIndeksi(values(e_sudije), takm.pravilo_e)}`; `nacrt` se preskače (kao da nema ocene).
4. **Po spravi**: za svaku spravu: `stavke` = prijave koje rade spravu i imaju ključ u `ocene` (uključujući null = odustao): `{kljuc: pid, vrednost: ocene[pid][sid], vk: van_konkurencije === 1, tie: [e ?? 0, d ?? 0]}`; `m = Plasman::mesta(stavke, isti)` sortiran po `redosled`; `mestoNaSpravi[pid][sid] = oznaka`; `po_spravi[sid][] = {prijava, mesto, oznaka} + detalji[pid][sid]` (odustali su u listi sa `mesto null`, `oznaka` iz `mesta` za null vrednost, na dnu). Sprava bez ocena → `[]`.
5. **Višeboj**: `ulaz[pid] = {ocene: ocene[pid], vk, iskljucen: nepotpun === 'ne_ulazi' && count(p.sprave) < count(sids), tie: [sumE, sumD]}` (zbir E i D preko detalja; `iskljucen` gleda broj PRIJAVLJENIH sprava, ne ocenjenih: ko je prijavljen na sve, a ocenjen na neke, dobija delimičan zbir i mesto); `v = Plasman::viseboj(ulaz, sids, 'ulazi', isti)` sortiran po `redosled` (`iskljucen` samo postavlja `zbir null`; red OSTAJE u listi sa `mesto null`, `oznaka ''`, `odustao false`, na dnu); za svaki: `odustao = ocene[pid] sadrži null`; ako `ocene[pid] === [] && !odustao` → preskoči (još nema nijednu ocenu); red `{prijava, zbir, mesto, oznaka, odustao, ocene, detalji, mesta: mestoNaSpravi[pid]}`. VK koji je i odustao na nekoj spravi dobija `oznaka ''` (ne "VK"), pa na ekranu nema VK čip ni `rang-vk` red (PHP ponašanje, port zadržava).
6. **Ekipno**: `clanovi` = prijave sa `clan_ekipe === 1 && van_konkurencije === 0 && klub_id !== null` → `{prijava, klub: klub_id, ocene}`; `Plasman::ekipno(clanovi, sids, takm.ekipno_broji, isti)` (broji `max(1, ekipno_broji)`; ekipe nemaju tie-break, `visa_e_pa_d` ne utiče; ekipa bez ocena ima `ukupno 0` i mesto). Electron `plasman.mjs ekipno` vraća NIZ sortiran po `redosled` sa `{klub: id, clanovi: [prijava_id], po_spravi: {sid}, brojane: {sid: [pid]}, ukupno, mesto, oznaka, redosled}`; model učitava red kluba i gradi `clanovi` = `{prijava, ocene, zbir (zbir ne-null ocena ili null), broji: {sid: boolean iz brojane}}` sortirane po `zbir` opadajuće (null kao −1); red ekipe = `{klub: red kluba, po_spravi, ukupno, mesto, oznaka, clanovi}`.

Napomena: `izracunaj` se zove po kombinaciji; `kombinacije` i `izracunaj` ne keširaju.

---

## 2. Ekran Rang liste (`app/Kontroleri/rang.php`, `app/Pogledi/rang.php`), GET `rang?pol=&kat=&prog=&tab=`

### 2.1 Kontroler
`izbor = izborIzUrl(takm)`; `rez = izbor.ima ? izracunaj(takm, pol, kat, prog) : null`; `tab = get('tab', 'viseboj')`; ako `rez` postoji i tab nije `viseboj`|`ekipno` ni id sprave iz `rez.sprave` → `viseboj`. Pogledu: `takm, izbor, rez, tab`; `sadrzajKlasa = 'sadrzaj-fiksno'`.

### 2.2 Pogled
`q = {pol, kat, prog}`; `odustaoRec` = Ž → "Odustala" | "Odustao"; `mnozina` = Ž → "takmičarki" | "takmičara".
- **`mestoCelija(mesto, oznaka)`**: `VK` → `span.status.status-vk` "VK"; `mesto null` → `span.broj.sivo` "–" (15 px 700); `mesto <= 3` → `span.mesto-plocica` (širina 28, radijus 8, 15 px) sa brojem; inače `span.mesto-obicno` (inline-flex, širina 28, centar, 15 px 800).
- **`ime(p, sivo)`**: `a.rang-ime[.sivo]` sa `href = rezultati?t={takmicar_id}&pol&kat&prog`, tekst "Prezime Ime".
- Kartica `section.kartica.raste` (overflow hidden):
  - Zaglavlje (padding 0 12 0 4, donja ivica): `div[role=tablist][aria-label="Vrsta rang liste"]` sa `a.rang-tab[role=tab]` po spravi (`naziv`, `href rang?q&tab={id}`), pa "Višeboj" (`tab=viseboj`), "Ekipno" (`tab=ekipno`); aktivan `aktivan`. Desno: `a.dugme` "Bilten takmičenja" (`bilten?q`), `a.dugme#stampa-link` (ikona `stampac` 16) "Pregled za štampu" + `<kbd>Ctrl+P</kbd>` (`stampa?q&tab`).
  - Filter `form#rang-filter` (GET, padding 10/16): `div.izbor[aria-label=Pol]` linkovi "ŽSG" (`rang?pol=Z&tab={viseboj|ekipno ako je tekući, inače viseboj}`), "MSG"; `span.oznaka` "Kategorija" + `select.unos[name=kat][aria-label=Kategorija]` 140 px (opcije iz `izbor.kategorije`, promena → `prog = ''` i submit); `span.oznaka` "Program" + `select.unos[name=prog]` 130 px (promena → submit); razmak; legenda: `span.sek` 13 px sa `span.status.status-vk` "VK" + "van konkurencije, ne zauzima mesto"; `span.status.status-crn` (ikona `iks` 13 + odustaoRec) + "bez plasmana".
  - `div.kartica-skrol`:
    - `!rez` → `div.prazno-stanje`: `<h2>` "Nema prijava za ovaj pol", `<p>` "Prijavite takmičare na ekranu Prijave."
    - **Tab sprave** (`table.tabela.rang-tabela`): kolone "Mesto" (76), "St. br." (76), "Takmičar", "Klub" (70), desno "D" (100), "E" (100), "Odbitak" (100), "Konačna" (130, sa ikonom sprave 18 ispred teksta). Prazno: `td[colspan=8].prazno` "Još nema unetih ocena na ovoj spravi." Red `tr[.rang-vk]`: mesto ćelija; `span.broj` 600 startni broj; ime (`ime(p, od)`) + ako VK `span.mali.sek` "van konkurencije" + ako odustao `span.status.status-crn` (iks + odustaoRec); `span.skr` 700 `--ink-2` klub_skr; D, E, Odbitak kao `span.ocena-tekst` (odustao → "–"); Konačna `span.broj` 18 px 800 (odustao → "–").
    - **Višeboj**: kolone "Mesto" (76), "St. br." (76), "Takmičar", "Klub" (70), po spravi desno (širina 92 ako > 4 sprave, inače 116; ikona 18 + skraćenica ako > 4 sprave, inače naziv), "Ukupno" (116). Prazno: `colspan = 5 + n` "Još nema unetih ocena." Red `tr[.rang-vk][.sivo-red kad odustao]`: mesto, startni, ime (sivo kad odustao) + VK/odustao oznake, klub, po spravi `span.ocena-tekst` (`ocene[sid]` ili "–"), Ukupno `span.broj` 18 px 800 (`zbir` ili "–").
    - **Ekipno**: kolone "Mesto" (76), "Klub i članovi", po spravi (100 ako > 4 inače 124), "Ukupno" (124). Prazno: `colspan = 3 + n` "Nema ekipa. Označite „član ekipe“ u Prijavama." Red ekipe `tr.rang-ekipa`: mesto; `<strong>puno_ime</strong>` + `span.skr.sek` skraćenica; po spravi `span.ocena-tekst` 700 (`po_spravi[sid] ?? 0`); Ukupno 18 px 800. Red člana `tr.rang-clan`: prazno; ime (link) + `span.broj.sivo.mali` startni (padding-left 28); po spravi `span.broj[.sivo kad se ne broji]`: null → "–", broji → prikaz, ne broji → "(prikaz)"; `span.broj.sek` zbir ili "–".
  - Podnožje (36 px, 13 px, siva): levo `"{tabNaziv} · {ŽSG|MSG} · {kat_naziv} · {prog_naziv}"` + (rez ? ` · {count(prijave)} {mnozina}` : '') (broje se SVE prijave grupe, i VK i bez ocena) + (ekipno ? ` · ocene u zagradi se ne broje (broji se {ekipno_broji} najbolje po spravi)` : ''); desno "Klik na ime otvara sve rezultate takmičarke|takmičara".
- Linkovi: `url()` ispušta null `kat`/`prog`; pol linkovi nose samo `pol` i `tab` (kategorija i program se vraćaju na podrazumevane); `tab` se proverava samo kad `rez` postoji. Tabovi su obični linkovi bez strelica; selecti se šalju odmah na promenu.
- JS: `Ctrl+P` (ili Meta+P) → `preventDefault` i otvaranje linka `#stampa-link`.

---

## 3. Ekran Rezultati takmičara (`rezultati.php`), GET `rezultati?t=&tk=&pol=&kat=&prog=`

### 3.1 Kontroler
- `takmicar = Takmicari::nadji(t)`; nema → flash `greska` "Takmičar ne postoji." + redirect `rang`.
- `prijave` = sve prijave takmičara sa `takm_naziv, takm_datum, takm_mesto, kategorija, program` `ORDER BY tk.datum DESC, tk.id DESC`.
- `izabranoId = get_int('tk') ?? aktivnoId()`; ako nema prijave za njega → prva prijava (ili null).
- Za svaku prijavu: `takm` red; `rez = izracunaj(takm, takmicar.pol, kategorija_id, program_id)`; `red` = red višeboja te prijave (ili null); `stavka = {prijava, takm, sprave: rez.sprave, red}`; `izabrano` = stavka izabranog takmičenja.
- Pogledu: `takmicar, sva, izabrano, nazad = rang?pol&kat&prog (bez praznih)`, `dodatniCss stampa.css`.

### 3.2 Pogled
- Zaglavlje `section.kartica` (red, razmak 16, padding 12/16): `a.dugme.ne-stampaj` (ikona `strelica-levo` 16) "Rang liste" (`nazad`); kolona: `<h2>` 24 px 800 "Prezime Ime", `div.sek` 13 px: `span.broj` 700 "ID {id_broj}", "{godina} · {Ž|M}", `klub_ime ?? 'bez kluba'`, ako `izabrano`: `span.status` "{kategorija ?? '–'} · {program ?? '–'}"; `a.dugme.ne-stampaj` (ikona `meni-takmicari`) "Otvori karton" (`takmicari?id=`; u portu `#/takmicari?id=`); `button.dugme.ne-stampaj` (ikona `stampac`) "Štampaj" + `<kbd>Ctrl+P</kbd>` → `window.print()`.
- `!izabrano` → `div.prazno-stanje`: `<h2>` "Nema prijava", `<p>` "Ovaj takmičar još nije prijavljen ni na jedno takmičenje."
- Inače `section.kartica` sa `kartica-zaglavlje`: `h2.kartica-naslov` naziv takmičenja; `span.sivo` 13 px "{mesto} · {datum} · {n} E sudija|E sudije ·precrtane E ocene su odbačene" (n = 1 → "E sudija", inače "E sudije"; u PHP-u fali razmak posle "·", port piše " · precrtane…"). `table.tabela.rang-tabela`: kolone "Sprava", desno "D" (84), "E1".."En" (78), "E" (88), "Odb." (84), "Konačna" (116), "Mesto" (84). Po spravi: `td` sa ikonom 20 + naziv (700); `d === null` → `td[colspan=n+5].sivo` "nema ocene"; `odustao` → `td[colspan=n+5]` sa `span.status.status-crn` (iks + Odustala|Odustao); inače D (`span.broj` 600), E1..En (`span.broj[.precrtano]` 500 kad odbačena, 600 inače; null → "–"), E (`span.broj.sek` 600), Odb. (`span.broj.sivo`), Konačna (`span.broj` 16 px 800), Mesto (`mesto(…)` iz `red.mesta[sid]`: cifre → broj, "VK" → čip, inače "–"). Red "Višeboj" (`tr` pozadina `--sub`): `<span 800>Višeboj</span>`, prazno `colspan n+3`, zbir 18 px 800 ili "–", mesto (`mesto(red.mesto, red.oznaka)` ili "–"). Pažnja: `odbacene` su POZICIONI indeksi nad `values(e_sudije)`, a pogled ih poredi sa brojem sudije `i − 1`; poklapaju se samo kad su sudije 1..n bez rupa (uvek, jer potvrda traži sve E); port radi isto.
- Štampa ekrana Rezultati: PHP učitava i `stampa.css`, čiji globalni `@page { size: A4 portrait; margin: 0 }` uz `@media print .sadrzaj { padding: 0 }` daje NULA margine; port učitava `stampa.css` globalno pa je isto. Meni ističe "Rang liste" dok je otvoren `rezultati`.
- "Sva takmičenja" (`section.kartica.ne-stampaj`, samo kad `sva !== []`): `kartica-zaglavlje` "Sva takmičenja" + `span.sivo` "Klik na takmičenje prikazuje ocene po spravama iznad"; tabela: "Takmičenje", "Datum" (120), "Kategorija" (150), po spravi (80 ako > 4 inače 96; ikona + skraćenica), "Višeboj" (110), "Mesto" (84); red `tr[.izabran]`: `a.rang-ime` naziv (`rezultati?t&tk`, bez `pol/kat/prog`, pa posle klika "Rang liste" vraća bez filtera; port prenosi filtere i u te linkove), datum, "{kat ?? '–'} · {prog ?? '–'}", po spravi `span.broj` 600 (ocena ili "–"), višeboj 16 px 800 ili "–", mesto. Sprave zaglavlja = sprave prve stavke.
- `mesto(m, oznaka)`: VK čip; null → `span.sivo` "–"; `<= 3` pločica; inače `mesto-obicno`.
- Štampa ovog ekrana: `window.print()` sa `app.css` `@media print` (meni, traka, `.ne-stampaj` sakriveni) i `stampa.css`.

---

## 4. Štampa rang liste (`stampa.php`, pogled `stampa.php`, okvir `okvir_stampa.php`), GET `stampa?pol=&kat=&prog=&tab=`

### 4.1 Kontroler
- `izbor`; `!ima` → flash `upozorenje` "Nema prijava za štampu." + redirect `rang`.
- `rez`; `tab` (sprava id | `viseboj` | `ekipno`, nepoznat → `viseboj`); `sprava` = red sprave ako je tab id sprave.
- `polozeno = tab !== 'ekipno' && sprava === null && count(sprave) > 4` (višeboj MSG položeno).
- Prelamanje: sprava → `array_chunk(po_spravi[sid], 30)`; ekipno → stranice gde ekipa zauzima `1 + count(clanovi)` redova, prelom pre ekipe kad bi `visina + v > 30` (ekipa se ne deli); višeboj → `array_chunk(viseboj, polozeno ? 6 : 11)`. Prazno → `[[]]` (jedna prazna strana).
- `naziv = "{sprava.naziv | 'Ekipno' | 'Višeboj'} · {ŽSG|MSG} · {kat_naziv} · {prog_naziv}"`; `grb = takm.grb_levo !== '' ? takm.grb_levo : podesavanja.grb_levo`.
- Pogledu (okvir `okvir_stampa`): `naslov "Štampa: {naziv}"`, `nazad = rang?q&tab`, `polozeno, takm, izbor, rez, tab, sprava, strane, naziv, grb`.

### 4.2 Okvir za štampu (`okvir_stampa.php`)
Posebna strana (bez menija): `body.stampa`; `div.stampa-alat` (sticky, ne štampa se): `a.dugme` (ikona `strelica-levo`) "Nazad" + `<kbd>Esc</kbd>` (`nazad`), `span.naslov` naslov, `span.sivo.mali` "A4 položeno|uspravno · u dijalogu za štampu isključite zaglavlja i podnožja browsera", `button.dugme.dugme-glavno[autofocus]` (ikona `stampac`) "Štampaj" + `<kbd>Ctrl+P</kbd>` → `window.print()`. Esc → `nazad`. Ako `polozeno`: `<style>@page { size: A4 landscape; margin: 0; }</style>`.

### 4.3 Pogled lista (`stampa.php`)
`kolone = '50px 32px minmax(0,1fr) ' + ('112px ' ako položeno inače '104px ') × n + '70px'`; `vreme = date('d.m.Y. H:i')`; `mestoTekst(m, oz)` = VK → "VK", null → "–", inače "{m}.".
Po strani `div.list[.polozeno]`:
- `div.st-zaglavlje`: `div.st-grb` (img ako ima grba), `div.st-sredina`: `<h1>` naziv takmičenja, `<span 700>` "{mesto}, {datum}" (bez zareza kad nema mesta; datum `span.broj`), `<span 700, margin-top 10>` naziv liste; `div.st-zvanicno`: `<b>ZVANIČNO</b>` + `span.broj` `date('d.m. H:i')`.
- `h2.st-h2` "Rezultati".
- **Sprava** (`table.st-tab`): "Mesto" (50), "Br." (40), levo "Takmičarka|Takmičar", levo "Klub" (180), "D" (64), "E" (64), "Odb." (64), "Ocena" (80); red: mesto (`centar jako`), startni (`centar`), ime (`levo jako` + ` <i 500>van konkurencije</i>` | ` <i>odustala|odustao</i>`), `klub_ime`, D, E (odustao → "–"), Odb. (prazno kad 0 ili odustao, inače "−{prikaz}" sa minusom U+2212), Ocena (`jako`, 14 px; odustao → "–").
- **Ekipno** (`table.st-tab`): "Mesto" (50), levo "Ekipa, članovi", po spravi (66 ako > 4 inače 84; skraćenica ako > 4 inače naziv), "Ukupno" (84). `tr.ekipa`: mesto, `puno_ime` + (` {grad}` ako klub ima grad), po spravi `prikaz(po_spravi[sid] ?? 0)`, ukupno 14 px. Red člana: prazno, ime (padding-left 16), po spravi ("–" | prikaz | "(prikaz)"), prazno.
- **Višeboj** (`div.st-tabela` grid): `div.st-red.st-glava` (grid `kolone`): "Mesto", "Br.", "Takmičarka|Takmičar / klub", po spravi `div.st-sprava` (ikona 30 + `<b>naziv</b>` + `span.sivo` "ocena (mesto)"), `span.st-ukupno` "Ukupno". Red `div.st-red`: `span.st-mesto.broj` mestoTekst, `span.st-br.broj` startni, `span.st-ime` (`<b>Prezime Ime</b>`, `<span>klub_skr</span>`, `<i>van konkurencije</i>` | `<i>odustala|odustao</i>`), po spravi: bez detalja ili odustao → `div.st-ocena.prazno` "–"; inače `div.st-ocena`: `span.glavna` (`<b.broj>konacna</b>` + `span.broj` "({oznaka mesta na spravi})": oznaka bez tačke, npr. "(1)", "(VK)", "" kad je nema), `span.deo` "D" + prikaz(d) (`prikaz`, ne `prikazD`), `span.deo` "E" + prikaz(e), ako odbitak ≠ 0 `span.deo` "Odb." + "−{prikaz}"; `span.st-zbir.broj` zbir ili "–". Prazna lista prikazuje samo zaglavlje (bez poruke). Koristi se samo `grb_levo`.
- `div.st-dno`: na poslednjoj strani `div.st-legenda`: "D = težina vežbe · E = izvođenje (" + (`pravilo_e === 'odbaci_krajnje'` ? "prosek srednjih ocena E sudija" : "prosek ocena E sudija") + ") · Odb. = odbitak · (n) = mesto na spravi · Br. = startni broj" `<br>` "Ocena na spravi = D + E − odbitak. VK = van konkurencije: ocene se prikazuju, takmičarka|takmičar ne zauzima mesto." + (ekipno ? " Ekipno: po spravi se broje {ekipno_broji} najbolje ocene, ocene u zagradi se ne broje." : ""); `div.st-potpisi` samo na poslednjoj strani: "Glavni sudija", "Zapisničar". Na svakoj strani `div.st-podnozje`: "Odštampano {vreme}" i "Strana {i+1} od {ukupno}". `datum_prikaz` praznog datuma je '', pa ostaje ", " posle mesta (rubni slučaj, port isto).

---

## 5. Bilten (`bilten.php`, pogled `bilten.php`, okvir `okvir_stampa`), GET `bilten?pol=&kat=&prog=`

### 5.1 Kontroler
- `izbor`; `!ima` → flash `upozorenje` "Nema prijava za bilten." + redirect `rang`.
- `rez`; `polozeno = count(sprave) > 4` (MSG položeno).
- `stavke` = za svaku ekipu `{tip: 'ekipa', sekcija: 'ekipno', v: 24, podaci}` pa po članu `{tip: 'clan', sekcija: 'ekipno', v: 23}`; zatim za svaki red višeboja `{tip: 'red', sekcija: 'viseboj', v: 37}`.
- `organizatorTekst = takm.organizator !== '' ? takm.organizator : podesavanja.organizator`; `visinaLista = (polozeno ? 794 : 1123) − 96`; `visinaZaglavlja = 96 + (organizator ? 18 : 0) + (zaglavlje_biltena ? 16 : 0) + (domacin ? 16 : 0)`; `kapacitetPrva = visinaLista − visinaZaglavlja − 80`; `kapacitetOstale = visinaLista − 30 − 80`; `zaglavljeSekcije = {ekipno: 64, viseboj: 86}`.
- Prelamanje: po stavkama; `dodatno` = zaglavlje sekcije kad sekcija na strani nije ista; ako `tekuca !== [] && zauzeto + dodatno + v > kapacitet` → nova strana (kapacitet = ostale, sekcija se ponavlja sa zaglavljem). Prazno → `[[]]`.
- `disciplina = "{Ženska|Muška} sportska gimnastika · {kat_naziv} · {prog_naziv}"`; pogledu: `naslov "Bilten: {ŽSG|MSG} · {kat} · {prog}"`, `nazad = rang?pol&kat&prog`, `polozeno, takm, izbor, rez, strane, disciplina, organizator, grbLevo, grbDesno` (grb takmičenja, inače iz podešavanja).

### 5.2 Pogled
`gdeKada = "{mesto}, {datum}"` (bez mesta samo datum); `mestoTekst` kao štampa; `glavaEkipno()` = thead: "Mesto" (46), levo "Ekipa, članovi", po spravi `naziv` (100 ako > 4 inače 96), "Ukupno" (90); `glavaViseboj()` = colgroup (36, auto, po spravi 28/44/46, 54) + dva reda: "Mesto" (rowspan 2), levo "Ime, klub" (rowspan 2), po spravi `naziv` (colspan 3), "Ukupno" (rowspan 2); drugi red po spravi "D", "E", "Uk.".
Po strani `div.list[.polozeno]`:
- Prva strana `div.bi-zaglavlje`: `div.st-grb` levi; `div.bi-sredina`: `span.mali` zaglavlje_biltena (ako ima), `span.org` organizator (ako ima), `span.bilten` "BILTEN", `span.naziv` naziv takmičenja, `span.disc` disciplina, `span.gde.broj` gdeKada, `span.gde` "Domaćin: {domacin}" (ako ima); `div.st-grb` desni. Ostale strane `div.bi-mala-glava`: "BILTEN · {naziv}" i disciplina.
- Sekcije po stavkama: pri prelasku u `ekipno`: `div.st-sekcija` (`<b>Rezultati ekipno</b>` + `span` "{n} ekipa|ekipe" (n = 1 → "ekipa")) + `table.st-tab` sa `glavaEkipno`; u `viseboj`: `div.st-sekcija` (`<b>Višeboj</b>` + "{n} takmičarki|takmičara") + `table.st-tab.uska` sa `glavaViseboj`. Redovi: `ekipa` → `tr.ekipa`: mesto, `puno_ime` + grad, po spravi prikaz, ukupno; `clan` → prazno, ime (padding-left 14), po spravi ("–" | prikaz | "(prikaz)"), prazno; `red` → mesto (`centar jako`), `td.levo` `<b>Prezime Ime</b>` + ` <i>odustala|odustao</i>` + `span.klub` klub_ime, po spravi: bez detalja/odustao → tri `td.centar` "–"; inače `prikazD(d)` (jedna decimala kad je `d % 100 === 0`, npr. "4,2", inače tri), `prikaz(e)`, `td.jako` prikaz(konacna); `td.jako` 13 px zbir ili "–". Prazna strana: `<p class="sivo">Još nema unetih ocena.</p>`. Napomene: bilten prelama po stavkama, pa ekipa MOŽE da se podeli na dve strane (za razliku od lista za štampu); brojevi u naslovu sekcije su ukupni (`count(ekipno)`, `count(viseboj)`) i ponavljaju se na nastavku; u redu višeboja nema teksta "van konkurencije" (samo "VK" u mestu), a red ekipe nema skraćenicu kluba.
- `div.st-dno`: poslednja strana `div.st-legenda` "D = težina vežbe, E = izvođenje, Uk. = ocena na spravi (D + E − odbitak). Ekipno: po spravi se broje {ekipno_broji} najbolje ocene, ocene u zagradi se ne broje. VK = van konkurencije."; svaka strana `div.st-podnozje`: `span.broj` gdeKada, "Strana {i+1}/{ukupno}".

---

## 6. CSS za štampu (`public/assets/css/stampa.css`, 87 redova) i `@media print` u `app.css`
`stampa.css` nije u Electron `src/stil` (samo `app.css`, `tokens.css`); treba ga preneti kao `src/stil/stampa.css` netaknut: `body.stampa` (siva pozadina `#8A8890`), `.stampa-alat`, `.list` (794×1123 px, padding 48, bela, senka; `.polozeno` 1123×794), `.st-*` klase (zaglavlje, grb 84×72, zvanično, h2, tabela višeboja kao grid sa ivicama 1 px `#111`, `.st-tab` tabele 12 px, `.uska` 11 px fiksna, `tr.ekipa` siva `#E6E6E6` sa `print-color-adjust: exact`), `.bi-*` (bilten zaglavlje), `@page { size: A4 portrait; margin: 0 }`, `@media print` (bela pozadina, alat sakriven, `.list` bez margine i senke, visina 1122/793, `page-break-after: always`, `.list:last-child` bez preloma posle), `body.stampa` font 'Manrope', `.list` na ekranu `margin: 16px auto`. `app.css` ima `@media print` koji sakriva `.meni, .traka, .ne-stampaj`, postavlja `.app { height: auto; display: block }`, `.sadrzaj { overflow: visible; padding: 0 }` i belu pozadinu; obične (ne print) klase `.mesto-plocica`, `.mesto-obicno`, `.rang-tab`, `.rang-tabela`, `.rang-vk`, `.rang-ekipa`, `.rang-clan`, `.rang-ime`, `.precrtano`, `.sivo-red`, `.ocena-tekst` postoje i identične su PHP-u.

---

## 7. Štampa i PDF u Electron-u (dizajn, nije PHP)
Dizajn (`2026-10-20-gimnastika-electron-design.md`): štampa kroz `webContents.print()` sa postojećim print CSS-om; `printToPDF` za bilten kao PDF fajl; modul `electron/stampa.cjs`. PHP tok "posebna strana sa alatom" postaje u Electron-u: ekran `#/stampa?…` i `#/bilten?…` unutar aplikacije (bez menija: renderer ih crta kao celu stranu sa `body.stampa` stilom). **Jedan put štampe** (odluka): na ta dva ekrana i dugme "Štampaj" i Ctrl+P zovu IPC `stampa.stampaj({polozeno})` → `webContents.print({ landscape: polozeno, silent: false, printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } })` nad trenutnim prozorom (sistemski dijalog); ekran uz to postavlja `<style>@page { size: A4 landscape; margin: 0 }</style>` kad je `polozeno`, da CSS i opcija štampe kažu isto. `App.jsx` globalni Ctrl+P (`window.print()`) se na ekranima cele strane ne zove: `App` proverava `CELA_STRANA` i šalje `app:stampa`, koji ekran hvata. Ekran Rezultati takmičara zadržava `window.print()` (uspravno). "Sačuvaj PDF" (odluka; dizajn traži PDF samo za bilten, port ga daje i listu za štampu) zove `stampa.pdf({polozeno, ime})` → `dialog.showSaveDialog` (podrazumevano ime `Bilten-{naziv}-{ŽSG|MSG}.pdf` ili `Rang-lista-{naziv}-{tab}-{ŽSG|MSG}.pdf`, bez nedozvoljenih znakova) + `webContents.printToPDF({ landscape, pageSize: 'A4', margins: { marginType: 'none' }, printBackground: true })` → zapis fajla, toast "PDF je sačuvan: {putanja}"; otkazan dijalog → ništa. Pri štampi/PDF-u menija i trake nema (ekran ih ne crta), `.stampa-alat` je sakriven kroz `@media print`.

---

## 8. PHP testovi koje treba portovati

### 8.1 `test_rezultati_iz_baze` (TokTest, nad `tok_seme`: 4 takmičarke, sprave PR i GR, 4 E sudije, `ekipno_broji` 1 u semenu i u `tests/pomoc/seme.cjs`; PHP komentar u testu: "Ekipno: broji se 1 najbolja po spravi")
- `dodajVise` 4; svima `clan_ekipe = true`; Ceca `van_konkurencije = true`. Ocene (potvrda, 4 iste E): Ana PR 4,0/8,0 = 12,000; Ana GR 4,0/8,5 = 12,500 (24,500); Bea PR 4,0/8,0 = 12,000; Bea GR 4,0/7,0 = 11,000 (23,000); Ceca PR 5,0/8,0 = 13,000 VK; Ceca GR 5,0/8,0 (26,000 VK); Dona PR 3,0/8,0 = 11,000; Dona `odustao` na GR.
- `izracunaj(takm, 'Z', kat, prog)`: `po_spravi[PR]` oznake: Ceca "VK", Ana "1", Bea "1" (deli), Dona "3" (preskače).
- Višeboj: Ceca pozicija 0 sa "VK"; Ana mesto 1, zbir 24500; Bea mesto 2; Dona zbir null, mesto null, pozicija 3 (dno), `odustao true`.
- Ekipno: 2 ekipe; `[0]` klub "JED" ukupno 24500 (12,000 + 12,500); `[1]` "DVA" ukupno 11000 (samo Dona na PR, Ceca je VK), 1 član.
- `plasman_isti_rezultat = 'visa_e_pa_d'`; Bea PR ispravka 3,9/8,1 (= 12,000, razlog 'test') → PR: Bea "1" (viša E), Ana "2".

### 8.2 Već portovano (faza 1): `test_mesta_deljenje_i_vk`, `test_primer_podaci_zsg/msg` (`proveri_grupu`: očekivana mesta po spravi, višeboj zbir i mesto, ekipe redom sa mestom i ukupno), `test_primer_e_sudije_petrovic`.

### 8.3 Što testovi NE pokrivaju (dodati u portu)
`kombinacije` i `izborIzUrl` (podrazumevani pol, kategorija, program; null kombinacija "–"; nepostojeći `kat` iz URL-a); `izracunaj` sa `nacrt` ocenom (preskače se), sa prijavom bez ijedne ocene (nije u višeboju), `viseboj_nepotpun = ne_ulazi` (prijava sa manje sprava isključena iz višeboja, a ostaje po spravi), `detalji.odbacene`; ekipa bez kluba (null klub se ne računa); prelamanje strana za štampu (30 po spravi, ekipe se ne dele, 11/6 za višeboj) i za bilten (kapaciteti, ponovljeno zaglavlje sekcije); nad primer podacima (100 ocena): mesta i zbirovi jednaki `ocekivano_*` iz JSON-a kroz MODEL (ne samo čiste funkcije), ekipe redom; `rezultati` ekran: izbor takmičenja, red bez ocena.

---

## 9. Napomene za port (odluke)
1. **Rute**: `#/rang?pol&kat&prog&tab`, `#/rezultati?t&tk&pol&kat&prog`, `#/stampa?pol&kat&prog&tab`, `#/bilten?pol&kat&prog`. Ekrani štampe i biltena su "cela strana" bez menija i trake (kao `okvir_stampa`): `App.jsx` ih crta bez `Meni`/`Traka` (nov skup `CELA_STRANA`), sa `body.stampa` klasom dok su otvoreni; Esc i "Nazad" vraćaju na `#/rang` sa istim filterima (štampa i sa `tab`, bilten bez `tab`, kao PHP). `stampa.css` se učitava globalno (kao PHP na ekranu Rezultati).
2. **IPC**: `rang.podaci(pol, kat, prog, tab)` → `{takm, izbor, rez, tab}` (jedan poziv, `rez` ceo); `rang.rezultati(takmicarId, tk)` → `{takmicar, sva, izabrano, aktivnoId}`; `rang.stampa(pol, kat, prog, tab)` → podaci za list (uključujući `strane`, `naziv`, `grb` kao file URL, `polozeno`, `vreme`); `rang.bilten(pol, kat, prog)` → podaci za bilten (`strane`, `disciplina`, `organizator`, `grbLevo/Desno` URL, `polozeno`); `stampa.stampaj({polozeno})`, `stampa.pdf({polozeno, ime})`. Prelamanje strana je čista funkcija (`electron/racun/prelom.mjs`), testirana.
3. **Vreme štampe** (`Odštampano`, `ZVANIČNO d.m. H:i`): lokalno vreme računara u rendereru u trenutku prikaza.
4. **Grb**: file URL sa `?v=` kao u fazi 3 (`grbUrl`), iz takmičenja ili podešavanja.
5. **Filteri na Rang listama**: `select` promene menjaju hash (kategorija resetuje program); pol linkovi nose `tab` samo za viseboj/ekipno.
6. **Ctrl+P**: globalna prečica `stampa` postoji (`src/precice.js` → `App.jsx` zove `window.print()` i `preventDefault`). Promena u `App.jsx`: ako je ekran `rang` → hash `#/stampa?…` (kao PHP; ekran daje tekući izbor kroz `app:stampa` događaj ili App gradi iz hash-a); ako je ekran u `CELA_STRANA` → `app:stampa` koji ekran hvata i zove `gim.stampa.stampaj`; inače `window.print()` kao do sada (Rezultati). Format strane postavlja ekran kroz `<style>` sa `@page` (odeljak 7). PDF ide posebnim dugmetom "Sačuvaj PDF" (odeljak 7).
7. **"Otvori karton"**: `#/takmicari?id={id}`; ekran Takmičari (faza 2) ne čita `?id`, pa faza 6 dodaje: pri učitavanju sa `?id` lista izabere tog takmičara i otvori mu karton (formu), isto što bi uradio klik na red.
8. **Brojevi**: `prikaz`/`prikazD` iz `broj.mjs`; minus u odbitku je U+2212 (`−`), ne crta.
9. **Rezultati takmičara**: `izracunaj` po prijavi (kao PHP); za takmičara sa mnogo takmičenja je sporo, ali prihvatljivo (isto kao PHP).
10. PHP bug: u zaglavlju kartice rezultata nedostaje razmak ("·precrtane"); port piše " · precrtane E ocene su odbačene".
