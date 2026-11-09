-- 006: bonus na spravi (dodaje se konacnoj: D + E + bonus - odbitak). Postojece ocene dobijaju NULL, sto se racuna kao 0,
-- pa se nijedna vec uneta konacna ocena ne menja.

ALTER TABLE ocene ADD COLUMN bonus INTEGER NULL;
