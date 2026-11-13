-- 009: objave takmicenja. uid je jedinstven kad nije prazan; objave prate sta je poslato, uvezene_objave sta je uvezeno.

ALTER TABLE takmicenja ADD COLUMN uid TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_takmicenja_uid ON takmicenja (uid) WHERE uid <> '';

CREATE TABLE IF NOT EXISTS objave (
    takmicenje_id INTEGER PRIMARY KEY,
    uid TEXT NOT NULL,
    fajl TEXT NOT NULL,
    stanje TEXT NOT NULL,
    poslednji_pokusaj TEXT NULL,
    poslato TEXT NULL,
    poruka TEXT NOT NULL DEFAULT '',
    CONSTRAINT fk_objave_takmicenje FOREIGN KEY (takmicenje_id) REFERENCES takmicenja (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- naziv i pol iz o.takmicenje: Pocetna moze da prikaze i odbijen fajl.
CREATE TABLE IF NOT EXISTS uvezene_objave (
    uid TEXT PRIMARY KEY,
    takmicenje_id INTEGER NULL,
    stanje TEXT NOT NULL,
    poruka TEXT NOT NULL DEFAULT '',
    vreme TEXT NOT NULL,
    izvor_verzija TEXT NOT NULL DEFAULT '',
    naziv TEXT NOT NULL DEFAULT '',
    pol TEXT NOT NULL DEFAULT '',
    prikazano INTEGER NOT NULL DEFAULT 0
);
