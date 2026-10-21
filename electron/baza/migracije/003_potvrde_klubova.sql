-- 003: potvrda spiska prijava po klubu i takmicenju. Red postoji dok je spisak potvrdjen.

CREATE TABLE IF NOT EXISTS potvrde_klubova (
    takmicenje_id INTEGER NOT NULL,
    klub_id INTEGER NOT NULL,
    potvrdjeno TEXT NOT NULL,
    PRIMARY KEY (takmicenje_id, klub_id),
    CONSTRAINT fk_potvrde_klubova_takmicenje FOREIGN KEY (takmicenje_id) REFERENCES takmicenja (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_potvrde_klubova_klub FOREIGN KEY (klub_id) REFERENCES klubovi (id) ON DELETE CASCADE ON UPDATE CASCADE
);
