-- 001: pocetna sema (SQLite). Iznosi ocena su celi brojevi u hiljaditim delovima.
-- Razlika od MariaDB: nema croatian_ci kolacije, pa sortiranje c, c, dj, s, z radi aplikacija.

CREATE TABLE IF NOT EXISTS podesavanja (
    kljuc TEXT NOT NULL PRIMARY KEY,
    vrednost TEXT NULL
);

CREATE TABLE IF NOT EXISTS klubovi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puno_ime TEXT NOT NULL,
    skracenica TEXT NOT NULL,
    grad TEXT NOT NULL DEFAULT '',
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_klubovi_skracenica ON klubovi (skracenica);

CREATE TABLE IF NOT EXISTS takmicari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_broj TEXT NOT NULL,
    ime TEXT NOT NULL,
    prezime TEXT NOT NULL,
    godina_rodjenja INTEGER NOT NULL,
    pol TEXT NOT NULL,
    klub_id INTEGER NULL,
    drzavljanstvo TEXT NOT NULL DEFAULT 'Srbija',
    lekarski_do TEXT NULL,
    broj_licence TEXT NOT NULL DEFAULT '',
    trener TEXT NOT NULL DEFAULT '',
    kontakt_roditelja TEXT NOT NULL DEFAULT '',
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL,
    CONSTRAINT fk_takmicari_klub FOREIGN KEY (klub_id) REFERENCES klubovi (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_takmicari_id_broj ON takmicari (id_broj);
CREATE INDEX IF NOT EXISTS ix_takmicari_ime ON takmicari (prezime, ime);
CREATE INDEX IF NOT EXISTS ix_takmicari_klub ON takmicari (klub_id);

CREATE TABLE IF NOT EXISTS kategorije (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT NOT NULL,
    redosled INTEGER NOT NULL DEFAULT 0,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS programi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT NOT NULL,
    redosled INTEGER NOT NULL DEFAULT 0,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sprave (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pol TEXT NOT NULL,
    naziv TEXT NOT NULL,
    skracenica TEXT NOT NULL,
    ikona TEXT NOT NULL DEFAULT '',
    redosled INTEGER NOT NULL DEFAULT 0,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sprave_pol ON sprave (pol, redosled);

CREATE TABLE IF NOT EXISTS takmicenja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT NOT NULL,
    datum TEXT NOT NULL,
    mesto TEXT NOT NULL DEFAULT '',
    broj_e_sudija INTEGER NOT NULL DEFAULT 4,
    pravilo_e TEXT NOT NULL DEFAULT 'odbaci_krajnje',
    ekipno_broji INTEGER NOT NULL DEFAULT 3,
    pomeraj_redosled INTEGER NOT NULL DEFAULT 0,
    zavrseno INTEGER NOT NULL DEFAULT 0,
    zaglavlje_biltena TEXT NOT NULL DEFAULT '',
    organizator TEXT NOT NULL DEFAULT '',
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_takmicenja_datum ON takmicenja (datum);

CREATE TABLE IF NOT EXISTS prijave (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    takmicenje_id INTEGER NOT NULL,
    takmicar_id INTEGER NOT NULL,
    klub_id INTEGER NULL,
    kategorija_id INTEGER NULL,
    program_id INTEGER NULL,
    clan_ekipe INTEGER NOT NULL DEFAULT 0,
    van_konkurencije INTEGER NOT NULL DEFAULT 0,
    startni_broj INTEGER NULL,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL,
    CONSTRAINT fk_prijave_takmicenje FOREIGN KEY (takmicenje_id) REFERENCES takmicenja (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prijave_takmicar FOREIGN KEY (takmicar_id) REFERENCES takmicari (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prijave_klub FOREIGN KEY (klub_id) REFERENCES klubovi (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prijave_kategorija FOREIGN KEY (kategorija_id) REFERENCES kategorije (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prijave_program FOREIGN KEY (program_id) REFERENCES programi (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prijave_takmicenje_takmicar ON prijave (takmicenje_id, takmicar_id);
CREATE INDEX IF NOT EXISTS ix_prijave_grupa ON prijave (takmicenje_id, kategorija_id, program_id);

CREATE TABLE IF NOT EXISTS prijava_sprave (
    prijava_id INTEGER NOT NULL,
    sprava_id INTEGER NOT NULL,
    PRIMARY KEY (prijava_id, sprava_id),
    CONSTRAINT fk_prijava_sprave_prijava FOREIGN KEY (prijava_id) REFERENCES prijave (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prijava_sprave_sprava FOREIGN KEY (sprava_id) REFERENCES sprave (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS grupe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    takmicenje_id INTEGER NOT NULL,
    pol TEXT NOT NULL,
    naziv TEXT NOT NULL,
    redosled INTEGER NOT NULL DEFAULT 0,
    pocetna_pozicija INTEGER NOT NULL DEFAULT 1,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL,
    CONSTRAINT fk_grupe_takmicenje FOREIGN KEY (takmicenje_id) REFERENCES takmicenja (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_grupe_takmicenje ON grupe (takmicenje_id, pol, redosled);

CREATE TABLE IF NOT EXISTS grupa_clanovi (
    grupa_id INTEGER NOT NULL,
    prijava_id INTEGER NOT NULL,
    redosled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (grupa_id, prijava_id),
    CONSTRAINT fk_grupa_clanovi_grupa FOREIGN KEY (grupa_id) REFERENCES grupe (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_grupa_clanovi_prijava FOREIGN KEY (prijava_id) REFERENCES prijave (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupa_clanovi_prijava ON grupa_clanovi (prijava_id);

CREATE TABLE IF NOT EXISTS ocene (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prijava_id INTEGER NOT NULL,
    sprava_id INTEGER NOT NULL,
    d INTEGER NULL,
    e INTEGER NULL,
    odbitak INTEGER NULL,
    konacna INTEGER NULL,
    status TEXT NOT NULL DEFAULT 'nacrt',
    broj_ispravki INTEGER NOT NULL DEFAULT 0,
    uneto_u TEXT NULL,
    kreirano TEXT NOT NULL,
    izmenjeno TEXT NOT NULL,
    CONSTRAINT fk_ocene_prijava FOREIGN KEY (prijava_id) REFERENCES prijave (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ocene_sprava FOREIGN KEY (sprava_id) REFERENCES sprave (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocene_prijava_sprava ON ocene (prijava_id, sprava_id);
CREATE INDEX IF NOT EXISTS ix_ocene_sprava ON ocene (sprava_id);

CREATE TABLE IF NOT EXISTS ocene_e (
    ocena_id INTEGER NOT NULL,
    sudija INTEGER NOT NULL,
    vrednost INTEGER NULL,
    PRIMARY KEY (ocena_id, sudija),
    CONSTRAINT fk_ocene_e_ocena FOREIGN KEY (ocena_id) REFERENCES ocene (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS izmene_ocena (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ocena_id INTEGER NOT NULL,
    vreme TEXT NOT NULL,
    razlog TEXT NOT NULL DEFAULT '',
    staro TEXT NULL,
    novo TEXT NULL,
    CONSTRAINT fk_izmene_ocena_ocena FOREIGN KEY (ocena_id) REFERENCES ocene (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_izmene_ocena ON izmene_ocena (ocena_id);
