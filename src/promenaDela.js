// Promena dela aplikacije (MSG/ZSG): ekrani prvo snime nacrte, tek onda se menja deo u glavnom procesu.

// Prvo se skida fokus sa polja (blur snimanje, npr. startni broj, ide dok je stari deo jos aktivan), pa se salje app:pre-pol.
// Ekrani slusaju app:pre-pol i u ev.detail.cekaj dodaju obecanje koje se zavrsava kad je snimanje gotovo.
export async function pripremiPromenu(meta = document) {
  meta.activeElement?.blur?.();
  const cekaj = [];
  meta.dispatchEvent(new CustomEvent('app:pre-pol', { detail: { cekaj } }));
  await Promise.all(cekaj);
}

// Vraca promeni(novi): pripremi, pa postavi(novi). Vraca novi deo, ili null kad nema posla
// (isti deo ili je promena vec u toku: drugi pritisak za to vreme se ignorise).
// Ako pripremi ili postavi puknu, greska ide dalje i deo ostaje stari.
export function napraviPromenu({ trenutni, pripremi, postavi }) {
  let uToku = false;
  return async function promeni(novi) {
    if (uToku || novi === trenutni()) return null;
    uToku = true;
    try {
      await pripremi();
      return await postavi(novi);
    } finally {
      uToku = false;
    }
  };
}

// Posle vracanja kopije glavni proces je mozda promenio deo: procitaj ga i primeni ako se razlikuje.
// Vraca novi deo, ili null kad je isti. Greska citanja ide dalje.
export async function uskladiPol({ procitaj, trenutni, primeni }) {
  const stvarni = await procitaj();
  if (stvarni === trenutni()) return null;
  primeni(stvarni);
  return stvarni;
}
