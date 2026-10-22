// Cetiri koraka pripreme takmicenja za traku koraka (POPIS 5). Cista funkcija bez React-a.
// stanje: iz gim.takmicenja (prijava, nepotpune, nerasporedjeni, nepotvrdjeni_klubovi) ili null.
export function koraci(stanje, tekuci, takmId) {
  const ima = stanje != null && stanje.prijava > 0;
  const imaTakm = takmId != null;

  let opisPrijava = 'još nema prijava';
  if (ima) {
    opisPrijava = `prijava: ${stanje.prijava}`;
    if (stanje.nepotpune > 0) opisPrijava += ` · nepotpune: ${stanje.nepotpune}`;
    if (stanje.nepotvrdjeni_klubovi > 0) opisPrijava += ` · nepotvrđeni klubovi: ${stanje.nepotvrdjeni_klubovi}`;
  }
  let opisRotacija = 'posle prijava';
  if (ima) opisRotacija = stanje.nerasporedjeni > 0 ? `neraspoređeni: ${stanje.nerasporedjeni}` : 'svi su raspoređeni';

  const prijaveOk = ima && stanje.nepotpune === 0 && stanje.nepotvrdjeni_klubovi === 0;
  const rotacijeOk = ima && stanje.nerasporedjeni === 0;

  return [
    {
      kljuc: 'podaci', naslov: 'Podaci', opis: imaTakm ? 'uneti' : 'naziv, datum, pravila',
      link: imaTakm ? `#/takmicenja/izmeni?id=${takmId}` : null, stanje: imaTakm ? 'ok' : '',
    },
    {
      kljuc: 'prijave', naslov: 'Prijave', opis: opisPrijava,
      link: imaTakm ? '#/prijave' : null, stanje: !imaTakm ? '' : (prijaveOk ? 'ok' : 'fali'),
    },
    {
      kljuc: 'rotacije', naslov: 'Rotacije', opis: opisRotacija,
      link: imaTakm ? '#/rotacije' : null, stanje: !imaTakm ? '' : (rotacijeOk ? 'ok' : 'fali'),
    },
    {
      kljuc: 'pregled', naslov: 'Pregled takmičenja', opis: 'unos ocena i rang liste',
      link: imaTakm ? '#/takmicenje' : null, stanje: '',
    },
  ].map((k) => ({ ...k, tekuci: k.kljuc === tekuci }));
}
