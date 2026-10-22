// Tumači pročitane tabele kao prijavu kluba. Čiste funkcije, bez baze.
// Tabelu takmičara nalazi po zaglavlju (PREZIME, IME, KATEGORIJA, DATUM ROĐENJA, FUNKCIJA/EKIPA).

const ZAMENE = { 'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj', 'ñ': 'n', 'ö': 'o', 'ü': 'u', 'é': 'e', 'á': 'a' };

const mala = (s) => s.toLocaleLowerCase('sr-Latn');
const velika = (s) => s.toLocaleUpperCase('sr-Latn');

// Mala slova, bez kvačica, navodnika i interpunkcije, jedan razmak.
function normalizuj(s) {
  let n = mala(String(s).trim());
  n = n.replace(/[čćšžđñöüéá]/g, (z) => ZAMENE[z]);
  return n.replace(/[^a-z0-9]+/g, ' ').trim();
}

// Zaglavlje tabele takmičara: indeksi kolona ili null ako red nije zaglavlje.
function kolone(red) {
  const k = {};
  red.forEach((celija, i) => {
    const n = normalizuj(celija);
    if (n === '') return;
    if (k.ime_prezime === undefined && (n.startsWith('ime i prezime') || n.startsWith('prezime i ime'))) {
      k.ime_prezime = i;
      k.prezime_prvo = n.startsWith('prezime');
    } else if (k.prezime === undefined && n.startsWith('prezime')) {
      k.prezime = i;
    } else if (k.ime === undefined && (n === 'ime' || n.startsWith('ime '))) {
      k.ime = i;
    } else if (k.kategorija === undefined && (n.includes('kategorija') || n === 'kat' || n.startsWith('kat '))) {
      k.kategorija = i;
    } else if (k.program === undefined && n.startsWith('program')) {
      k.program = i;
    } else if (k.datum === undefined && (n.includes('datum') || n.includes('rodj') || n.includes('godi'))) {
      k.datum = i;
    } else if (k.ucesce === undefined && ['funkcija', 'ekipa', 'ucesce', 'uloga', 'pojedin'].some((r) => n.includes(r))) {
      k.ucesce = i;
    } else if (k.pol === undefined && n === 'pol') {
      k.pol = i;
    }
  });
  if (k.ime_prezime !== undefined || (k.prezime !== undefined && k.ime !== undefined)) return k;
  return null;
}

// "NEORČIĆ" => "Neorčić", "laudis nanaši" => "Laudis Nanaši"; mešovita veličina slova ostaje.
function lepoIme(s) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s === '' || (s !== velika(s) && s !== mala(s))) return s;
  return s.split(' ').map((rec) => {
    const [prvi = '', ...ostalo] = Array.from(rec);
    return velika(prvi) + mala(ostalo.join(''));
  }).join(' ');
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
  if (n === 'm' || n.startsWith('mu')) return 'M';
  if (n === 'z' || n === 'f' || n.startsWith('ze')) return 'Z';
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
    greske,
  };
}

// Klub iz reda "Klub | ..." u bilo kojoj tabeli ili iz pasusa "Klub: ...".
function klub(dokument) {
  const nazivi = ['klub', 'naziv kluba', 'klub drustvo', 'drustvo'];
  for (const tabela of dokument.tabele) {
    for (const r of tabela) {
      const celije = r.map((v) => String(v).trim()).filter((v) => v !== '');
      if (celije.length >= 2 && nazivi.includes(normalizuj(celije[0]))) return celije[1];
    }
  }
  const m = /^\s*(?:naziv\s+)?klub[a]?\s*[:\-–]\s*(.+)$/imu.exec(dokument.tekst);
  return m ? m[1].trim() : '';
}

// Pol iz naslova dokumenta: ŽSG ili "ženska" => Z, MSG ili "muška" => M, inače null.
function polDokumenta(dokument) {
  let sve = dokument.tekst;
  for (const tabela of dokument.tabele) for (const r of tabela) sve += ' ' + r.join(' ');
  const n = normalizuj(sve);
  const z = /\b(zsg|zensk\w*|devojcic\w*)\b/.test(n);
  const m = /\b(msg|musk\w*|decac\w*)\b/.test(n);
  if (z && !m) return 'Z';
  if (m && !z) return 'M';
  return null;
}

// dokument: {tabele: string[][][], tekst: string}
function protumaci(dokument) {
  const izlaz = { klub: klub(dokument), pol: polDokumenta(dokument), redovi: [], greske: [] };
  let nadjeno = false;
  for (const tabela of dokument.tabele) {
    let k = null;
    for (const r of tabela) {
      if (k === null) {
        k = kolone(r);
        continue;
      }
      const podaci = red(r, k);
      if (podaci !== null) {
        podaci.rb = izlaz.redovi.length + 1;
        izlaz.redovi.push(podaci);
      }
    }
    if (k !== null) nadjeno = true;
  }
  if (!nadjeno) izlaz.greske.push('U fajlu nema tabele sa kolonama PREZIME i IME.');
  else if (izlaz.redovi.length === 0) izlaz.greske.push('Tabela sa prijavama je prazna.');
  return izlaz;
}

module.exports = { protumaci, normalizuj, datum, kategorijaProgram, ucesce };
