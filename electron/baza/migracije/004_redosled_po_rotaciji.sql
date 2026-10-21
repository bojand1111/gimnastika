-- 004: rucni redosled u grupi za jednu rotaciju. Redovi postoje samo za rotacije u kojima je redosled rucno menjan;
-- ostale rotacije koriste osnovni redosled iz grupa_clanovi (uz pomeranje ako je ukljuceno).

CREATE TABLE IF NOT EXISTS grupa_redosled (
    grupa_id INTEGER NOT NULL,
    rotacija INTEGER NOT NULL,
    prijava_id INTEGER NOT NULL,
    redosled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (grupa_id, rotacija, prijava_id),
    CONSTRAINT fk_grupa_redosled_grupa FOREIGN KEY (grupa_id) REFERENCES grupe (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_grupa_redosled_prijava FOREIGN KEY (prijava_id) REFERENCES prijave (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_grupa_redosled_prijava ON grupa_redosled (prijava_id);
