// Cista logika praznih zapisnika za sprave: deljenje na strane i naslov lista.

// Redova na jednom listu A4 polozeno (visoki redovi za pisanje rukom).
export const ZAPISNIK_REDOVA = 14;

// Svaki list (sprava i rotacija) pocinje na novoj strani; dug list se deli na vise strana.
export function straneZapisnika(listovi, poStrani = ZAPISNIK_REDOVA) {
  const strane = [];
  for (const list of listovi) {
    const delova = Math.max(1, Math.ceil(list.redovi.length / poStrani));
    for (let i = 0; i < delova; i++) {
      strane.push({ list, redovi: list.redovi.slice(i * poStrani, (i + 1) * poStrani), deo: i + 1, delova });
    }
  }
  return strane;
}

export function naslovZapisnika({ list, deo, delova }) {
  const delovi = [list.sprava.naziv];
  if (list.rot !== null) delovi.push(`Rotacija ${list.rot}`);
  delovi.push(list.grupa);
  return delovi.join(' · ') + (delova > 1 ? ` (${deo}/${delova})` : '');
}
