// Zajednicko seme za testove modela (POPIS 9.1): klubovi, takmicari, sifarnici, takmicenje.
const S = '2026-01-01 00:00:00';

function tokSeme(baza) {
  const ubaci = (tabela, red) => baza.ubaci(tabela, { ...red, kreirano: S, izmenjeno: S });
  const k1 = ubaci('klubovi', { puno_ime: 'Klub Jedan', skracenica: 'JED' });
  const k2 = ubaci('klubovi', { puno_ime: 'Klub Dva', skracenica: 'DVA' });
  const takmicar = (idBroj, ime, pol, godina, klub, lekarski) =>
    ubaci('takmicari', { id_broj: idBroj, ime, prezime: 'Test', godina_rodjenja: godina, pol, klub_id: klub, lekarski_do: lekarski });
  const t = {
    Ana: takmicar('001', 'Ana', 'Z', 2012, k1, '2027-01-01'),
    Bea: takmicar('002', 'Bea', 'Z', 2012, k1, '2026-01-01'),
    Ceca: takmicar('003', 'Ceca', 'Z', 2012, k2, '2027-01-01'),
    Dona: takmicar('004', 'Dona', 'Z', 2012, k2, null),
  };
  const muski = takmicar('099', 'Marko', 'M', 2011, k1, null);
  const kat = ubaci('kategorije', { naziv: 'Kadet', redosled: 1 });
  const prog = ubaci('programi', { naziv: 'C', redosled: 1 });
  const pr = ubaci('sprave', { pol: 'Z', naziv: 'Preskok', skracenica: 'PR', redosled: 1 });
  const gr = ubaci('sprave', { pol: 'Z', naziv: 'Greda', skracenica: 'GR', redosled: 2 });
  const pa = ubaci('sprave', { pol: 'M', naziv: 'Parter', skracenica: 'PA', redosled: 1 });
  const takm = ubaci('takmicenja', { naziv: 'Test kup', datum: '2026-10-17', mesto: 'NS', broj_e_sudija: 4,
    pravilo_e: 'odbaci_krajnje', ekipno_broji: 1 });
  return { k1, k2, t, muski, kat, prog, pr, gr, pa, takm };
}

module.exports = { tokSeme };
