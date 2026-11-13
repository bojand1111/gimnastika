# Objava takmičenja i deljenje kroz ažuriranje

Datum: 2026-11-13. Stanje: predlog, čeka Bojanovo odobrenje.

## 1. Namera

Zapisničar posle takmičenja klikne „Objavi takmičenje“. Takmičenje (sa ocenama i rezultatima) stigne na mesto koje vidi
samo Bojan. Bojan ga preuzme, ubaci u sledeće ažuriranje programa, i posle ažuriranja **svi** korisnici programa imaju to
takmičenje u svojoj bazi kao završeno. Cilj je zajednička arhiva takmičenja kod svih korisnika, bez ručnog prenosa fajlova.

## 2. Ciljevi, ne-ciljevi, anti-ciljevi

Ciljevi:
- Jedan klik za objavu, i kad u sali nema interneta (šalje se kad internet postoji).
- Samo Bojan čita objavljena takmičenja; svako može da pošalje.
- Posle ažuriranja takmičenje se samo doda kod svih, jednom, sa uparenim klubovima i takmičarima (bez duplikata).

Ne-ciljevi (prva verzija):
- Dvosmerna sinhronizacija, spajanje ocena sa više računara.
- Zamena već dodatog takmičenja novijom verzijom kod korisnika (vidi 7.4).
- Prenos grbova (slika), dnevnika ispravki ocena (`izmene_ocena`), potvrda klubova (`potvrde_klubova`).
- Rezultati uživo: već postoje odvojeno (faza 8, `sinhro.cjs`) i ne menjaju se.

Anti-ciljevi (neuspeh čak i ako „radi“):
- Uvoz koji izmeni ili obriše bilo šta što korisnik već ima (klubove, takmičare, takmičenja, ocene).
- Uvoz koji blokira ili ruši start programa.
- Objava koja se izgubi zato što u sali nema interneta.
- Lični podaci koji nisu potrebni za rezultate (kontakt roditelja, lekarski) u fajlu koji ide svim korisnicima.

## 3. Ograničenja

- Electron + `node:sqlite`, bez novih npm zavisnosti; ocene u hiljaditim delovima (celi brojevi).
- Šema se menja samo novom migracijom (`009_...`); postojeće se ne diraju.
- GitHub repo `bojand1111/gimnastika` je javan: objavljeni fajlovi ne idu u git, samo u instaler. Instaler je na javnom
  GitHub release-u, pa ko otpakuje instaler može da pročita fajlove takmičenja. Bojan je to prihvatio (2026-11-13),
  uz izbacivanje broja licence i trenera iz fajla.
- Svaki token ugrađen u program je javan (asar se lako otpakuje). Zato program ima samo adresu za **upis**.
- Besplatan Cloudflare nalog (Workers + KV). Free nivo (prema trećim izvorima, nije provereno na zvaničnoj strani): 1 GB
  KV, 1.000 upisa dnevno. Takmičenje je reda desetina KB.

## 4. Pristupi (razmatrani)

| Pristup | Za | Protiv |
|---|---|---|
| Dropbox deljeni link / File Request | besplatno, bez servera | File Request nema API: zapisničar ručno bira fajl u pregledaču |
| Discord webhook | 2 minuta podešavanja | ko izvuče link može da briše webhook i šalje smeće |
| GitHub repo | infrastruktura već postoji | token za upis može i da čita; javni repo izlaže podatke |
| Supabase (free) | pravila „svi upisuju, samo vlasnik čita“ | projekat se pauzira posle 7 dana neaktivnosti |
| **Cloudflare Worker + KV** (izabrano) | ne pauzira se, bez kartice, upis bez tajne, čitanje samo sa Bojanovim ključem | Bojan jednom pravi nalog i nalepi Worker |

Bojan je izabrao Cloudflare (2026-11-13). Raniji predlog „takmičenje se pravi kod Bojana i ide nadole“ je odbačen: tok ide
od zapisničara ka Bojanu, pa ka svima.

## 5. Delovi

### 5.1 Format fajla (`verzija_formata: 1`)

Jedan JSON fajl, UTF-8, ime `<uid>.json`. Sadrži kopije redova, sa **lokalnim id-jevima izvornog računara** samo kao
ključevima unutar fajla (uvoz ih nikad ne upisuje kao id-jeve):

```json
{
  "verzija_formata": 1,
  "uid": "8f0c...-uuid",
  "program": {"naziv": "Gimnastika desktop", "verzija": "1.2.9"},
  "objavljeno": "2026-11-13T18:00:00.000Z",
  "takmicenje": { "naziv", "datum", "mesto", "pol", "broj_e_sudija", "pravilo_e", "ekipno_broji",
                  "pomeraj_redosled", "zaglavlje_biltena", "organizator", "domacin" },
  "klubovi":    [{ "id", "puno_ime", "skracenica", "grad" }],
  "takmicari":  [{ "id", "ime", "prezime", "godina_rodjenja", "pol", "klub_id", "drzavljanstvo" }],
  "kategorije": [{ "id", "naziv", "pol", "redosled" }],
  "programi":   [{ "id", "naziv", "pol", "redosled" }],
  "sprave":     [{ "id", "pol", "skracenica", "naziv" }],
  "prijave":    [{ "id", "takmicar_id", "klub_id", "kategorija_id", "program_id", "clan_ekipe", "van_konkurencije", "startni_broj", "sprave": [id...] }],
  "grupe":      [{ "id", "pol", "naziv", "redosled", "pocetna_pozicija", "turnus", "clanovi": [{"prijava_id","redosled"}],
                   "redosled_po_rotaciji": [{"rotacija","prijava_id","redosled"}] }],
  "ocene":      [{ "prijava_id", "sprava_id", "d", "e", "bonus", "odbitak", "konacna", "status", "broj_ispravki", "uneto_u", "e_sudije": [{"sudija","vrednost"}] }]
}
```

Ne ulaze: `kontakt_roditelja`, `lekarski_do`, `broj_licence`, `trener`, `id_broj` (lokalni broj), `grb_levo/grb_desno`, `zavrseno`, `izmene_ocena`,
`potvrde_klubova`, `podesavanja`. Klubovi, takmičari, kategorije i programi ulaze **samo oni koje takmičenje koristi**.
Gradnja fajla je čista funkcija nad redovima (testira se bez baze).

### 5.2 Migracija 009

- `takmicenja.uid TEXT NOT NULL DEFAULT ''` + jedinstveni indeks nad `uid` gde `uid <> ''`.
- Tabela `objave` (stanje slanja kod zapisničara): `takmicenje_id` PK, `uid`, `fajl`, `stanje` (`ceka`|`poslato`|`greska`),
  `poslednji_pokusaj`, `poslato`, `poruka`.
- Tabela `uvezene_objave` (kod korisnika): `uid` PK, `takmicenje_id NULL`, `stanje` (`uvezeno`|`postoji`|`odbijeno`),
  `poruka`, `vreme`, `izvor_verzija`. Fajl sa redom ovde se više ne obrađuje.

### 5.3 Objava (računar zapisničara)

- Dugme „Objavi takmičenje“ na ekranu Pregled takmičenja. Dijalog potvrde kaže šta se šalje (rezultati, imena, klubovi,
  godine rođenja; ne šalje kontakt roditelja ni lekarski). Ako takmičenje nije označeno kao završeno, dijalog to napomene,
  ali dozvoli objavu.
- Prvi put takmičenje dobija `uid` (`crypto.randomUUID()`). Ponovna objava istog takmičenja koristi isti `uid` i na serveru
  prepisuje prethodnu.
- Fajl se **prvo** upiše u `%APPDATA%\Gimnastika\objave\<uid>.json` i red u `objave` dobije `ceka`; tek onda `POST`.
  Uspeh: `poslato` + vreme. Greška mreže: ostaje `ceka`, poruka „Biće poslato kad bude interneta.“
- Ponovni pokušaj: pri svakom startu programa (posle 10 s) za sve redove `ceka`, i ručno istim dugmetom. Nema tajmera
  koji stalno pokušava (isto pravilo kao `sinhro.cjs`).
- Adresa servera je konstanta u kodu (`electron/objava-adresa.cjs`), ne podešavanje. Prazna adresa: dugme je
  onemogućeno uz objašnjenje. Zahtev: `POST {adresa}/objave`, `Content-Type: application/json`, zaglavlje
  `X-Gimnastika-Verzija`, vremensko ograničenje 15 s, bez ikakvog tokena.
- Status objave (poslato kada, ili čeka) vidi se pored dugmeta.

### 5.4 Cloudflare Worker (`server/objave-worker.mjs` u repou)

- `POST /objave`: prihvata telo do 2 MB, proverava `verzija_formata`, oblik `uid` (UUID) i da postoje `takmicenje.naziv`
  i `takmicenje.datum`. Upisuje KV ključ `objava:<uid>` sa metapodacima `{naziv, datum, pol, objavljeno, verzija}`.
  Odgovor `200 {"ok":true}`; `400` loš sadržaj; `413` prevelik.
- `GET /objave`, `GET /objave/<uid>`, `DELETE /objave/<uid>`: samo uz `Authorization: Bearer <KLJUC>`, gde je `KLJUC`
  tajna promenljiva Worker-a (zna je samo Bojan). Bez ključa `401`.
- Testovi: Worker modul se uvozi u `node --test` sa lažnim KV objektom.
- Uputstvo `docs/OBJAVE-SERVER.md`: nalog, napravi KV namespace, nalepi Worker, veži KV, postavi `KLJUC`, upiši adresu
  u `electron/objava-adresa.cjs`. Bojan to radi sam (Claude ne pravi naloge).

### 5.5 Bojanova strana (repo)

- `node alati/preuzmi-objave.cjs [--sve]`: čita ključ iz `~/.config/gimnastika-objave-kljuc.txt`, ispisuje listu
  (naziv, datum, pol, kad je objavljeno) i skida u `takmicenja/` one kojih tamo još nema (`--sve` skida i novije verzije
  istog `uid`). Ne briše ništa na serveru; brisanje je ručno (`--obrisi <uid>`).
- `takmicenja/*.json` je u `.gitignore`; u gitu je samo `takmicenja/README.md`.
- `installer/electron-builder.yml`: `extraResources` `from: takmicenja, to: takmicenja, filter: ["*.json"]`.
- Bojan pregleda fajlove (može da obriše neki koji ne želi), pa pravi instaler i release kao i do sada.

### 5.6 Uvoz pri startu (računar korisnika)

- Posle migracija i `podeliPolove`, glavni proces čita `process.resourcesPath/takmicenja/*.json` (u razvoju
  `<repo>/takmicenja/`). Preskače fajl čiji je `uid` u `uvezene_objave` ili u `takmicenja.uid`, i fajl sa nepoznatom
  `verzija_formata`.
- Ako ima bar jedan nov: jedna rezervna kopija nove vrste `pre_uvoza` („Pre uvoza takmičenja“), pa svaki fajl u svojoj
  transakciji. Greška jednog fajla: rollback tog fajla, zapis u dnevnik, ostali se nastavljaju; neuspeli se pokušava pri
  sledećem startu. Ništa od ovoga ne zaustavlja otvaranje prozora.
- Uparivanje (samo čitanje postojećeg, nikad izmena):
  - Klub: tačna skraćenica (normalizovano) je poklapanje (skraćenice saveza su standardne); inače isto jezgro naziva
    (`nadjiKlubDetaljno`, bez delimičnog poklapanja). Nema poklapanja: novi klub sa skraćenicom iz fajla (ona tada
    sigurno nije zauzeta, jer bi tačna skraćenica bila poklapanje). Skraćenica iz fajla već prolazi `^\p{L}{2,4}$`.
  - Takmičar: isti pol, ime i prezime (normalizovano, i zamenjen redosled) i godina rođenja, kao `POSTOJI` u
    `uparivanje.cjs`. Nema: novi takmičar sa klubom iz fajla i `id_broj` oblika `U<8 znakova uid>-<n>` (nije samo od
    cifara, pa `sledeciIdBroj` ga preskače i korisnikovo numerisanje se ne pomera).
  - Kategorija i program: isti `pol` i naziv (normalizovano). Nema: nova, na kraju redosleda.
  - Sprava: isti `pol` i skraćenica. Nema: fajl se ne uvozi.
- Provera pre kopije: svi fajlovi se prvo provere (format, sprave) bez upisa. Kopija `pre_uvoza` se pravi samo ako bar
  jedan fajl prolazi. Fajl koji ne prolazi proveru dobija red u `uvezene_objave` sa `stanje = 'odbijeno'` i razlogom, pa
  se ne pokušava pri svakom startu (dodati kolone `stanje`, `poruka` u 5.2).
- Isto takmičenje bez `uid`: ako lokalno postoji takmičenje istog `pol`, `datum` i naziva (normalizovano), fajl se ne
  uvozi; red u `uvezene_objave` sa `stanje = 'postoji'` i `takmicenje_id` tog lokalnog takmičenja. Duplikat je gori od
  preskakanja, jer korisnik to takmičenje već ima.
- Takmičenje se upisuje sa `zavrseno = 1`, `uid` iz fajla, praznim grbovima; nikad ne postaje aktivno.
- Uvezeno takmičenje (red u `uvezene_objave` sa `takmicenje_id`) **ne može da se objavi**: dugme je onemogućeno, da
  korisnik ne bi prepisao originalnu objavu na serveru.
- Brisanje uvezenog takmičenja nije u obimu: važi postojeće pravilo (`takmicenja.obrisi` odbija takmičenje sa prijavama).
- Posle uvoza Početna jednom prikaže karticu „Iz ažuriranja dodata takmičenja: …“ sa linkovima, i odbijene sa razlogom.

## 6. Šta je odlučio Bojan

- Tok: zapisničar objavljuje, Bojan prikuplja i ubacuje u ažuriranje, svi dobijaju takmičenje.
- Skladište: Cloudflare (Worker + KV), samo Bojan čita.
- Fajlovi u javnom instaleru su prihvatljivi; broj licence i trener se ne prenose.
- Uvezeni takmičari i klubovi se vide u Takmičarima, Klubovima i izboru za prijave kao i svi ostali (bez oznake i
  filtera; nema nove kolone za to).

## 7. Moje odluke (Bojan može da ih promeni)

1. Prenose se ocene i rezultati; ne prenose se kontakt roditelja, lekarski, broj licence, trener, grbovi, dnevnik ispravki.
2. Uvoz kod korisnika je automatski pri startu posle ažuriranja (Bojan: „svi da imaju to takmičenje“), bez pitanja.
3. Objava je dozvoljena i za takmičenje koje nije označeno kao završeno, uz napomenu.
4. Takmičenje koje korisnik već ima (isti `uid`) se ne menja kad stigne novija verzija istog fajla.
5. Godina rođenja ostaje u fajlu: potrebna je za uparivanje i već se vidi u biltenima.

## 8. Ostavljeno graditelju

- Tačan izgled dugmeta i statusa na Pregledu takmičenja (po `dizajn/` sistemu), tekst poruka.
- Raspodela koda po modulima (`electron/modeli/objava.cjs`, `electron/racun/objava-format.mjs` ili slično).
- Redosled uvoza više fajlova (po datumu takmičenja).

## 9. Nije u obimu ovog dokumenta, a treba proveriti uživo

- Pravi Cloudflare nalog i Worker (Bojan), slanje sa pravog laptopa bez/sa internetom.
- Instaler sa `extraResources` i uvoz na čistoj instalaciji i na ažuriranju sa 1.2.8.

## 10. Otvorena pitanja za Bojana

Nema (oba pitanja odgovorena 2026-11-13, vidi 6).
