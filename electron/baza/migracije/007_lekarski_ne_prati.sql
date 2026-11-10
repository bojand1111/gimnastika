-- 007: lekarski proverava delegat takmicenja, pa je "ne prati se" novo podrazumevano (verzija 1.2.5).
-- Sacuvano "samo upozorenje" (stari podrazumevani izbor) prelazi u "ne prati se"; "sprecava prijavu" ostaje.

UPDATE podesavanja SET vrednost = 'ne_prati'
WHERE kljuc IN ('lekarski_sprecava_prijavu', 'lekarski_sprecava_prijavu_M', 'lekarski_sprecava_prijavu_Z') AND vrednost = 'ne';
