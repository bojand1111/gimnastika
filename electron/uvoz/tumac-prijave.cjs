// Tumači pročitane tabele kao prijavu kluba. Čiste funkcije, bez baze.
// Tabelu takmičara nalazi po zaglavlju (PREZIME, IME, KATEGORIJA, DATUM ROĐENJA, FUNKCIJA/EKIPA, KLUB),
// i na engleskom (Surname, Name, Date of Birth, Category, Club); slova drugih jezika i ćirilica se porede bez kvačica.
// Zaglavlje u posebnoj tabeli bez redova (npr. u okviru za tekst u biltenu) važi za sledeće tabele iste širine.

// Slova koja se ne razlazu na osnovno slovo i znak (NFD): srpsko dj i slova drugih jezika.
const POSEBNA = { 'đ': 'dj', 'ə': 'e', 'ı': 'i', 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'þ': 'th', 'ð': 'd', 'ħ': 'h', 'ŧ': 't' };
// Cirilica (srpska, ruska, ukrajinska, bugarska) u latinicu, samo za poredjenje.
const CIRILICA = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'dj', 'е': 'e', 'ж': 'z', 'з': 'z', 'и': 'i', 'ј': 'j', 'к': 'k',
  'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'ћ': 'c', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'c', 'џ': 'dz', 'ш': 's', 'й': 'j', 'ы': 'y', 'э': 'e', 'ю': 'ju', 'я': 'ja', 'ъ': '',
  'ь': '', 'щ': 'sc', 'ё': 'e', 'і': 'i', 'ї': 'i', 'є': 'e', 'ґ': 'g', 'ў': 'u',
};

const mala = (s) => s.toLocaleLowerCase('sr-Latn');
const velika = (s) => s.toLocaleUpperCase('sr-Latn');

// Mala slova bez kvacica i drugih znakova nad slovima (svi jezici), cirilica u latinici,
// bez navodnika i interpunkcije, jedan razmak. Sluzi samo za poredjenje; imena se cuvaju kako su napisana.
function normalizuj(s) {
  let n = mala(String(s ?? '').normalize('NFC').trim());
  n = n.replace(/[đəıłøæœßþðħŧ]/g, (z) => POSEBNA[z]);
  n = n.replace(/[Ѐ-ӿ]/g, (z) => CIRILICA[z] ?? '');
  n = n.normalize('NFD').replace(/\p{M}+/gu, '');
  return n.replace(/[^a-z0-9]+/g, ' ').trim();
}

// Nazivi kolona na srpskom i engleskom (posle normalizuj).
const PUNO_IME = ['ime i prezime', 'prezime i ime', 'name and surname', 'surname and name', 'name surname', 'surname name',
  'full name', 'first and last name', 'last and first name'];
const PREZIME_PRVO = ['prezime i ime', 'surname and name', 'surname name', 'last and first name'];
const PREZIME = ['surname', 'last name', 'lastname', 'family name'];
const IME = ['ime', 'first name', 'firstname', 'given name', 'forename'];
// "Name" sam: celo ime u jednoj celiji (prvo ime pa prezime), ili ime kad postoji kolona prezimena.
const SAMO_NAME = ['name', 'names', 'name of gymnast', 'gymnast name', 'athlete name', 'gymnast', 'gymnasts', 'athlete'];
const IMENSKA_POLJA = ['ime_prezime', 'prezime', 'ime', 'name'];
const pocinje = (n, lista) => lista.some((x) => n === x || n.startsWith(x + ' '));

// Zaglavlje tabele takmičara: indeksi kolona ili null ako red nije zaglavlje.
function kolone(red) {
  const k = {};
  let prethodni = null; // normalizovan tekst prethodne celije
  let poslednje = null; // polje dodeljeno prethodnoj celiji
  red.forEach((celija, i) => {
    const n = normalizuj(celija);
    // Spojena celija zaglavlja (npr. "Name" preko kolona Rb. i imena): imensko polje je poslednja kolona spoja.
    if (n !== '' && n === prethodni && IMENSKA_POLJA.includes(poslednje)) {
      k[poslednje] = i;
      return;
    }
    prethodni = n;
    poslednje = null;
    if (n === '') return;
    if (k.ime_prezime === undefined && PUNO_IME.some((x) => n.startsWith(x))) {
      k.ime_prezime = i;
      k.prezime_prvo = PREZIME_PRVO.some((x) => n.startsWith(x));
      poslednje = 'ime_prezime';
    } else if (k.prezime === undefined && (n.startsWith('prezime') || pocinje(n, PREZIME))) {
      k.prezime = i;
      poslednje = 'prezime';
    } else if (k.ime === undefined && pocinje(n, IME)) {
      k.ime = i;
      poslednje = 'ime';
    } else if (k.name === undefined && pocinje(n, SAMO_NAME)) {
      k.name = i;
      poslednje = 'name';
    } else if (k.kategorija === undefined && (n.includes('kategori') || n.includes('categor') || n === 'kat' || n.startsWith('kat '))) {
      k.kategorija = i;
    } else if (k.program === undefined && n.startsWith('program')) {
      k.program = i;
    } else if (k.datum === undefined && (['datum', 'rodj', 'godi', 'birth', 'born'].some((r) => n.includes(r)) || n === 'dob' || pocinje(n, ['year', 'yob']))) {
      k.datum = i;
    } else if (k.ucesce === undefined && ['funkcija', 'ekipa', 'ucesce', 'uloga', 'pojedin'].some((r) => n.includes(r))) {
      k.ucesce = i;
    } else if (k.pol === undefined && ['pol', 'sex', 'gender', 'm f', 'm z', 'm w'].includes(n)) {
      k.pol = i;
    } else if (k.klub === undefined && (n === 'klub' || n.startsWith('klub ') || n === 'drustvo' || n === 'naziv kluba' || pocinje(n, ['club']))) {
      k.klub = i;
    }
  });
  if (k.name !== undefined) {
    // "Name" uz kolonu prezimena je ime; sam, uz datum rodjenja, je celo ime (tabela trenera i sudija nema datum)
    if (k.prezime !== undefined && k.ime === undefined) k.ime = k.name;
    else if (k.ime_prezime === undefined && k.prezime === undefined && k.ime === undefined && k.datum !== undefined) {
      k.ime_prezime = k.name;
      k.prezime_prvo = false;
    }
    delete k.name;
  }
  if (k.ime_prezime !== undefined || (k.prezime !== undefined && k.ime !== undefined)) return k;
  return null;
}

// "NEORČIĆ" => "Neorčić", "laudis nanaši" => "Laudis Nanaši"; mešovita veličina slova ostaje.
function lepoIme(s) {
  s = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s === '' || (s !== velika(s) && s !== mala(s))) return s;
  // prvo slovo svakog niza slova veliko (i posle crtice i apostrofa), ostalo malo
  return s.replace(/\p{L}+/gu, (rec) => {
    const [prvi, ...ostalo] = Array.from(rec);
    return velika(prvi) + mala(ostalo.join(''));
  }).replace(/i\u0307/g, 'i'); // tursko İ: malo slovo je i, bez viska tacke (U+0307)
}

const dvocifreno = (n, duzina) => String(n).padStart(duzina, '0');

function ispravanDatum(g, m, d) {
  if (g < 1 || m < 1 || m > 12 || d < 1) return false;
  const prestupna = (g % 4 === 0 && g % 100 !== 0) || g % 400 === 0;
  const dani = [31, prestupna ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dani;
}

// Datum rođenja: dd.mm.gggg (sa viškom tačaka i razmaka), d/m/gggg, gggg-mm-dd ili samo godina.
function datum(s) {
  s = String(s).replace(/^[ \t.]+|[ \t.]+$/g, '').replace(/\s+/g, '');
  if (s === '') return { datum: null, godina: null, greska: false };
  let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\.*$/.exec(s);
  if (m) {
    let g = Number(m[3]);
    if (g < 100) g += g <= new Date().getFullYear() % 100 ? 2000 : 1900;
    if (ispravanDatum(g, Number(m[2]), Number(m[1]))) {
      return { datum: `${dvocifreno(g, 4)}-${dvocifreno(Number(m[2]), 2)}-${dvocifreno(Number(m[1]), 2)}`, godina: g, greska: false };
    }
    return { datum: null, godina: null, greska: true };
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m && ispravanDatum(Number(m[1]), Number(m[2]), Number(m[3]))) {
    return { datum: `${m[1]}-${dvocifreno(Number(m[2]), 2)}-${dvocifreno(Number(m[3]), 2)}`, godina: Number(m[1]), greska: false };
  }
  m = /^(\d{4})\.?$/.exec(s);
  if (m) return { datum: null, godina: Number(m[1]), greska: false };
  return { datum: null, godina: null, greska: true };
}

// Iz oznake kao I "B", III A, 2 "C", "I kategorija B program" izvlači kategoriju i program.
// Kad oznaka ne liči na to, cela je kategorija, program je null.
const RE_KATEGORIJA = /^([IVX]+|\d+)\s*\.?\s*(?:kat[\p{L}\p{N}_]*\.?)?\s*(?:[-–,]\s*)?([A-C])?\s*(?:prog[\p{L}\p{N}_]*\.?)?$/iu;

function kategorijaProgram(oznaka) {
  const o = oznaka.replace(/[„“”"'’‘]/g, ' ').replace(/\s+/g, ' ').trim();
  if (o === '') return { kategorija: null, program: null };
  const m = RE_KATEGORIJA.exec(o);
  if (m) return { kategorija: m[1].toUpperCase(), program: m[2] ? m[2].toUpperCase() : null };
  return { kategorija: o, program: null };
}

// ekipa | pojedinac | vk; prazno i nepoznato je pojedinac.
function ucesce(s) {
  const n = normalizuj(s);
  if (n.includes('van konk') || n === 'vk' || n.startsWith('vk ')) return 'vk';
  if (n.includes('ekip') || n.includes('tim')) return 'ekipa';
  return 'pojedinac';
}

function polIzTeksta(s) {
  const n = normalizuj(s);
  if (n === 'm' || n.startsWith('mu') || n === 'male' || n === 'man' || n === 'men' || n.startsWith('boy')) return 'M';
  if (n === 'z' || n === 'f' || n === 'w' || n.startsWith('ze') || n.startsWith('fem') || n.startsWith('wom') || n.startsWith('girl')) return 'Z';
  return null;
}

// Jedan red tabele u podatke prijave; null za prazan red (bez imena i prezimena).
function red(r, k) {
  const c = (kljuc) => (k[kljuc] !== undefined ? String(r[k[kljuc]] ?? '').trim() : '');
  let prezime;
  let ime;
  if (k.ime_prezime !== undefined) {
    const puno = c('ime_prezime').split(/\s+/).filter((x) => x !== '');
    if (puno.length >= 2) {
      // "Prezime Ime" ili "Ime Prezime": poslednja reč je jedan deo, ostatak drugi
      const poslednja = puno.pop();
      const prvi = puno.join(' ');
      [prezime, ime] = k.prezime_prvo ? [prvi, poslednja] : [poslednja, prvi];
    } else {
      prezime = puno[0] ?? '';
      ime = '';
    }
  } else {
    prezime = c('prezime');
    ime = c('ime');
  }
  prezime = lepoIme(prezime);
  ime = lepoIme(ime);
  if (prezime === '' && ime === '') return null;
  if (kolone(r) !== null) return null; // ponovljeno zaglavlje (npr. na drugoj strani)
  const popunjene = r.map((v) => String(v).trim()).filter((v) => v !== '');
  if (popunjene.length >= 2 && new Set(popunjene).size === 1) return null; // jedna ćelija preko cele širine
  const greske = [];
  if (prezime === '' || ime === '') greske.push('nedostaje ' + (prezime === '' ? 'prezime' : 'ime'));
  const d = datum(c('datum'));
  if (d.greska) greske.push('datum rođenja nije razumljiv: ' + c('datum'));
  let oznaka = c('kategorija').replace(/\s+/g, ' ').trim();
  const kp = kategorijaProgram(oznaka);
  const programKolona = c('program');
  if (programKolona !== '') {
    kp.program = velika(programKolona.replace(/^[ "'„“”]+|[ "'„“”]+$/g, ''));
    oznaka = (oznaka + ' ' + programKolona).trim();
  }
  return {
    rb: 0,
    prezime,
    ime,
    datum: d.datum,
    godina: d.godina,
    oznaka,
    kategorija: kp.kategorija,
    program: kp.program,
    ucesce: ucesce(c('ucesce')),
    pol: polIzTeksta(c('pol')),
    klub: c('klub').replace(/\s+/g, ' '),
    greske,
  };
}

// Red koji liči na zaglavlje neke druge tabele (rezultati, finala): ne nastavlja prenešeno zaglavlje.
const RECI_ZAGLAVLJA = new Set(['rb', 'r br', 'redni broj', 'mesto', 'plasman', 'ime', 'prezime', 'ime i prezime', 'prezime i ime',
  'klub', 'klub drustvo', 'drustvo', 'kategorija', 'ukupno', 'datum rodjenja', 'godiste', 'drzava']);
const liciNaZaglavlje = (r) => r.some((celija) => RECI_ZAGLAVLJA.has(normalizuj(celija)));

const KLUB_NAZIVI = ['klub', 'naziv kluba', 'klub drustvo', 'drustvo', 'club', 'club name', 'name of club', 'name of the club'];
const DRZAVA_NAZIVI = ['country', 'drzava', 'zemlja', 'nation', 'nationality'];
const SAVEZ_NAZIVI = ['national federation name', 'national federation', 'federation', 'federation name', 'savez', 'nacionalni savez'];

// Vrednost iz reda "Naziv | vrednost" u bilo kojoj tabeli; vrednost bez slova i cifara ("-----") se preskace.
// Naziv je u prvoj celiji reda, ili bilo gde u redu ako se zavrsava dvotackom ("Country:").
function vrednostReda(dokument, nazivi) {
  for (const tabela of dokument.tabele) {
    for (const r of tabela) {
      const celije = r.map((v) => String(v).trim()).filter((v) => v !== '');
      for (let i = 0; i + 1 < celije.length; i++) {
        if (i > 0 && !celije[i].endsWith(':')) continue;
        if (nazivi.includes(normalizuj(celije[i])) && normalizuj(celije[i + 1]) !== '') return celije[i + 1];
      }
    }
  }
  return '';
}

// Klub iz reda "Klub | ..." ili "Club Name | ..." u bilo kojoj tabeli, iz pasusa "Klub: ...",
// a kad kluba nema (medjunarodna prijava saveza), naziv saveza iz reda "National Federation Name | ...".
function klub(dokument) {
  const izTabele = vrednostReda(dokument, KLUB_NAZIVI);
  if (izTabele !== '') return izTabele;
  const m = /^\s*(?:naziv\s+)?klub[a]?\s*[:\-–]\s*(.+)$/imu.exec(dokument.tekst);
  if (m) return m[1].trim();
  return vrednostReda(dokument, SAVEZ_NAZIVI);
}

// Pol iz naslova dokumenta: ŽSG, WAG ili "ženska", "women" => Z; MSG, MAG ili "muška", "men" => M; inače null.
function polDokumenta(dokument) {
  let sve = dokument.tekst;
  for (const tabela of dokument.tabele) for (const r of tabela) sve += ' ' + r.join(' ');
  const n = normalizuj(sve);
  const z = /\b(zsg|zensk\w*|devojcic\w*|wag|women\w*|female|girls?)\b/.test(n);
  const m = /\b(msg|musk\w*|decac\w*|mag|men|mens|male|boys?)\b/.test(n);
  if (z && !m) return 'Z';
  if (m && !z) return 'M';
  return null;
}

// dokument: {tabele: string[][][], tekst: string}
function protumaci(dokument) {
  const izlaz = { klub: klub(dokument), drzava: vrednostReda(dokument, DRZAVA_NAZIVI), pol: polDokumenta(dokument), redovi: [], greske: [] };
  let nadjeno = false;
  let prenos = null; // {k, sirina}: zaglavlje iz tabele bez redova, za sledeće tabele bez zaglavlja
  for (const tabela of dokument.tabele) {
    let k = null;
    const prvi = tabela[0];
    if (prenos !== null && prvi !== undefined && prvi.length === prenos.sirina && kolone(prvi) === null && !liciNaZaglavlje(prvi)) {
      k = prenos.k; // tabela bez zaglavlja odmah posle zaglavlja iste širine
    } else {
      prenos = null;
    }
    let zaglavlje = null;
    let posleZaglavlja = 0;
    for (const r of tabela) {
      if (k === null) {
        k = kolone(r);
        if (k !== null) zaglavlje = r;
        continue;
      }
      if (r.some((v) => String(v).trim() !== '')) posleZaglavlja++;
      const podaci = red(r, k);
      if (podaci !== null) {
        podaci.rb = izlaz.redovi.length + 1;
        izlaz.redovi.push(podaci);
      }
    }
    if (zaglavlje !== null && posleZaglavlja === 0) prenos = { k, sirina: zaglavlje.length };
    if (k !== null) nadjeno = true;
  }
  if (!nadjeno) izlaz.greske.push('U fajlu nema tabele sa kolonama PREZIME i IME.');
  else if (izlaz.redovi.length === 0) izlaz.greske.push('Tabela sa prijavama je prazna.');
  return izlaz;
}

module.exports = { protumaci, normalizuj, datum, kategorijaProgram, ucesce, kolone };
