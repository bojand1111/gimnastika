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
- `npm run installer`: gradi instaler u `release/` (`Gimnastika-Setup-<verzija>.exe`).
- `npm run publish-release -- --notes beleske/<verzija>.md [--dry-run]`: objavljuje izdanje na GitHub. Prvo pokrenite sa `--dry-run`. Token se čita iz `~/.config/github-token.txt`.

## Podešavanja kroz okruženje

- `GIM_PODACI`: fascikla podataka umesto podrazumevane.
- `GIM_EKRAN`: ekran koji se otvara pri pokretanju (na primer `sistem`).
- `GIM_DEBUG=1`: ispis teksta iz prozora na stdout i Ctrl+Shift+I za razvojne alate.

## Instalirani program

Izvršni fajl je `GimnastikaDesktop.exe`, a prečica se zove "Gimnastika desktop".
Podaci (`gimnastika.sqlite`, `dnevnik.log`) su u `%APPDATA%\Gimnastika` (ili u fascikli iz `GIM_PODACI`).
Profil pregledača je odvojen, u `%LOCALAPPDATA%\Gimnastika\profil`.
