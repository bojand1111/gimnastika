// Deli SQL tekst na naredbe (port SqlDelilac iz PHP). Postuje stringove ('...', "...", `...`) sa backslash
// escape-om i dupliranim navodnikom, komentare (-- , #, blok) i deli na ';'. Bez baze i fajlova.

export function podeli(sql) {
  const naredbe = [];
  let buf = '';
  const duz = sql.length;
  let i = 0;
  const dodaj = () => {
    const n = buf.trim();
    if (n !== '') naredbe.push(n);
    buf = '';
  };

  while (i < duz) {
    const ch = sql[i];
    const sl = i + 1 < duz ? sql[i + 1] : '';

    if (ch === '#' || (ch === '-' && sl === '-' && (i + 2 >= duz || /\s/.test(sql[i + 2])))) {
      const kraj = sql.indexOf('\n', i);
      i = kraj < 0 ? duz : kraj + 1;
      continue;
    }
    if (ch === '/' && sl === '*') {
      const kraj = sql.indexOf('*/', i + 2);
      i = kraj < 0 ? duz : kraj + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const nav = ch;
      buf += ch;
      i++;
      while (i < duz) {
        const c = sql[i];
        if (c === '\\' && nav !== '`' && i + 1 < duz) {
          buf += c + sql[i + 1];
          i += 2;
          continue;
        }
        if (c === nav) {
          if (i + 1 < duz && sql[i + 1] === nav) {
            buf += c + c;
            i += 2;
            continue;
          }
          buf += c;
          i++;
          break;
        }
        buf += c;
        i++;
      }
      continue;
    }
    if (ch === ';') {
      dodaj();
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  dodaj();
  return naredbe;
}
