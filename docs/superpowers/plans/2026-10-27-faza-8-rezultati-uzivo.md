# Plan faze 8: Rezultati uživo (sinhronizacija sa sajtom)

Izvor istine: `docs/superpowers/specs/2026-10-27-faza-8-rezultati-uzivo.md` (SPEC8). Grana `faza-8` od `faza-7` (posle završne
provere faze 7). Tok: subagent-driven, bez pauza; merge i push na Bojanov znak. Sajt nema API: sve se proverava lažnim HTTP
serverom u testovima i u QA.

Pravila: kao u fazi 7 (tekstovi doslovno iz SPEC8, identifikatori bez dijakritike, kratki srpski komentari, LF, bez em crte,
bez novih zavisnosti, bez spoljnih URL-ova u kodu, `npm test` ceo, commit po zadatku bez AI potpisa, ništa u `%APPDATA%`).

## Zadaci

### Task 1: Snimak i klijent (electron, bez IPC)
**Files:** Create `electron/racun/sinhro-paket.mjs` (čisto: `snimak({takm, sprave, liste, verzija, sad})` → JSON objekat po SPEC8 1;
`listaIzRezultata(kombinacija, rez)` pretvara `izracunaj` izlaz u `po_spravi/viseboj/ekipno` sa `prikaz` tekstom i `_h` brojem),
`electron/sinhro.cjs` (`napravi({podesavanja, rezultati, takmicenja, sifarnici, baza, dnevnik, verzija, fetch, sad, odlaganjeMs = 3000})` →
`{stanje(), zakazi(), posalji(), ping(), imaPromena()}`; `stanje()` → `{ukljuceno, poslednje, cekaSlanje, uToku, greska}`; greške
kao tekstovi iz SPEC8 5), `tests/racun-sinhro-paket.test.mjs`, `tests/sinhro.test.cjs` (lažni server `node:http` na slobodnom portu).
**Interfaces:** troši `rezultati.kombinacije(takm)`, `rezultati.izracunaj(takm, pol, kat, prog)`, `sifarnici.sprave(pol)`,
`podesavanja.daj/postavi`; `fetch` se ubrizgava (u aplikaciji globalni `fetch`). `zakazi()` koristi `setTimeout` sa `unref()`.
- [ ] Step 1: testovi (SPEC8 7). Step 2: pada. Step 3: napiši. Step 4: prolazi. Step 5: commit `feat(sinhro): snimak rang lista i klijent sajta`.

### Task 2: IPC, podešavanja i stanje na Pregledu (posle Task 1)
**Files:** Create `tests/ipc-faza8.test.cjs`. Modify `electron/moduli.cjs` (modul `sinhro: {stanje, posalji, ping}`; `unos.potvrdi/odustao/vrati`
posle uspeha zovu `sinhro.zakazi()`; `podesavanja.sacuvajOpsta` prima `sajt_url`, `sajt_token` uz proveru SPEC8 5; `takmicenje.podaci`
dodaje `sinhro: stanje()`), `electron/api.cjs`, `electron/main.cjs` (pri startu `sinhro.zakazi()` ako `imaPromena()`), `electron/modeli/podesavanja.cjs`
(ključevi), `src/ekrani/Podesavanja.jsx` (kartica SPEC8 4), `src/ekrani/Takmicenje.jsx` (red „Rezultati uživo: …“), `src/ekrani/sinhroStanje.js`
(čisto: `tekstStanja(stanje)`), `tests/sinhro-stanje.test.mjs`, `docs/INSTALACIJA.md` (odeljak „Rezultati uživo“), `README.md`.
- [ ] Step 1: testovi. Step 2: pada. Step 3: napiši. Step 4: prolazi; `npm run build`; QA kroz aplikaciju sa lažnim serverom u
  scratchpad-u (skripta `node:http` koja beleži zahteve): Podešavanja (adresa, token, „Proveri vezu“, „Pošalji nada“), potvrda ocene
  na Unosu → zahtev stiže posle 3 s sa tačnim zaglavljem i 2 liste, Pregled pokazuje „poslato HH:MM“, server ugašen → „greška: Sajt nije dostupan.“,
  prazna adresa → 0 zahteva. Step 5: commit `feat(sinhro): podesavanja sajta, slanje posle ocene i stanje na pregledu`.

## Posle zadataka
Završni pregled grane (fable), talas ispravki, ponovni pregled; verzija ostaje 1.0.0 dok Bojan ne odluči (faza 8 se može objaviti
kao 1.1.0 kad sajt dobije API). Merge i push na Bojanov znak.

## Self-review
- SPEC8 pokrivenost: 1, 2, 3, 5, 6 → T1; 4 → T2; 7 → T1 + T2.
- Deljeni fajlovi: samo T2 menja `moduli.cjs`, `api.cjs`, `main.cjs`, `Podesavanja.jsx`, `Takmicenje.jsx`; T1 i T2 su redom.
