// Cisti tekstovi ekrana Rezervna kopija (POPIS 3.2, 3.3, 6.5).

// Vrsta kopije za tabelu; null kad fajl nema ispravan opis ("neispravan fajl").
export function vrstaTekst(opis, VRSTE) {
  if (!opis) return null;
  return VRSTE?.[opis.vrsta] ?? opis.vrsta ?? '';
}

// Potvrda vracanja: sa imenom iz liste ili za fajl koji je korisnik izabrao.
export function potvrdaTekst(ime) {
  const izvor = ime ? ime : 'izabranog fajla';
  return `Vratiti podatke iz ${izvor}? Svi trenutni podaci se zamenjuju (pre toga se pravi kopija trenutnog stanja).`;
}

export function porukaNapravljena({ ime, velicinaTekst }) {
  return `Rezervna kopija je napravljena: ${ime} (${velicinaTekst}).`;
}

// Naslov i napomena kartice sa fasciklom; fascikla: {podrazumevana, izabrana, nedostupna}.
export function fasciklaOpis(fascikla) {
  return {
    naslov: `Fascikla za kopije${fascikla.podrazumevana ? ' (podrazumevana)' : ''}`,
    napomena: fascikla.nedostupna ? `Izabrana fascikla ${fascikla.izabrana} nije dostupna.` : '',
  };
}
