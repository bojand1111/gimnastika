# Gimnastika kao desktop aplikacija (Electron + SQLite): dizajn

Datum: 20.10.2026. Naručilac: Bojan (Sandblock Studios). Status: čeka odobrenje.

## 1. Namera i zašto

Postojeća aplikacija „Gimnastika: vođenje takmičenja“ (`C:\Users\bojan\Desktop\Takmicarski program`, PHP + MariaDB,
verzija 1.2.0) radi u pregledaču uz Apache i MariaDB koje instaler nosi sa sobom. Bojan hoće program koji se
instalira i pokreće kao Structure Studio (`C:\Posao\structure-studio`): jedan `Setup.exe`, sopstveni prozor,
bez servera i portova, sa ažuriranjem koje program sam nađe na GitHub-u kad ima interneta. Kasnije treba da se
poveže sa sajtom radi rezultata uživo (API koji će se napraviti na sajtu; program šalje promene).

Nova aplikacija ponavlja postojeći proizvod ekran po ekran. Specifikacija proizvoda ostaje
`docs/SPECIFIKACIJA.md` i `docs/TOK-PRIPREME.md` iz PHP projekta (kopiraju se u ovaj repo kao
`docs/proizvod/`), zajedno sa vizuelnim sistemom (`docs/VIZUELNI-SISTEM.md`, `dizajn/tokens.css`, makete
`dizajn/ekrani/*.html`, slike `dizajn/slike/*.png`, font u `dizajn/fonts/`). Ovaj dokument opisuje samo ono
što se menja: tehnologiju, pakovanje, ažuriranje, podatke i redosled izrade.

## 2. Ciljevi, ne-ciljevi, anti-ciljevi

Ciljevi
- Isti ekrani, iste prečice, isti izgled i ista pravila računanja kao u PHP verziji 1.2.0 (uključujući uvoz
  prijava iz docx/xlsx).
- Jedan instaler, bez admin prava, bez XAMPP-a, bez Apache-a i MariaDB. Program radi potpuno bez interneta.
- Ažuriranje: program proveri GitHub Releases, ponudi novu verziju, preuzme je i instalira na klik. Ništa se ne
  preuzima ni ne instalira bez klika.
- Podaci su jedan SQLite fajl; rezervna kopija je kopija tog fajla; ništa se ne gubi pri ažuriranju.
- Podaci iz PHP verzije (zip kopija sa SQL izvozom) mogu da se uvezu u novu aplikaciju.
- Svaka tabela i dalje ima `kreirano` i `izmenjeno`, a šema ostaje ista po imenima, da slanje promena na sajt
  (rezultati uživo) kasnije bude dodatak, ne prepravka.

Ne-ciljevi (sada)
- Rezultati uživo, unos sa tableta za sudije, više korisnika, finala po spravama (kao i u spec. odeljak 9).
- Rad na macOS/Linux. Samo Windows 10/11 x64.
- Diferencijalno (delta) preuzimanje ažuriranja: pun instaler je dovoljan (~100 MB).

Anti-ciljevi (ovo bi bio neuspeh)
- Program koji „radi“ ali traži internet, Visual C++ runtime ili ručno podešavanje.
- Gubitak podataka pri ažuriranju ili vraćanju kopije.
- Unos ocena koji nije ceo moguć tastaturom ili je sporiji nego u PHP verziji.
- Float u računanju ocena.

## 3. Ograničenja (važe za sve zadatke)

- Node 22 (ima ga), npm. Nema Python, JDK ni Visual Studio-a; native moduli samo sa prebuilt binarnim fajlovima.
- Sav tekst interfejsa na srpskom, latinicom. Decimalni zarez, datumi `dd.mm.gggg.`. Bez em crte u bilo kom tekstu.
- Ocene u celim brojevima (hiljaditi delovi). Logika računanja u čistim funkcijama sa testovima.
- Svaki unos se čuva odmah. Šema se menja samo novom numerisanom migracijom.
- Tastatura pre miša, fokus uvek vidljiv.
- Bez spoljnih URL-ova u radu (font i ikone u paketu). Jedini mrežni poziv je provera ažuriranja, na klik ili
  tiho pri startu, sa jasnim „nema interneta“ ponašanjem (nema greške, nema čekanja).
- Nazivi u kodu i bazi srpski bez kvačica, `snake_case` u bazi, komentari kratki na srpskom. Identifikatori u
  JS-u `camelCase`.
- Nema `Co-Authored-By` ni pominjanja AI-ja u commit porukama. Commit samo kad Bojan traži.

## 4. Odluke o tehnologiji (donete, Bojan prepustio)

| Deo | Odluka | Zašto |
|---|---|---|
| Okvir | Electron 44 (isti kao Structure Studio), `electron/main.cjs` + `preload.cjs` + React 19 renderer (Vite 7) | Proveren sklop iz SS, isti alati, isti način pakovanja |
| Baza | SQLite kroz `better-sqlite3` (sinhroni API, WAL), fajl `%APPDATA%\Gimnastika\gimnastika.sqlite` | Jedan fajl, transakcije, bez servera; prebuilt binarni fajlovi za Electron postoje, rebuild radi `electron-builder install-app-deps` |
| Pristup bazi | Samo iz main procesa, preko IPC (`ipcMain.handle`), renderer dobija `window.gim.<modul>.<radnja>(...)` iz preload-a sa `contextIsolation` | Renderer bez Node pristupa; jedan sloj modela kao i sad (Modeli/*) |
| Sortiranje imena | U JS-u sa `Intl.Collator('sr-Latn')`; u SQL-u nema `croatian_ci` | SQLite ne zna č, ć, đ, š, ž |
| Brojevi | Kolone ocena su `INTEGER` u hiljaditim delovima (nema DECIMAL) | Isto što radi `Racun\Broj` danas, bez pretvaranja |
| UI | Postojeći `public/assets/css/app.css` i `dizajn/tokens.css` prenose se skoro netaknuti; React komponente nose iste CSS klase; ikone kao inline SVG komponente | Dizajn je gotov i testiran; ne crtamo ponovo |
| Štampa | `webContents.print()` sa postojećim print CSS-om; uz to `printToPDF` za bilten kao PDF fajl | Isti izgled na papiru, plus PDF za slanje |
| Uvoz docx/xlsx | `fflate` (zip) + `DOMParser`/`fast-xml-parser` u main procesu; port `app/Uvoz/*` | Isti algoritam, isti testovi |
| Pakovanje | `electron-builder` (NSIS, x64, bez admin prava, `perMachine: false`), `Gimnastika-Setup-<v>.exe` | Ista alatka koju SS koristi za instaler; umesto electron-packager jer sama prebuilda native module |
| Ažuriranje | `electron-updater` sa `provider: github` (javan repo `sandblock-studios/gimnastika`, ili kako Bojan nazove), `autoDownload: false`, `autoInstallOnAppQuit: false` | Ugrađena podrška, bez tokena za javan repo; isti tok klikova kao u SS |
| Objavljivanje | `npm run publish-release`: digne verziju iz `package.json`, proveri tag `v<verzija>`, upload `Setup.exe` + `latest.yml` kao Release assets na GitHub (token iz `~/.config/github-token.txt`, nikad u kodu ni u instaleru) | Kao `publish-release.cjs` u SS, samo GitHub API |
| Testovi | `node --test tests/*.test.cjs` za čiste module i model nad privremenom SQLite bazom; Playwright za ekrane kasnije (kao u SS) | Isti alati kao SS |
| Repo | `C:\Posao\gimnastika`, git od prvog dana, grana `main` | Nov proizvod, nov repo; PHP projekat ostaje gde jeste dok testeri rade |

Ako je repo privatan, radi se kao u SS: read-only token se upisuje u `resources/update.json` pri gradnji instalera. Podrazumevano je javan repo bez tokena; Bojan bira pri prvom objavljivanju.

## 5. Arhitektura

```
gimnastika/
  package.json            verzija = verzija aplikacije (jedan izvor istine)
  electron/
    main.cjs              prozor, životni ciklus, trace log, poziv updatera
    preload.cjs           window.gim = { klubovi, takmicari, sifarnici, takmicenja, prijave, uvoz, grupe, ocene, rezultati, kopija, podesavanja, sistem }
    ipc.cjs               registruje ipcMain.handle('modul:radnja') iz modela; greške vraća kao {ok:false, greska}
    baza/
      baza.cjs            otvaranje fajla, WAL, migracije, transakcija(fn), sad()
      migracije/001_pocetna.sql ...  (prevod MariaDB migracija 001..004 u SQLite, isti nazivi)
    racun/                broj.cjs, ocena.cjs, plasman.cjs, priprema.cjs  (čiste funkcije, port app/Racun)
    modeli/               klubovi.cjs, takmicari.cjs, sifarnici.cjs, takmicenja.cjs, prijave.cjs, grupe.cjs, ocene.cjs, rezultati.cjs, kopija.cjs, podesavanja.cjs
    uvoz/                 docx.cjs, xlsx.cjs, citac.cjs, tumac-prijave.cjs, uparivanje.cjs, uvoz.cjs (port app/Uvoz + Modeli/Uvoz)
    kopija.cjs            kopija_<datum>.sqlite u fascikli za kopije, vraćanje, uvoz PHP zip kopije (SQL -> SQLite)
    updater.cjs           electron-updater, github provider (kao SS updater.cjs bez tokena/blockmap posla)
    stampa.cjs            print i printToPDF
  src/                    React: App.jsx (ruter po ekranu), okvir (Meni, Traka, Poruke), ekrani/*.jsx, komponente/*.jsx, stil/app.css, stil/tokens.css, fonts/
  tests/                  *.test.cjs (node --test); e2e/ (Playwright, kasnije)
  docs/proizvod/          kopija SPECIFIKACIJA.md, TOK-PRIPREME.md, VIZUELNI-SISTEM.md, dizajn/ (makete, slike)
  alati/                  primer-podaci.cjs, probni-podaci.cjs, uvezi-php-kopiju.cjs
  installer/              electron-builder.yml, ikona, publish-release.cjs
```

Pravila slojeva: renderer nikad ne zna za SQLite ni za fajlove; sve ide kroz `window.gim`. Modeli su isti po
imenu i odgovornosti kao `app/Modeli/*.php`; svaka javna funkcija modela ima test nad privremenom bazom.
Računanje je u `electron/racun` i radi i u rendereru (unos ocena računa E i konačnu dok se kuca) pa su to
ES moduli bez Node zavisnosti, uvezeni sa obe strane.

Podaci: `%APPDATA%\Gimnastika\gimnastika.sqlite`, `%APPDATA%\Gimnastika\kopije\` (podrazumevana fascikla
kopija, promenljiva u podešavanjima), `%APPDATA%\Gimnastika\dnevnik.log`. Ažuriranje ne dira `%APPDATA%`.

Podešavanja aplikacije (`podesavanja` tabela, kao sad) dobijaju tri nova ključa, prazna dok sinhronizacija ne
postoji: `sajt_url`, `sajt_token`, `sajt_poslednja_sinhronizacija`. Rezervisano mesto: `electron/sinhro.cjs`
koji čita redove sa `izmenjeno > poslednja` i šalje ih na `<sajt_url>/api/...`; piše se tek kad sajt dobije API.

## 6. Ažuriranje i objavljivanje (tok)

1. Bojan: digne `version` u `package.json`, `npm test`, `npm run installer` (electron-builder pravi
   `release/Gimnastika-Setup-<v>.exe`, `.blockmap` i `latest.yml`), commit, push, tag `v<v>`,
   `npm run publish-release -- --notes beleske/<v>.md` (napravi GitHub Release sa tim fajlovima).
2. Program: 5 s posle starta i na „Proveri ažuriranje“ (ekran Rezervna kopija, deo Ažuriranje) pita
   GitHub; bez interneta tiho prestaje. Kad ima novije: u gornjoj traci pored verzije dugme
   „Nova verzija 1.3.0“, klik preuzima (procenat), pa „Ponovo pokreni i ažuriraj“: pre toga program napravi
   kopiju baze vrste `pre_azuriranja`, tiho instalira i pokrene novu verziju; nove migracije se primene pri startu
   (kao sad, sa kopijom pre migracija).
3. Ako migracija ne uspe, poruka nudi vraćanje iz te kopije.

## 7. Podaci iz PHP verzije

`alati/uvezi-php-kopiju.cjs` i isto u aplikaciji (Rezervna kopija -> „Uvezi kopiju iz starije verzije“):
otvori `kopija_*.zip` PHP verzije, pročita SQL izvoz, pretvori `INSERT` naredbe u SQLite (DECIMAL -> hiljaditi
delovi, datumi isti), upiše u praznu bazu, pa primeni migracije. Verzija kopije mora biti <= 1.2.0 šeme
(migracija 004).

## 8. Faze (svaka ima svoj plan u `docs/superpowers/plans/`)

| Faza | Šta daje | Plan |
|---|---|---|
| 0 | Repo, Electron + Vite + React, SQLite sa migracijama, IPC okvir, okvir ekrana (meni, traka, poruke, prečice), CSS i font, ekran `/sistem` sa komponentama, test alat, instaler i GitHub ažuriranje od verzije 0.1.0 | `2026-10-20-faza-0-osnova.md` |
| 1 | Port računanja (`Broj`, `Ocena`, `Plasman`, `Priprema`) sa svim testovima iz `testovi/RacunTest.php`, `PripremaTest.php` i `dizajn/primer-podaci.json` | `2026-10-20-faza-1-racun.md` |
| 2 | Baza: Klubovi, Takmičari, Podešavanja (šifarnici, lekarski, plasman) | piše se pre početka faze |
| 3 | Takmičenja (forma, aktivno), Prijave, uvoz prijava iz docx/xlsx | isto |
| 4 | Rotacije (grupe, redosled po rotaciji, prevlačenje i tastatura) | isto |
| 5 | Unos ocena (nacrt, potvrda, odustao, ispravka sa razlogom) | isto |
| 6 | Rang liste, rezultati takmičara, štampa, bilteni, PDF | isto |
| 7 | Rezervna kopija i vraćanje, uvoz PHP kopije, Početna, Pregled takmičenja, uputstvo za instalaciju, prvo javno izdanje 1.0.0 | isto |
| 8 | Rezultati uživo: `sinhro.cjs` prema API-ju sajta (kad sajt bude imao API) | kasnije |

Posle svake faze: testovi prolaze, ekrani upoređeni sa `docs/proizvod/dizajn/slike/` na 1366x768, Bojan proba
instaler i tek onda sledeća faza. PHP verzija 1.2.0 ostaje kod testera dok faza 7 ne bude gotova.

## 9. Šta ostaje graditelju

- Tačan raspored React komponenti unutar ekrana (dok CSS klase i izgled prate makete).
- Izbor između `fast-xml-parser` i ručnog DOM parsiranja za docx/xlsx (test odlučuje: oba fajla iz
  `testovi/fajlovi/` PHP projekta moraju da prođu).
- Da li renderer drži podatke ekrana u React stanju ili ponovo čita posle svake izmene (pravilo: posle
  svake radnje stanje na ekranu mora da odgovara bazi).
