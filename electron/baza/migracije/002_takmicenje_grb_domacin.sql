-- 002: domacin i grbovi po takmicenju. Prazan grb znaci da se koristi grb iz opstih podesavanja.

ALTER TABLE takmicenja ADD COLUMN domacin TEXT NOT NULL DEFAULT '';
ALTER TABLE takmicenja ADD COLUMN grb_levo TEXT NOT NULL DEFAULT '';
ALTER TABLE takmicenja ADD COLUMN grb_desno TEXT NOT NULL DEFAULT '';
