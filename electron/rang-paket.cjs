// IPC modul rang: podaci za Rang listu, Rezultate takmicara, stampu liste i bilten (POPIS 2.1, 3.1, 4.1, 5.1).
const { GreskaKorisnika } = require('./greska.cjs');
const { straneSprava, straneEkipno, straneViseboj, stavkeBiltena, straneBilten } = require('./racun/prelom.mjs');

const broj = (id) => {
  if (id === null || id === undefined || id === '') return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
};
const polNaziv = (pol) => (pol === 'M' ? 'MSG' : 'ŽSG');

// aktivnoRed: () => red aktivnog takmicenja (baca bez njega); model: modeli/rezultati; p: podesavanja; t: takmicari.
function napravi({ baza, model, p, t, aktivnoRed, grbUrl }) {
  const takmKratko = (r) => ({ id: Number(r.id), naziv: r.naziv, ekipno_broji: Number(r.ekipno_broji), pravilo_e: r.pravilo_e });
  const takmStampa = (r) => ({
    ...takmKratko(r), mesto: r.mesto ?? '', datum: r.datum ?? '', domacin: r.domacin ?? '', zaglavlje_biltena: r.zaglavlje_biltena ?? '',
  });

  // Tab: viseboj | ekipno | id sprave iz rez; nepoznat je viseboj.
  function tabIz(tab, rez) {
    if (tab === 'ekipno') return 'ekipno';
    const sp = rez.sprave.find((x) => String(x.id) === String(tab));
    return sp ? Number(sp.id) : 'viseboj';
  }

  // Zajednicki deo stampe i biltena: aktivno takmicenje, izbor i rezultati (bez prijava baca `poruka`).
  function grupa(pol, kat, prog, poruka) {
    const takm = aktivnoRed();
    const izbor = model.izbor(Number(takm.id), pol, kat, prog);
    if (!izbor.ima) throw new GreskaKorisnika(poruka);
    const rez = model.izracunaj(takm, izbor.pol, izbor.kat, izbor.prog);
    return { takm, izbor, rez };
  }

  return {
    podaci(pol, kat, prog, tab) {
      const takm = aktivnoRed();
      const izbor = model.izbor(Number(takm.id), pol, kat, prog);
      const rez = izbor.ima ? model.izracunaj(takm, izbor.pol, izbor.kat, izbor.prog) : null;
      const tabIzabran = rez ? tabIz(tab, rez) : (tab === 'ekipno' ? 'ekipno' : 'viseboj');
      return { takm: takmKratko(takm), izbor, rez, tab: tabIzabran };
    },

    // Radi i bez aktivnog takmicenja (POPIS 0.1).
    rezultati(takmicarId, tk) {
      const takmicar = t.nadji(broj(takmicarId));
      if (!takmicar) throw new GreskaKorisnika('Takmičar ne postoji.');
      const prijave = baza.svi(
        `SELECT p.*, tk.naziv AS takm_naziv, tk.datum AS takm_datum, tk.mesto AS takm_mesto, kat.naziv AS kategorija, pr.naziv AS program
         FROM prijave p JOIN takmicenja tk ON tk.id = p.takmicenje_id
         LEFT JOIN kategorije kat ON kat.id = p.kategorija_id LEFT JOIN programi pr ON pr.id = p.program_id
         WHERE p.takmicar_id = ? ORDER BY tk.datum DESC, tk.id DESC`, [Number(takmicar.id)]);
      let izabranoId = broj(tk) ?? p.aktivnoTakmicenjeId();
      if (!prijave.some((r) => Number(r.takmicenje_id) === izabranoId)) {
        izabranoId = prijave.length > 0 ? Number(prijave[0].takmicenje_id) : null;
      }
      const sva = prijave.map((prijava) => {
        const takm = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [Number(prijava.takmicenje_id)]);
        const rez = model.izracunaj(takm, takmicar.pol, prijava.kategorija_id ?? null, prijava.program_id ?? null);
        const red = rez.viseboj.find((x) => Number(x.prijava) === Number(prijava.id)) ?? null;
        return { prijava, takm, sprave: rez.sprave, red };
      });
      return { takmicar, sva, izabranoId };
    },

    stampa(pol, kat, prog, tab) {
      const { takm, izbor, rez } = grupa(pol, kat, prog, 'Nema prijava za štampu.');
      const tabIzabran = tabIz(tab, rez);
      const sprava = typeof tabIzabran === 'number' ? rez.sprave.find((x) => Number(x.id) === tabIzabran) : null;
      const polozeno = tabIzabran !== 'ekipno' && sprava === null && rez.sprave.length > 4;
      let strane;
      if (sprava) strane = straneSprava(rez.po_spravi[sprava.id] ?? []);
      else if (tabIzabran === 'ekipno') strane = straneEkipno(rez.ekipno);
      else strane = straneViseboj(rez.viseboj, polozeno);
      const vrsta = sprava ? sprava.naziv : (tabIzabran === 'ekipno' ? 'Ekipno' : 'Višeboj');
      const naziv = `${vrsta} · ${polNaziv(izbor.pol)} · ${izbor.kat_naziv} · ${izbor.prog_naziv}`;
      return {
        takm: takmStampa(takm), izbor, rez, tab: tabIzabran, sprava, polozeno, strane, naziv,
        grb: grbUrl(takm.grb_levo ? takm.grb_levo : p.dajPol('grb_levo', takm.pol, '')),
      };
    },

    bilten(pol, kat, prog) {
      const { takm, izbor, rez } = grupa(pol, kat, prog, 'Nema prijava za bilten.');
      const polozeno = rez.sprave.length > 4;
      const organizator = takm.organizator ? takm.organizator : p.dajPol('organizator', takm.pol, '');
      const strane = straneBilten(stavkeBiltena(rez), {
        polozeno, organizator, zaglavlje: takm.zaglavlje_biltena ?? '', domacin: takm.domacin ?? '',
      });
      const disciplina = `${izbor.pol === 'M' ? 'Muška' : 'Ženska'} sportska gimnastika · ${izbor.kat_naziv} · ${izbor.prog_naziv}`;
      return {
        takm: takmStampa(takm), izbor, rez, polozeno, strane, disciplina, organizator,
        grbLevo: grbUrl(takm.grb_levo ? takm.grb_levo : p.dajPol('grb_levo', takm.pol, '')),
        grbDesno: grbUrl(takm.grb_desno ? takm.grb_desno : p.dajPol('grb_desno', takm.pol, '')),
      };
    },
  };
}

module.exports = { napravi };
