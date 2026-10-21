# Vizuelni sistem

Slika svega ovoga je `dizajn/slike/00-vizuelni-sistem.png`. Vrednosti kao CSS promenljive su u `dizajn/tokens.css`. Napravi jedan `app.css` sa klasama za komponente ispod i koristi ga na svim ekranima.

## Pravac

Crveno-bela paleta (boje Sokolskog društva „Vojvodina"), beli bočni meni, topla svetlosiva pozadina, jedan font. Čisto, visok kontrast, krupni brojevi kod ocena. Bez senki (osim kartice koja se prevlači), bez gradijenata, bez ukrasa.

## Boje

| Promenljiva | Vrednost | Upotreba |
|---|---|---|
| `--primary` | #C8102E | Glavna dugmad, aktivna stavka menija, okvir trenutnog reda |
| `--primary-dark` | #9E0B23 | Hover na crvenom |
| `--primary-soft` | #FCE9EC | Podloga trenutnog reda u unosu ocena |
| `--ink` | #1C1B1F | Tekst, okvir fokusa, izabrano u izboru jednog od više, pločice za mesta 1 do 3 |
| `--ink-2` | #45434B | Sekundarni tekst, zaglavlja tabela |
| `--muted` | #6A6872 | Pomoćni tekst |
| `--line-2` | #B9B6AF | Ivice polja i dugmadi |
| `--line` | #E4E2DD | Linije u tabelama, ivice kartica |
| `--ground` | #F6F5F2 | Pozadina ekrana |
| `--surface` | #FFFFFF | Kartice, meni, polja |
| `--sel` | #F1EEE8 | Izabrani red u tabeli |
| `--sub` | #FAF9F7 | Zaglavlje tabele, red koji čeka |
| `--link` | #1B4F8F | Linkovi, imena u rang listi, tekstualna dugmad |
| `--info` / `--info-soft` | #1F4E79 / #E4EDF6 | Status informacije (U pripremi, sprava grupe) |
| `--ok` / `--ok-soft` | #0F6B3A / #DDF2E5 | Uneto, aktivno, važi |
| `--warn` / `--warn-soft` | #7A4300 / #FFEFCC | Ističe, ispravljeno. Ivica polja sa upozorenjem: #C77700 |
| `--bad` / `--bad-soft` | #A50E22 / #FBE3E6 | Istekao, greška, brisanje |

Pravilo: crvena je i boja kluba i boja greške. Zato su fokus i izbor crni i neutralni, a status nikad ne zavisi samo od boje: uvek ima tekst, a upozorenja i ikonu.

## Font

Manrope (fajlovi u `dizajn/fonts/`, uključuje se preko `manrope.css`). Rezervni: `'Segoe UI', system-ui, sans-serif`.

| Uloga | Veličina i težina |
|---|---|
| Naslov ekrana (gornja traka) | 22 px, 800, razmak slova −0,02em |
| Naslov kartice | 15 px, 800 |
| Tekst i tabele | 14 px / 20 px, 500 (naglašeno 600 do 700) |
| Oznaka polja | 12 px, 600 |
| Zaglavlje tabele | 12 px, 700, verzal, razmak slova 0,04em |
| Broj u tabeli i polju ocene | 14 do 16 px, 600 |
| Konačna ocena | 22 px, 800 |
| Veliki naslov na Početnoj | 40 px, 800 |

**Svi brojevi** (ocene, datumi, ID, startni brojevi) imaju `font-variant-numeric: tabular-nums` da kolone ostanu poravnate. Ocene su poravnate desno.

## Mere

- Bočni meni 220 px, gornja traka 56 px, margina sadržaja 20 px gore i dole, 24 px levo i desno, razmak između kartica 12 px.
- Razmaci: 4 unutar grupe, 8 između polja, 12 između kartica, 16 unutrašnja margina kartice.
- Radijus: 6 px oznaka statusa i taster prečice, 8 px dugme i polje, 12 px kartica.
- Ivice 1 px. Okvir fokusa i polja sa upozorenjem ili greškom 2 px.
- Sve mora da stane na 1366x768 bez skrolovanja gde god je tako nacrtano.

## Komponente

**Dugme.** Visine: 48 px glavna akcija ekrana, 36 px u formama, 30 px u redu tabele. Vrste: glavno (crveno, beli tekst), sporedno (belo, ivica `--line-2`), opasno (belo, crven tekst i ivica), tekstualno (samo tekst u `--link`), isključeno. Prečica stoji u dugmetu kao mali taster desno od natpisa.

**Taster prečice.** 11 px, ivica, radijus 6 px. Na crvenom dugmetu je providan sa belom ivicom.

**Polje.** Visina 36 px, ivica `--line-2`, radijus 8 px, oznaka iznad. Stanja: u fokusu (crna ivica 2 px i blag oreol), upozorenje (narandžasta ivica 2 px i poruka ispod), greška (crvena ivica 2 px i poruka ispod), isključeno (siva podloga).

**Izbor jednog od više** (ŽSG/MSG, rotacija 1 do 4, broj sudija). Spojena dugmad u jednom okviru, izabrano je crno sa belim tekstom.

**Kućica i kružić.** Standardni, 18 px, boja `--ink`.

**Oznaka statusa.** Visina 22 px, 12 px tekst 600, radijus 6 px. Vidi tabelu statusa.

**Kartica.** Bela, ivica `--line`, radijus 12 px. Zaglavlje kartice 48 px sa naslovom levo i akcijom desno, linija ispod.

**Tabela.** Zaglavlje 34 px na `--sub` sa donjom linijom `--line-2`. Red 40 px (42 do 52 px kad ima dva reda teksta ili polja), linija `--line` ispod. Izabrani red na `--sel`, tekst polucrn.

**Red za unos ocena.** Visina 50 px. Polje ocene 36 px visoko, 60 do 64 px široko, tekst centriran 16 px 600, radijus 7 px. Stanja su opisana u specifikaciji i nacrtana na slici sistema.

**Bočni meni.** Stavka 38 px, radijus 12 px, ikona 18 px i tekst 14 px 600. Aktivna: crvena podloga, beli tekst 700. Naslovi grupa 11 px verzal. Na dnu verzija.

## Statusi

| Oznaka | Boja | Značenje |
|---|---|---|
| Uneto (kvačica) | ok | Ocena potvrđena |
| Aktivno (kvačica) | ok | Aktivno takmičenje |
| Ispravljeno (olovka) | warn | Ocena menjana, postoji zapis |
| Ističe za N dana (trougao) | warn | Lekarski ističe u roku praga |
| Istekao (trougao) | bad | Lekarski ne važi |
| U pripremi | info | Takmičenje još nije počelo |
| Čeka | neutralna siva #E9ECF1 | Još nije nastupio/la |
| Završeno | neutralna siva | Arhivirano takmičenje |
| Odustao/Odustala (iks) | crna sa belim tekstom | Bez ocene i plasmana |
| VK | bela sa crnom ivicom | Van konkurencije |

## Ikone

`dizajn/ikone/*.svg`. Linijske, mreža 24 px, debljina 1,75, boja preko `currentColor`. Koristi ih inline u HTML-u da naslede boju teksta.

- Opšte: meni, pretraga, plus, olovka, kanta, štampač, kopija, vraćanje, upozorenje, kvačica, iks, hvataljka za prevlačenje.
- Sprave (`sprava-XX.svg`): PR preskok, DR dvovisinski razboj, GR greda, PA parter, KH konj sa hvataljkama, KA karike, RA razboj, VR vratilo. To su sopstveni crteži, ne FIG piktogrami. Stoje uz naziv sprave u unosu ocena, rang listama, podešavanjima i na štampi.
