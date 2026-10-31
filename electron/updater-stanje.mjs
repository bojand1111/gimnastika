// Cista logika stanja azuriranja: bez Electrona, bez mreze.
const MREZA = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'Request timed out', 'net::'];
// Poruke electron-updater i builder-util-runtime kad release ili latest.yml ne postoji.
const NEMA_VERZIJA = ['No published versions', 'Cannot find latest.yml', 'Unable to find latest version', 'status 404', 'HttpError: 404', '404 Not Found', 'HTTP 404'];
const OPSTA_GRESKA = 'Ažuriranje nije uspelo. Pogledajte dnevnik.log.';

// Tiha provera dok je program otvoren; ne dira ponudu ni preuzimanje koje je vec u toku.
export const POVREMENA_PROVERA_MS = 30 * 60 * 1000;

export function trebaPovremenaProvera(stanje) {
  return !['checking', 'available', 'downloading', 'ready'].includes(stanje.stanje);
}

export function pocetno(verzija) {
  return { stanje: 'idle', trenutna: verzija, poruka: '' };
}

function napravi(staro, polja) {
  return { trenutna: staro.trenutna, poruka: '', ...polja };
}

export function sledece(stanje, dogadjaj) {
  switch (dogadjaj.tip) {
    case 'checking':
      return napravi(stanje, { stanje: 'checking' });
    case 'available':
      return napravi(stanje, { stanje: 'available', verzija: dogadjaj.verzija });
    case 'none':
      return napravi(stanje, { stanje: 'none', poruka: dogadjaj.poruka || '' });
    case 'progress':
      return napravi(stanje, { stanje: 'downloading', verzija: stanje.verzija, procenat: dogadjaj.procenat });
    case 'downloaded':
      return napravi(stanje, { stanje: 'ready', verzija: dogadjaj.verzija || stanje.verzija });
    case 'error': {
      const poruka = String(dogadjaj.poruka || '');
      if (MREZA.some((m) => poruka.includes(m))) {
        return napravi(stanje, { stanje: 'idle', poruka: 'Nema veze sa internetom.' });
      }
      if (NEMA_VERZIJA.some((m) => poruka.includes(m))) {
        return napravi(stanje, { stanje: 'none', poruka: 'Nema objavljenih verzija.' });
      }
      // Sirov tekst ide samo u dnevnik (updater.cjs), ne u interfejs.
      return napravi(stanje, { stanje: 'error', poruka: OPSTA_GRESKA });
    }
    default:
      return stanje;
  }
}
