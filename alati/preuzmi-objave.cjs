// Bojanova skripta: spisak objavljenih takmicenja sa Cloudflare Worker-a i preuzimanje u takmicenja/.
// Pokretanje: node alati/preuzmi-objave.cjs [--sve] [--obrisi <uid>]
// Kljuc je u ~/.config/gimnastika-objave-kljuc.txt i nikad se ne ispisuje.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KLJUC_PUTANJA = path.join(os.homedir(), '.config', 'gimnastika-objave-kljuc.txt');
const FASCIKLA = path.join(__dirname, '..', 'takmicenja');

// Vraca kljuc ili null ako fajla nema ili je prazan.
function citajKljuc(putanja = KLJUC_PUTANJA) {
  try {
    return fs.readFileSync(putanja, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

const dvo = (n) => String(n).padStart(2, '0');
function datumPrikaz(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : '';
}
function vremePrikaz(iso) {
  // prihvata ISO sa zonom i 'GGGG-MM-DD HH:MM:SS' (UTC bez zone)
  const tekst = String(iso ?? '').replace(' ', 'T');
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(tekst) ? tekst : tekst + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return `${dvo(d.getDate())}.${dvo(d.getMonth() + 1)}.${d.getFullYear()}. ${dvo(d.getHours())}:${dvo(d.getMinutes())}`;
}

function upisi(putanja, tekst) {
  const privremeni = putanja + '.tmp';
  fs.writeFileSync(privremeni, tekst);
  fs.renameSync(privremeni, putanja);
}

async function main(argv, deps) {
  const { fetch, fascikla, kljuc, adresa, ispis } = deps;
  const sve = argv.includes('--sve');
  const iObrisi = argv.indexOf('--obrisi');
  if (!kljuc) {
    ispis(`Nema kljuca za objave. Upisite ga u fajl ${KLJUC_PUTANJA} (samo kljuc, bez razmaka).`);
    return 1;
  }
  if (!adresa) {
    ispis('Adresa za objave nije podesena (electron/objava-adresa.cjs je prazan).');
    return 1;
  }
  const zaglavlja = { Authorization: `Bearer ${kljuc}` };
  const zovi = (putanja, metoda) => fetch(adresa + putanja, { method: metoda, headers: zaglavlja });
  const greska = (opis, r) => ispis(`${opis} (HTTP ${r.status}${r.status === 401 ? ', kljuc nije prihvacen' : ''}).`);

  try {
    if (iObrisi !== -1) {
      const uid = argv[iObrisi + 1];
      if (!uid || !UID.test(uid)) {
        ispis('Posle --obrisi ide uid objave (npr. --obrisi 123e4567-e89b-42d3-a456-426614174000).');
        return 1;
      }
      const r = await zovi('/objave/' + uid.toLowerCase(), 'DELETE');
      if (!r.ok) {
        greska(`Brisanje objave ${uid} nije uspelo`, r);
        return 1;
      }
      ispis(`Objava ${uid} je obrisana sa sajta. Lokalni fajl u takmicenja/ nije dirnut.`);
      return 0;
    }

    const rs = await zovi('/objave', 'GET');
    if (!rs.ok) {
      greska('Spisak objava nije dobijen', rs);
      return 1;
    }
    const objave = (await rs.json()).objave ?? [];
    if (!objave.length) {
      ispis('Nema objavljenih takmicenja.');
      return 0;
    }
    const { proveriObjavu } = await import(pathToFileURL(path.join(__dirname, '..', 'electron', 'racun', 'objava-format.mjs')).href);
    fs.mkdirSync(fascikla, { recursive: true });
    let skinuto = 0;
    let neuspeh = 0;
    for (const m of objave) {
      const uid = String(m.uid ?? '').toLowerCase();
      if (!UID.test(uid)) {
        ispis(`Preskacem objavu sa neispravnim uid: ${m.uid}`);
        neuspeh++;
        continue;
      }
      const ime = path.join(fascikla, uid + '.json');
      const ima = fs.existsSync(ime);
      ispis([m.naziv, datumPrikaz(m.datum), m.pol === 'Z' ? 'ŽSG' : 'MSG', 'objavljeno ' + vremePrikaz(m.objavljeno), ima ? 'ima' : 'novo'].join(' | '));
      if (ima && !sve) continue;
      const r = await zovi('/objave/' + uid, 'GET');
      if (!r.ok) {
        greska(`  Preuzimanje ${uid} nije uspelo`, r);
        neuspeh++;
        continue;
      }
      const tekst = await r.text();
      let o;
      try {
        o = JSON.parse(tekst);
      } catch {
        ispis(`  Objava ${uid} nije ispravan JSON, nije upisana.`);
        neuspeh++;
        continue;
      }
      const greske = proveriObjavu(o);
      if (greske.length) {
        ispis(`  Objava ${uid} nije ispravna, nije upisana: ${greske.slice(0, 3).join(' ')}`);
        neuspeh++;
        continue;
      }
      upisi(ime, tekst);
      skinuto++;
    }
    ispis(`Preuzeto: ${skinuto}.` + (neuspeh ? ` Neuspelo: ${neuspeh}.` : ''));
    return neuspeh ? 1 : 0;
  } catch (e) {
    ispis(`Greska: ${e && e.message ? e.message : e}`);
    return 1;
  }
}

module.exports = { main, citajKljuc };

if (require.main === module) {
  main(process.argv.slice(2), {
    fetch: globalThis.fetch,
    fascikla: FASCIKLA,
    kljuc: citajKljuc(),
    adresa: require('../electron/objava-adresa.cjs').OBJAVA_ADRESA,
    ispis: (s) => console.log(s),
  }).then((kod) => process.exit(kod));
}
