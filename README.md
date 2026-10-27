# Gimnastika

Desktop aplikacija za zapisničara na takmičenju u sportskoj gimnastici
(Electron, React, SQLite). Radi bez interneta.

Potreban je Node 22.12 ili noviji (require ESM modula).

## Komande

- `npm install`: instalira zavisnosti.
- `npm start`: gradi interfejs i otvara aplikaciju.
- `npm run dev`: razvojni režim (Vite server i Electron).
- `npm test`: pokreće testove.
- `node alati/primer-podaci.cjs`: upisuje primer klubove i takmičare (fascikla podataka iz `GIM_PODACI`, inače podrazumevana; aplikacija mora biti zatvorena).
  Primer takmičenje dolazi sa po dve grupe za svaki pol (Grupa A i Grupa B), da se mogu isprobati Rotacije i kasnije Unos ocena.
  Primer takmičenje dolazi i sa unetim ocenama na svim spravama (Petrović sa stvarnim vrednostima E sudija), pa se Unos ocena i Rang liste mogu odmah isprobati.
  Za probu uvoza prijava: `tests/fajlovi/prijava-partizan.docx` i `prijava-vojvodina.xlsx` (Herceg Aron je u fajlu 2012, u bazi 2013, pa uvoz pokazuje `sličan`; Neorčić Noah pokazuje `postoji`).
- `node alati/uvezi-php-kopiju.cjs <kopija.zip>`: uvozi zip kopiju stare PHP verzije u SQLite bazu. `GIM_PODACI` je obavezan (da se slučajno ne dira prava baza); pre uvoza se pravi kopija `pre_vracanja`. Isto radi i dugme "Vrati iz kopije" u programu.
- `npm run installer`: gradi instaler u `release/` (`Gimnastika-Setup-<verzija>.exe`).
- `npm run publish-release -- --notes beleske/<verzija>.md [--dry-run]`: objavljuje izdanje na GitHub. Prvo pokrenite sa `--dry-run`. Token se čita iz `~/.config/github-token.txt`.

Uputstvo za instalaciju, prenos podataka, rezervne kopije i ažuriranje: `docs/INSTALACIJA.md`.

## Podešavanja kroz okruženje

- `GIM_PODACI`: fascikla podataka umesto podrazumevane.
- `GIM_EKRAN`: ekran koji se otvara pri pokretanju (na primer `sistem`).
- `GIM_DEBUG=1`: ispis teksta iz prozora na stdout i Ctrl+Shift+I za razvojne alate.

## Instalirani program

Izvršni fajl je `GimnastikaDesktop.exe`, a prečica se zove "Gimnastika desktop".
Podaci (`gimnastika.sqlite`, `dnevnik.log`) su u `%APPDATA%\Gimnastika` (ili u fascikli iz `GIM_PODACI`).
Profil pregledača je odvojen, u `%LOCALAPPDATA%\Gimnastika\profil`.
