// Cista logika stanja azuriranja: bez Electrona, bez mreze.
const MREZA = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'net::'];
const NEMA_VERZIJA = ['No published versions', 'Cannot find latest.yml', 'Unable to find latest version', '404'];

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
      return napravi(stanje, { stanje: 'error', poruka });
    }
    default:
      return stanje;
  }
}
