// Stanje pripreme takmicenja (prijave, potvrde klubova, rotacije) i ucesce prijave. Ciste funkcije.

export const EKIPA = 'ekipa';
export const POJEDINAC = 'pojedinac';
export const VK = 'vk';

export const KORAK_PRIJAVE = 'prijave';
export const KORAK_ROTACIJE = 'rotacije';
export const KORAK_SPREMNO = 'spremno';

// Ucesce iz dva polja prijave. Van konkurencije ima prednost: takav se ne rangira i ne ulazi u ekipni zbir.
export function ucesce(clanEkipe, vanKonkurencije) {
  if (vanKonkurencije === 1) return VK;
  return clanEkipe === 1 ? EKIPA : POJEDINAC;
}

export function poljaUcesca(u) {
  switch (u) {
    case EKIPA: return { clan_ekipe: 1, van_konkurencije: 0 };
    case POJEDINAC: return { clan_ekipe: 0, van_konkurencije: 0 };
    case VK: return { clan_ekipe: 0, van_konkurencije: 1 };
    default: throw new Error('Nepoznato učešće: ' + u);
  }
}

// Prijava je potpuna kad ima kategoriju, program i bar jednu spravu.
export function potpuna(p) {
  return p.kategorija_id !== null && p.program_id !== null && p.broj_sprava > 0;
}

// Kljuc u `klubovi` je id kluba, 0 za prijave bez kluba (one se ne potvrdjuju).
export function stanje(prijave, potvrdjeniKlubovi) {
  const potvrdjeni = new Set(potvrdjeniKlubovi);
  const klubovi = {};
  let nepotpune = 0;
  let nerasporedjeni = 0;
  for (const p of prijave) {
    const kid = Number(p.klub_id ?? 0);
    klubovi[kid] ??= { prijava: 0, nepotpune: 0, nerasporedjeni: 0, potvrdjeno: kid !== 0 && potvrdjeni.has(kid) };
    klubovi[kid].prijava++;
    if (!potpuna(p)) {
      klubovi[kid].nepotpune++;
      nepotpune++;
    }
    if (!p.u_grupi) {
      klubovi[kid].nerasporedjeni++;
      nerasporedjeni++;
    }
  }
  let nepotvrdjeni = 0;
  for (const [kid, k] of Object.entries(klubovi)) {
    if (Number(kid) !== 0 && !k.potvrdjeno) nepotvrdjeni++;
  }
  let korak = KORAK_SPREMNO;
  if (prijave.length === 0 || nepotpune > 0) korak = KORAK_PRIJAVE;
  else if (nerasporedjeni > 0) korak = KORAK_ROTACIJE;
  return { prijava: prijave.length, nepotpune, nerasporedjeni, nepotvrdjeni_klubovi: nepotvrdjeni, korak, klubovi };
}
