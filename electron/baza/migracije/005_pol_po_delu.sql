-- 005: pol takmicenja, kategorija i programa (MSG i ZSG su odvojeni delovi aplikacije).
-- Prazna vrednost znaci "jos nije podeljeno": postojece redove deli podeliPolove (electron/baza/podela-polova.cjs),
-- jer SQL migracija ne vidi podatke koje vracanje stare kopije tek prepisuje.

ALTER TABLE takmicenja ADD COLUMN pol TEXT NOT NULL DEFAULT '';
ALTER TABLE kategorije ADD COLUMN pol TEXT NOT NULL DEFAULT '';
ALTER TABLE programi ADD COLUMN pol TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_takmicenja_pol ON takmicenja (pol, datum);
CREATE INDEX IF NOT EXISTS ix_kategorije_pol ON kategorije (pol, redosled);
CREATE INDEX IF NOT EXISTS ix_programi_pol ON programi (pol, redosled);
