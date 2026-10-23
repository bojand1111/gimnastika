// Radnje ekrana Unos ocena (POPIS 6): stanje redova, nacrt sa odlaganjem, potvrda, ispravka, odustajanje.
// Fabrika dobija ctx sa pristupom stanju kontejnera (refovi i setteri), pa rukovaoci ostaju stabilni.
// ctx: { redovi(), postaviRedove(n), d(), ziv(), ucitaj(opc), zatrazi(z), trenutni(), postaviTrenutni(id), dijalog() }
import gim from '../../gim.js';
import { obavesti } from '../../okvir/Poruke.jsx';
import {
  odustaoRec, otvoren, podaciReda, polja, preracunaj, primeniPrikaz, proveriPolje, sledeciOtvoren,
} from '../unosStanje.js';
import { fokusiraj } from './fokus.js';
import { obradiTaster } from './tasteri.js';

const ODLAGANJE_MS = 300;

export function napraviAkcije(ctx) {
  const tajmeri = new Map(); // prijava_id -> timeout nacrta
  const uToku = new Set(); // prijave ciji IPC potvrde jos traje
  const nadji = (id) => ctx.redovi().find((r) => r.prijava_id === id);
  const brojSudija = () => Number(ctx.d().brojSudija);
  const racun = (r) => preracunaj(r, brojSudija(), ctx.d().pravilo, ctx.d().zaokruzivanje);
  const spravaId = () => ctx.d().sprava.id;

  function postaviRed(id, fn) {
    ctx.postaviRedove(ctx.redovi().map((r) => (r.prijava_id === id ? fn(r) : r)));
  }

  // Polje sa novim tekstom: ocisti gresku polja i preracunaj E i konacnu.
  function postaviVrednost(id, ime, tekst, greske) {
    postaviRed(id, (r) => {
      const n = { ...r, vrednosti: { ...r.vrednosti, [ime]: tekst }, greske };
      return { ...n, ...racun(n) };
    });
  }
  const bezGreske = (r, ime) => { const g = new Set(r.greske); g.delete(ime); return g; };
  const oznaciGresku = (id, ime) => postaviRed(id, (r) => ({ ...r, greske: new Set(r.greske).add(ime) }));

  function brisiNacrt(id) { clearTimeout(tajmeri.get(id)); tajmeri.delete(id); }

  // Nacrt samo za red u statusu nacrt i bez neispravnih polja (server bi odbio ceo red).
  async function posaljiNacrt(id) {
    const red = nadji(id);
    if (!red || !ctx.d() || red.status !== 'nacrt' || red.greske.size > 0) return;
    try {
      await gim.unos.nacrt(id, spravaId(), podaciReda(red, brojSudija()));
      if (ctx.ziv()) postaviRed(id, (r) => (r.greskaCuvanja ? { ...r, greskaCuvanja: false } : r));
    } catch (e) {
      if (ctx.ziv()) postaviRed(id, (r) => (r.status === 'nacrt' ? { ...r, greskaCuvanja: true } : r));
      obavesti(`Nije sačuvano: ${e.message}`, 'greska');
    }
  }

  function zakaziNacrt(id) {
    brisiNacrt(id);
    tajmeri.set(id, setTimeout(() => { tajmeri.delete(id); posaljiNacrt(id); }, ODLAGANJE_MS));
  }

  async function isprazniNacrte() {
    const ids = [...tajmeri.keys()];
    ids.forEach(brisiNacrt);
    await Promise.all(ids.map(posaljiNacrt));
  }

  function izlaz(id, ime) {
    const red = nadji(id);
    if (!red || !otvoren(red)) return;
    const pf = proveriPolje(red.vrednosti[ime]);
    if (!pf.ok) { oznaciGresku(id, ime); return; }
    postaviVrednost(id, ime, pf.prikaz, bezGreske(red, ime));
    if (red.status === 'nacrt') zakaziNacrt(id);
  }

  // Potvrda: sva polja se proveravaju, za ispravku se pita razlog (POPIS 6, potvrdi).
  async function potvrdi(id) {
    const red0 = nadji(id);
    if (!red0 || !otvoren(red0) || uToku.has(id)) return;
    const greske = new Set();
    const vrednosti = { ...red0.vrednosti };
    for (const ime of polja(brojSudija())) {
      const pf = proveriPolje(vrednosti[ime]);
      if (pf.ok) vrednosti[ime] = pf.prikaz; else greske.add(ime);
    }
    postaviRed(id, (r) => { const n = { ...r, vrednosti, greske }; return { ...n, ...racun(n) }; });
    if (greske.size > 0) {
      obavesti('Ispravite crveno označena polja.', 'greska');
      fokusiraj(id, [...greske][0]);
      return;
    }
    const ulaz = podaciReda({ ...red0, vrednosti }, brojSudija());
    const sprava = spravaId();
    uToku.add(id);
    try {
      let razlog = '';
      if (red0.ispravlja) {
        razlog = await ctx.dijalog().pitaj();
        if (razlog === null) { fokusiraj(id, 'odbitak'); return; }
      }
      brisiNacrt(id);
      const r = await gim.unos.potvrdi(id, sprava, ulaz, razlog);
      if (!ctx.ziv()) return;
      postaviRed(id, (x) => primeniPrikaz(x, r.prikaz));
      if (razlog) { await ctx.ucitaj({ drzi: { id, polje: 'd' } }); return; } // osvezava karticu Izmene
      const redovi = ctx.redovi();
      const j = sledeciOtvoren(redovi, redovi.findIndex((x) => x.prijava_id === id));
      if (j !== null) ctx.zatrazi({ id: redovi[j].prijava_id, polje: 'd' });
      else obavesti('Svi redovi u ovoj grupi su obrađeni.', 'ok');
    } catch (e) {
      obavesti(e.message, 'greska');
      fokusiraj(id, 'd');
    } finally {
      uToku.delete(id);
    }
  }

  function ispravi(id) {
    const red = nadji(id);
    if (!red || red.ispravlja || (red.status !== 'uneto' && red.status !== 'ispravljeno')) return;
    postaviRed(id, (r) => ({ ...r, ispravlja: true }));
    ctx.postaviTrenutni(id);
    ctx.zatrazi({ id, polje: 'd' });
  }

  async function odustao(id) {
    const redovi = ctx.redovi();
    const i = redovi.findIndex((r) => r.prijava_id === id);
    const red = redovi[i];
    if (!red || red.status === 'odustao' || red.status === 'ne_radi') return;
    if (!window.confirm(`${red.ime} je ${odustaoRec(red.pol).toLowerCase()} na ovoj spravi?`)) return;
    brisiNacrt(id);
    const j = sledeciOtvoren(redovi, i);
    try {
      await gim.unos.odustao(id, spravaId());
    } catch (e) { obavesti(e.message, 'greska'); return; }
    if (ctx.ziv()) await ctx.ucitaj({ pamti: j === null ? null : redovi[j].prijava_id });
  }

  async function vrati(id) {
    try {
      await gim.unos.vrati(id, spravaId());
    } catch (e) { obavesti(e.message, 'greska'); return; }
    if (ctx.ziv()) await ctx.ucitaj({ pamti: id });
  }

  // Polje u fokusu se snima kao da je izgubilo fokus (F2/F4 ili meni dok se jos kuca).
  function izlazAktivnog() {
    const el = document.activeElement;
    const red = el && el.closest ? el.closest('#unos .unos-red[data-prijava]') : null;
    if (!red || !el.dataset || !el.dataset.polje) return;
    izlaz(Number(red.dataset.prijava), el.dataset.polje);
  }

  const tasterCtx = { redovi: ctx.redovi, brojSudija, oznaciGresku, normalizuj: (id, ime, tekst) => postaviVrednost(id, ime, tekst, bezGreske(nadji(id), ime)), potvrdi };

  // F8, F9 i Escape (ispravka) nad poslednjim fokusiranim redom, kao PHP (POPIS 10.12).
  function globalniTaster(ev) {
    if (document.querySelector('dialog[open]')) return;
    const id = ctx.trenutni();
    if (ev.key === 'F8' || ev.key === 'F9') {
      ev.preventDefault();
      if (id == null || ev.repeat) return;
      if (ev.key === 'F8') odustao(id); else ispravi(id);
    } else if (ev.key === 'Escape' && id != null && nadji(id)?.ispravlja) {
      ctx.ucitaj({ drzi: { id, polje: 'd' } });
    }
  }

  return {
    h: {
      promena: (id, ime, tekst) => postaviVrednost(id, ime, tekst, bezGreske(nadji(id), ime)),
      izlaz,
      taster: (ev, id, ime) => obradiTaster(ev, id, ime, tasterCtx),
      fokus: (id) => { if (ctx.trenutni() !== id) ctx.postaviTrenutni(id); },
      ispravi,
      odustao,
      vrati,
      ponovo: (id) => {
        const r = nadji(id);
        if (r && r.status !== 'nacrt') postaviRed(id, (x) => ({ ...x, greskaCuvanja: false }));
        else posaljiNacrt(id);
      },
    },
    globalniTaster,
    isprazniNacrte,
    izlazAktivnog,
  };
}
