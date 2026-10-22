// Poruka posle "Otvori" po POPIS 4.5; spremno nema poruku (null).
export function porukaOtvaranja(r) {
  const pre = `Aktivno takmičenje: ${r.naziv}.`;
  if (r.korak === 'prijave') {
    return r.stanje.prijava === 0
      ? `${pre} Još nema prijava: prvo prijavite takmičare.`
      : `${pre} Prijave bez kategorije, programa ili sprava: ${r.stanje.nepotpune}.`;
  }
  if (r.korak === 'rotacije') return `${pre} Takmičari koji nisu raspoređeni u grupe: ${r.stanje.nerasporedjeni}.`;
  return null;
}
