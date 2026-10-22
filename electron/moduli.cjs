// Gradi IPC module iz modela. Ids iz renderera stizu kao tekst, pa se ovde pretvaraju u brojeve.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const klubovi = require('./modeli/klubovi.cjs');
const takmicari = require('./modeli/takmicari.cjs');
const sifarnici = require('./modeli/sifarnici.cjs');
const podesavanja = require('./modeli/podesavanja.cjs');
const takmicenjaModel = require('./modeli/takmicenja.cjs');
const prijaveModel = require('./modeli/prijave.cjs');
const uvozModel = require('./modeli/uvoz.cjs');
const dnevnikModul = require('./dnevnik.cjs');
const { GreskaKorisnika, OPSTA_GRESKA } = require('./greska.cjs');
const { lekarski } = require('./racun/lekarski.mjs');
const { datumPrikaz } = require('./racun/datum.mjs');

const broj = (id) => (id === null || id === undefined || id === '' ? null : Number(id));
const prazno = (v) => v === null || v === undefined || v === '';
// PHP istinitost za kvacice iz forme: '0', '', 0, false, null su ne.
const istina = (v) => Boolean(v) && v !== '0';
const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';

function napraviModule(baza, { dialog, fasciklaPodataka, roditelj = () => null, dnevnik = dnevnikModul }) {
  const k = klubovi.napravi(baza);
  const t = takmicari.napravi(baza);
  const s = sifarnici.napravi(baza);
  const p = podesavanja.napravi(baza, fasciklaPodataka());
  const tk = takmicenjaModel.napravi(baza, fasciklaPodataka);
  const pr = prijaveModel.napravi(baza, p);
  const uv = uvozModel.napravi(baza, p, dnevnik);

  // Id aktivnog takmicenja; bez njega prijave i uvoz ne rade (POPIS 0.1).
  function aktivnoRed() {
    const r = p.aktivno();
    if (r === null) throw new GreskaKorisnika(NEMA_AKTIVNOG);
    return r;
  }
  const aktivnoId = () => Number(aktivnoRed().id);

  // Dijalog za izbor fajlova; sa roditeljem kao u fazi 2.
  async function izaberi(opcije) {
    const prozor = roditelj();
    const r = prozor ? await dialog.showOpenDialog(prozor, opcije) : await dialog.showOpenDialog(opcije);
    return r.canceled ? [] : r.filePaths;
  }

  const sPolom = (pol) => (pol === 'M' || pol === 'Z' ? pol : null);

  // Prijave sa lek_ne_vazi (stanje nema | istekao na dan takmicenja) i tekstovima upozorenja (POPIS 6.3).
  function prijaveSaLekarskim(takm, pol) {
    const prag = p.dajInt('lekarski_prag_dana', 30);
    const upozorenja = [];
    const prijave = pr.lista(Number(takm.id), sPolom(pol)).map((r) => {
      const lek = lekarski(r.lekarski_do, prag, String(takm.datum));
      const neVazi = lek.stanje === 'nema' || lek.stanje === 'istekao';
      if (neVazi) {
        upozorenja.push(r.lekarski_do
          ? `${r.prezime} ${r.ime}: lekarski važi do ${datumPrikaz(r.lekarski_do)} i ne važi na dan takmičenja (${datumPrikaz(takm.datum)}).`
          : `${r.prezime} ${r.ime}: nema unet lekarski pregled.`);
      }
      return { ...r, lek, lek_ne_vazi: neVazi };
    });
    return { prijave, upozorenja };
  }

  function postoji(id) {
    if (tk.nadji(id) === null) throw new GreskaKorisnika('Takmičenje ne postoji.');
  }

  function sGrbovima(t) {
    return t ? { ...t, grb_levo_url: grbUrl(t.grb_levo), grb_desno_url: grbUrl(t.grb_desno) } : t;
  }

  // klub_id iz forme je tekst; prazan ostaje prazan (bez kluba).
  const takmicarUnos = (u) => (u && !prazno(u.klub_id) ? { ...u, klub_id: Number(u.klub_id) } : u);

  function grbUrl(vrednost) {
    if (!vrednost) return '';
    const fajl = path.join(fasciklaPodataka(), vrednost);
    // ?v= (vreme izmene) da Chromium ne prikazuje staru sliku posle zamene grba
    return fs.existsSync(fajl) ? `${pathToFileURL(fajl).href}?v=${Math.round(fs.statSync(fajl).mtimeMs)}` : '';
  }

  return {
    klubovi: {
      svi: () => k.svi(),
      nadji: (id) => k.nadji(broj(id)),
      sacuvaj: (u, id) => ({ id: k.sacuvaj(u, broj(id)) }),
      obrisi: (id) => k.obrisi(broj(id)),
    },
    takmicari: {
      svi: () => t.svi(),
      nadji: (id) => t.nadji(broj(id)),
      sacuvaj: (u, id) => ({ id: t.sacuvaj(takmicarUnos(u), broj(id)) }),
      obrisi: (id) => t.obrisi(broj(id)),
      sledeciIdBroj: () => t.sledeciIdBroj(),
    },
    sifarnici: {
      vrste: () => ({ vrste: sifarnici.VRSTE, ikone: sifarnici.IKONE }),
      lista: (vrsta) => s.lista(vrsta),
      dodaj: (vrsta, u) => {
        const id = s.dodaj(vrsta, u);
        return { id, stavka: s.nadji(vrsta, id) };
      },
      izmeni: (vrsta, id, u) => s.izmeni(vrsta, broj(id), u),
      obrisi: (vrsta, id) => s.obrisi(vrsta, broj(id)),
      redosled: (vrsta, ids) => s.redosled(vrsta, (ids || []).map(Number)),
    },
    podesavanja: {
      sva: () => {
        const sva = p.sva();
        return { ...sva, grb_levo_url: grbUrl(sva.grb_levo), grb_desno_url: grbUrl(sva.grb_desno) };
      },
      sacuvajOpsta: (u) => p.sacuvajOpsta(u),
      izaberiGrb: async () => {
        const opcije = {
          properties: ['openFile'],
          filters: [{ name: 'Slike', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif'] }],
        };
        const prozor = roditelj();
        const r = prozor ? await dialog.showOpenDialog(prozor, opcije) : await dialog.showOpenDialog(opcije);
        return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
      },
      aktivno: () => p.aktivno(),
    },
    takmicenja: {
      sva: () => {
        const aid = p.aktivnoTakmicenjeId();
        return tk.sva().map((r) => ({ ...r, status: tk.status(r, aid), stanje: pr.stanjePripreme(Number(r.id)) }));
      },
      nadji: (id) => sGrbovima(tk.nadji(broj(id))),
      prazno: () => sGrbovima(tk.prazno()),
      // Novo takmicenje odmah postaje aktivno (POPIS 4.3); renderer posle odgovora emituje app:aktivno.
      sacuvaj: (u, id) => {
        const staro = broj(id);
        const novo = staro === null;
        const sid = tk.sacuvaj(u, staro);
        if (novo) p.postavi('aktivno_takmicenje', String(sid));
        return { id: sid, novo, aktivno: novo };
      },
      izaberiGrb: async () => (await izaberi({
        properties: ['openFile'],
        filters: [{ name: 'Slike', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif'] }],
      }))[0] ?? null,
      sacuvajGrb: (id, polje, putanja) => {
        postoji(broj(id));
        const vrednost = tk.sacuvajGrb(broj(id), polje, putanja);
        return { vrednost, url: grbUrl(vrednost) };
      },
      ukloniGrb: (id, polje) => {
        postoji(broj(id));
        return tk.postaviGrb(broj(id), polje, '');
      },
      obrisi: (id) => {
        const tid = broj(id);
        tk.obrisi(tid);
        if (p.aktivnoTakmicenjeId() === tid) p.postavi('aktivno_takmicenje', '');
      },
      // Aktivira (i zavrseno) takmicenje; renderer po koraku salje poruku i skrece (POPIS 4.5).
      otvori: (id) => {
        const r = tk.nadji(broj(id));
        if (r === null) throw new GreskaKorisnika('Takmičenje ne postoji.');
        p.postavi('aktivno_takmicenje', String(r.id));
        const stanje = pr.stanjePripreme(Number(r.id));
        return { korak: stanje.korak, naziv: r.naziv, stanje };
      },
      stanje: (id) => pr.stanjePripreme(broj(id)),
    },
    prijave: {
      lista: (pol) => prijaveSaLekarskim(aktivnoRed(), pol).prijave,
      // Jedan poziv za ceo ekran Prijave (POPIS 6.3).
      podaci: (pol) => {
        const takm = aktivnoRed();
        const { prijave, upozorenja } = prijaveSaLekarskim(takm, pol);
        const stanje = pr.stanjePripreme(Number(takm.id));
        return {
          takm,
          prijave,
          upozorenja,
          takmicari: t.svi(),
          prijavljeni: pr.prijavljeniTakmicari(Number(takm.id)),
          klubovi: k.svi(),
          kategorije: s.lista('kategorije'),
          programi: s.lista('programi'),
          sprave: { M: s.sprave('M'), Z: s.sprave('Z') },
          stanje,
          ukupno: stanje.prijava,
          sledeciIdBroj: t.sledeciIdBroj(),
        };
      },
      dodaj: (ids) => pr.dodajVise(aktivnoId(), (ids || []).map(Number)),
      izmeni: (id, polje, vrednost) => {
        const pid = broj(id);
        pr.izmeniPolje(aktivnoId(), pid, polje, vrednost ?? null);
        return { prijava: pr.nadji(pid) };
      },
      sprava: (id, spravaId, radi) => pr.postaviSpravu(aktivnoId(), broj(id), broj(spravaId), istina(radi)),
      ucesce: (id, ucesce) => pr.postaviUcesce(aktivnoId(), broj(id), ucesce),
      obrisi: (id) => pr.obrisi(aktivnoId(), broj(id)),
      potvrda: (klubId, potvrdjeno) => pr.potvrdiKlub(aktivnoId(), broj(klubId), istina(potvrdjeno)),
      startni: () => ({ dodeljeno: pr.dodeliStartneBrojeve(aktivnoId()) }),
      // Novi takmicar iz ekrana Prijave; ostaje u bazi i kad prijava ne uspe (POPIS 6.5).
      noviTakmicar: (u) => {
        const aid = aktivnoId();
        const tekst = (v) => String(v ?? '').trim();
        const klub = parseInt(u.klub_id, 10) || 0;
        const tid = t.sacuvaj({
          id_broj: tekst(u.id_broj),
          ime: tekst(u.ime),
          prezime: tekst(u.prezime),
          godina_rodjenja: parseInt(u.godina_rodjenja, 10) || 0,
          pol: tekst(u.pol),
          klub_id: klub === 0 ? null : klub,
          drzavljanstvo: 'Srbija',
          lekarski_do: tekst(u.lekarski_do),
        }, null);
        const r = pr.dodajVise(aid, [tid]);
        const prijavaId = baza.vrednost('SELECT id FROM prijave WHERE takmicenje_id = ? AND takmicar_id = ?', [aid, tid]);
        return { takmicar_id: tid, prijava_id: prijavaId === null ? null : Number(prijavaId), dodato: r.dodato, preskoceno: r.preskoceno, upozorenja: r.upozorenja };
      },
      stanje: () => pr.stanjePripreme(aktivnoId()),
    },
    uvoz: {
      izaberiFajlove: () => izaberi({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Prijave', extensions: ['docx', 'xlsx'] }],
      }),
      // Fajl koji ne uspe ne zaustavlja ostale; greska ide u listu kao "{ime}: {poruka}".
      pripremi: (putanje) => {
        const aid = aktivnoId();
        const fajlovi = [];
        const greske = [];
        for (const putanja of putanje || []) {
          const ime = path.basename(String(putanja));
          try {
            fajlovi.push(uv.pripremiFajl(putanja, ime, aid));
          } catch (err) {
            if (err instanceof GreskaKorisnika) {
              greske.push(`${ime}: ${err.message}`);
            } else {
              dnevnik.greska(`uvoz ${ime}`, err);
              greske.push(`${ime}: ${OPSTA_GRESKA}`);
            }
          }
        }
        return { fajlovi, greske };
      },
      upisi: (fajlovi, izbor) => uv.upisi(aktivnoId(), fajlovi || [], izbor || {}),
    },
  };
}

module.exports = { napraviModule };
