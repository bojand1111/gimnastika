# Server za objave takmičenja (Cloudflare Worker)

Aplikacija šalje objavljeno takmičenje na tvoj Cloudflare Worker. Slanje ne traži ključ.
Samo ti, sa tajnim ključem, možeš da izlistaš, preuzmeš i obrišeš objave.

Sve se radi kroz Cloudflare kontrolnu tablu (dashboard), bez komandne linije. Nazivi dugmadi i menija
se vremenom menjaju, pa su koraci opisani opšte.

## 1. Nalog

1. Napravi besplatan Cloudflare nalog (ili se prijavi na postojeći).
2. U kontrolnoj tabli nađi odeljak za **Workers** (Workers & Pages).

## 2. KV namespace `OBJAVE`

1. U odeljku **Workers** nađi **KV** i napravi novi namespace.
2. Nazovi ga `OBJAVE`.

## 3. Worker

1. Napravi novi Worker (npr. `gimnastika-objave`) i otvori njegov uređivač koda.
2. Obriši početni kod i nalepi ceo sadržaj fajla `server/objave-worker.mjs`.
3. Sačuvaj i objavi (Deploy).

## 4. Vezivanje KV-a

1. U podešavanjima Worker-a nađi **Bindings** (vezivanja) i dodaj **KV namespace**.
2. Ime promenljive mora biti tačno `OBJAVE`, a namespace je onaj iz koraka 2.

## 5. Tajni ključ `KLJUC`

1. Smisli dugačak slučajan tekst (bar 40 znakova, slova i brojevi). Možeš ga napraviti npr.
   naredbom `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. U podešavanjima Worker-a dodaj promenljivu (Variables and Secrets) tipa **Secret**.
   Ime je tačno `KLJUC`, vrednost je tvoj tekst.
3. Isti tekst sačuvaj u fajlu `~/.config/gimnastika-objave-kljuc.txt` (samo ključ, u jednom redu).
   Skripta za preuzimanje čita ključ odatle. Ključ nikad ne stavljaj u repozitorijum.
4. Ponovo objavi Worker ako ga uređivač traži posle dodavanja promenljivih.

## 6. Adresa u aplikaciji

1. Kopiraj adresu Worker-a (oblika `https://ime.nalog.workers.dev`), bez završne kose crte.
2. Upiši je u `electron/objava-adresa.cjs`:

```js
module.exports = { OBJAVA_ADRESA: 'https://ime.nalog.workers.dev' };
```

Dok je adresa prazna, objava je isključena.

## 7. Provera

Zameni adresu i ključ svojim vrednostima. Odgovor mora biti `{"ok":true,"objave":[...]}`:

```
curl -H "Authorization: Bearer TVOJ_KLJUC" https://ime.nalog.workers.dev/objave
```

Bez zaglavlja ili sa pogrešnim ključem odgovor je `401`.

## Šta Worker radi

| Zahtev | Ključ | Rezultat |
| --- | --- | --- |
| `POST /objave` | ne | čuva objavu (najviše 2 MB), isti `uid` prepisuje staru |
| `GET /objave` | da | spisak objava (`uid`, `naziv`, `datum`, `pol`, `objavljeno`, `verzija`) |
| `GET /objave/<uid>` | da | cela objava |
| `DELETE /objave/<uid>` | da | briše objavu |

Odgovori: `401` bez ispravnog ključa, `413` za telo veće od 2 MB, `400` za neispravnu objavu,
`404` za nepoznatu putanju ili objavu, `405` za nedozvoljenu metodu, `500` (`Greska servera.`) ako Cloudflare ili KV zakaže.

Napomena: svako ko zna `uid` može POST-om da prepiše tu objavu (ponovna objava je tako zamišljena). Zato pregledaj preuzete fajlove pre nego što ih staviš u izdanje, i posle izdanja ne preuzimaj ponovo sve objave sa `--sve`.

Napomena: ako se vrati starija kopija baze i takmičenje ponovo objavi, ono dobija novi `uid`, pa server može da čuva dve kopije istog takmičenja; ostale instalacije drugu preskaču kao već postojeće.
