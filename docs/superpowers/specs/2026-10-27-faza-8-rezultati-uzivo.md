# Faza 8: Rezultati uživo (sinhronizacija sa sajtom)

Nema PHP uzora: PHP verzija je ovo ostavila van obima (SPECIFIKACIJA 9), a dizajn Electron verzije (odeljak 5) rezerviše
ključeve `sajt_url`, `sajt_token`, `sajt_poslednja_sinhronizacija` i modul `electron/sinhro.cjs` „koji čita redove sa
`izmenjeno > poslednja` i šalje ih na `<sajt_url>/api/...`“. Sajt još nema API, pa ovaj dokument definiše ugovor koji sajt
treba da ispuni; program radi i bez sajta (sve je isključeno dok je `sajt_url` prazan).

## 1. Šta program šalje

- Jedinica slanja je **snimak takmičenja**: ceo JSON sa rang listama aktivnog takmičenja (ne pojedinačni redovi). Sajtu je to
  dovoljno da prikaže rezultate, a programu ne treba stanje po redu. Snimak se gradi iz `rezultati.kombinacije` + `izracunaj`
  za svaku kombinaciju (pol, kategorija, program), istim funkcijama kao ekran Rang liste, pa su brojevi isti kao na papiru.
- Oblik (sve vrednosti su JSON brojevi i tekstovi; ocene su tekst sa decimalnim zarezom kako ih prikazuje program, plus celi
  hiljaditi delovi za sajt koji računa):
  ```json
  {
    "verzija_formata": 1,
    "program": {"naziv": "Gimnastika desktop", "verzija": "1.1.0"},
    "poslato": "2026-10-27T10:15:30.000Z",
    "takmicenje": {"id": 1, "naziv": "Jesenji kup 2026", "datum": "2026-10-17", "mesto": "Novi Sad", "organizator": "", "domacin": "", "zavrseno": 0, "izmenjeno": "2026-10-17 09:00:00"},
    "sprave": {"Z": [{"id": 7, "naziv": "Preskok", "skracenica": "PR"}], "M": []},
    "liste": [
      {
        "pol": "Z", "kategorija": {"id": 1, "naziv": "Kadet"}, "program": {"id": 1, "naziv": "C program"},
        "po_spravi": {"7": [{"mesto": 1, "oznaka": "", "prijava_id": 3, "startni_broj": 12, "ime": "Ana", "prezime": "Petrović", "klub": "VOJ", "klub_ime": "SD „Vojvodina“", "d": "4,200", "e": "8,700", "odbitak": "0,000", "konacna": "12,900", "konacna_h": 12900, "odustao": false}]},
        "viseboj": [{"mesto": 1, "oznaka": "", "prijava_id": 3, "ime": "Ana", "prezime": "Petrović", "klub": "VOJ", "po_spravi": {"7": {"konacna": "12,900", "konacna_h": 12900}}, "zbir": "50,300", "zbir_h": 50300, "odustao": false}],
        "ekipno": [{"mesto": 1, "oznaka": "", "klub": "VOJ", "klub_ime": "SD „Vojvodina“", "po_spravi": {"7": {"zbir": "38,100", "zbir_h": 38100}}, "ukupno": "144,550", "ukupno_h": 144550, "clanovi": [{"prijava_id": 3, "ime": "Ana", "prezime": "Petrović"}]}]
      }
    ]
  }
  ```
  `oznaka` je `''`, `'VK'` ili prazno kao na ekranu Rang liste; `mesto` je `null` kad nema plasmana; `odustao` je `true` kad je
  takmičar odustao na toj spravi (u višeboju: na bilo kojoj). Nedostajuće ocene se izostavljaju iz `po_spravi`.

## 2. Ugovor sa sajtom (API koji sajt treba da ima)

- Osnova: `sajt_url` bez završne kose crte (na primer `https://rezultati.primer.rs`). Dozvoljeno je `https://` i `http://`.
- Zaglavlja svakog zahteva: `Authorization: Bearer <sajt_token>`, `Content-Type: application/json; charset=utf-8`,
  `X-Gimnastika-Verzija: <verzija programa>`.
- `GET {sajt_url}/api/gimnastika/ping` → `200` sa JSON `{"ok": true, "sajt": "<ime sajta>"}`. Služi dugmetu „Proveri vezu“.
- `PUT {sajt_url}/api/gimnastika/takmicenja/{id}` sa snimkom iz odeljka 1 → `200` sa `{"ok": true}`; `401` ili `403` →
  token nije prihvaćen; `413` → snimak prevelik; `5xx` ili prekid veze → sajt nedostupan.
- Sajt čuva poslednji snimak po `takmicenje.id` i prikazuje ga; ne radi nikakvo računanje. `id` je lokalni id programa, pa
  sajt treba da ga veže za nalog (token) da se takmičenja različitih zapisničara ne mešaju.
- Vremensko ograničenje zahteva: 15 s. Odgovor koji nije JSON se tretira kao greška sajta.

## 3. Kad se šalje

- Nikad dok je `sajt_url` prazan ili `sajt_token` prazan.
- Automatski, **posle svake potvrđene izmene ocene** aktivnog takmičenja (IPC `unos.potvrdi`, `unos.odustao`, `unos.vrati`)
  sa odlaganjem od 3 s (više brzih izmena = jedno slanje), i pri startu programa ako ima promena od poslednjeg slanja.
- Ručno: dugme „Pošalji sada“ (Podešavanja, kartica sajta) šalje odmah bez obzira na promene.
- Promena postoji kad je `MAX(izmenjeno)` nad `ocene`, `prijave`, `takmicenja`, `grupe` aktivnog takmičenja veći od
  `sajt_poslednja_sinhronizacija` (tekst `GGGG-MM-DD HH:MM:SS` UTC, isto kao `Baza.sad()`); posle uspešnog slanja ključ dobija
  vreme u trenutku **pre** gradnje snimka (da izmena tokom slanja ne bude izgubljena).
- Slanje nikad ne blokira unos: greška se samo beleži (stanje + dnevnik), sledeća izmena pokušava ponovo. Nema reda čekanja
  ni ponovnih pokušaja po tajmeru (bez interneta u sali je normalno stanje).

## 4. Ekrani i tekstovi

- Podešavanja, nova kartica „Rezultati uživo na sajtu“ ispod postojećih:
  polja „Adresa sajta“ (`unos`, placeholder `https://`), „Token“ (`input type=password`, dugme „Prikaži“ prebacuje na tekst),
  tekst ispod: „Program šalje rang liste aktivnog takmičenja posle svake potvrđene ocene. Dok je adresa prazna, ništa se ne
  šalje.“; dugmad „Sačuvaj“ (zajedno sa ostalim podešavanjima, isti „Sačuvaj“ ekrana), „Proveri vezu“ (poziva ping, toast
  „Veza sa sajtom radi: {sajt}.“ ili „Sajt nije dostupan: {razlog}“), „Pošalji sada“ (toast „Rang liste su poslate ({n} lista).“
  ili greška).
- Pregled takmičenja (`takmicenje`), u kartici takmičenja ispod `div.sek`: red `span.sivo.mali` „Rezultati uživo: {stanje}“
  gde je stanje „isključeno“ (prazna adresa), „poslato {dd.mm.gggg. HH:MM}“, „čeka slanje“ (ima promena), „greška: {razlog}“
  (poslednji pokušaj neuspešan), „slanje u toku“.
- Traka: ništa (ne gura se u traku da ne smeta u sali).
- Dnevnik: `Sinhro: poslato takmicenje {id} ({n} lista, {bajtova} B)` i `Sinhro greska: {razlog}`; token se nikad ne upisuje.

## 5. Razlozi grešaka (tekstovi)

- „Adresa sajta mora da počinje sa http:// ili https://.“ (čuvanje podešavanja)
- „Unesite token sajta.“ (ručno slanje ili provera bez tokena)
- „Sajt nije prihvatio token.“ (401/403)
- „Snimak je prevelik za sajt.“ (413)
- „Sajt je javio grešku {status}.“ (ostali statusi)
- „Sajt nije dostupan.“ (mrežna greška, prekid, istek 15 s)
- „Odgovor sajta nije ispravan.“ (nije JSON ili nema `ok: true`)

## 6. Odluke

- Token stoji u tabeli `podesavanja` kao tekst (lokalna baza, jedan laptop); nije u kopijama koje idu na sajt; `.sqlite`
  kopija ga sadrži (ista mašina), PHP uvoz ga nema. Pri vraćanju kopije sa drugog računara token i adresa dolaze iz kopije
  (nisu mašinski ključevi), što je i željeno (isti nalog).
- `fetch` iz glavnog procesa (Electron 44, Node 22); bez novih zavisnosti.
- Snimak se gradi u glavnom procesu iz modela `rezultati` (čiste funkcije `electron/racun/sinhro-paket.mjs` prave JSON iz
  `izracunaj` rezultata, pa su testirane bez baze).
- Faza 8 ne menja šemu baze (ključevi idu u postojeću tabelu `podesavanja`), ne menja PHP ni sajt.

## 7. Testovi (očekivano)

- `sinhro-paket`: nad primer podacima snimak ima 2 liste (Ž i M, Kadet, C program), `viseboj[0]` za Ž je Petrović Ana sa
  `zbir_h 50300` i `zbir "50,300"`, ekipno VOJ `ukupno_h 144550`; odustala Đorđević Sara ima `odustao true`, `mesto null`.
- `sinhro` klijent sa lažnim HTTP serverom u testu: ping 200 → ok; PUT 200 → `sajt_poslednja_sinhronizacija` postavljen i
  dnevnik ima liniju bez tokena; 401 → „Sajt nije prihvatio token.“; server ugašen → „Sajt nije dostupan.“; zaglavlje
  `Authorization` tačno `Bearer <token>`; prazna adresa → ništa se ne šalje (0 zahteva); odlaganje 3 s spaja više poziva u jedan.
- IPC: `sinhro.stanje()`, `sinhro.posalji()`, `sinhro.ping()`; `unos.potvrdi` zakazuje slanje (stub klijenta broji pozive).
