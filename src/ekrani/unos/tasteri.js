// Tastatura u polju ocene (POPIS 6, keydown na .ocena; 10.11: zakljucan red se ne obradjuje).
import {
  otvoren, polja, proveriPolje, sledeciOtvoren, sledecePolje, sledeciRedSaPoljem,
} from '../unosStanje.js';
import { fokusiraj } from './fokus.js';

// ctx: { redovi(), brojSudija(), oznaciGresku(id, ime), normalizuj(id, ime, prikaz), potvrdi(id) }
export function obradiTaster(ev, id, ime, ctx) {
  const redovi = ctx.redovi();
  const i = redovi.findIndex((r) => r.prijava_id === id);
  const red = redovi[i];
  if (!red || !otvoren(red)) return;
  const lista = polja(ctx.brojSudija());
  const taster = ev.key;
  if ((taster === 'Enter' || taster === 'Tab') && !ev.shiftKey) {
    const pf = proveriPolje(red.vrednosti[ime]);
    if (!pf.ok) { ev.preventDefault(); ctx.oznaciGresku(id, ime); ev.target.select(); return; }
    ctx.normalizuj(id, ime, pf.prikaz);
    ev.preventDefault();
    if (ime !== 'odbitak') { fokusiraj(id, sledecePolje(lista, ime, 1)); return; }
    if (taster === 'Enter') { ctx.potvrdi(id); return; }
    const j = sledeciOtvoren(redovi, i); // Tab na odbitku: D sledeceg otvorenog, a bez njega ostaje
    if (j !== null) fokusiraj(redovi[j].prijava_id, 'd');
    return;
  }
  if (taster === 'Tab' && ev.shiftKey) {
    const prethodno = sledecePolje(lista, ime, -1);
    if (prethodno) { ev.preventDefault(); fokusiraj(id, prethodno); }
    return;
  }
  if (taster === 'ArrowDown' || taster === 'ArrowUp') {
    ev.preventDefault();
    const j = sledeciRedSaPoljem(redovi, i, ime, taster === 'ArrowDown' ? 1 : -1);
    if (j !== null) fokusiraj(redovi[j].prijava_id, ime);
  }
}
