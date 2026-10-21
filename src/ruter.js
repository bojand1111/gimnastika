// Ruter po hashu: '#/ekran/podekran?kljuc=vrednost'.
export function razlozi(hash) {
  const tekst = String(hash || '').replace(/^#\/?/, '');
  const [putanja, upit = ''] = tekst.split('?');
  const parametri = Object.fromEntries(new URLSearchParams(upit));
  return { ekran: putanja || 'pocetna', parametri };
}

export function url(ekran, parametri = {}) {
  const upit = new URLSearchParams(parametri).toString();
  return `#/${ekran}${upit ? `?${upit}` : ''}`;
}
