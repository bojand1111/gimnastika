-- 008: turnus grupe. Postojece grupe su turnus 1; turnusi idu jedan za drugim, rotacije 1..n u svakom.

ALTER TABLE grupe ADD COLUMN turnus INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS ix_grupe_turnus ON grupe (takmicenje_id, pol, turnus, redosled);
