# Tok pripreme takmičenja (od verzije 1.1.0)

Dopuna za `SPECIFIKACIJA.md`, odeljak 5 (ekrani 01, 05, 06, 07). Gde se razlikuju, važi ovaj dokument. Dogovoreno sa naručiocem 01.10.2026.

## Cilj

Zapisničar prolazi pripremu redom, bez traženja po meniju: podaci takmičenja, prijave, rotacije, pa pregled takmičenja sa unosom ocena i rang listama. Početna pokazuje šta je aktivno i šta još nije dovršeno.

## MSG i ŽSG

MSG i ŽSG su dva odvojena dela aplikacije. Pol se bira jednom, prekidačem **MSG | ŽSG** u bočnom meniju (Alt+M, Alt+Z), i svaki ekran u ovom toku prikazuje samo izabrani deo: njegova takmičenja, takmičare, prijave, grupe, sprave, kategorije i programe. Takmičenje pripada jednom delu; događaj na kome nastupaju oba pola je dva takmičenja. Na ekranima Prijave, Rotacije, Uvoz i Pregled nema izbora ni filtera pola.

## Koraci

Na ekranima forme takmičenja, Prijava, Rotacija i Pregleda stoji traka sa četiri koraka: **Podaci, Prijave, Rotacije, Pregled takmičenja**. Svaki korak je link i pokazuje stanje (kvačica kad je dovršen, inače šta fali).

Stanje računa čista funkcija `App\Racun\Priprema::stanje` (testovi u `testovi/PripremaTest.php`):

- prijava je **potpuna** kad ima kategoriju, program i bar jednu spravu;
- **neraspoređen** je prijavljeni koji nije ni u jednoj grupi;
- **nepotvrđen klub** je klub sa prijavama čiji spisak zapisničar nije označio kao potvrđen;
- prvi nezavršen korak: `prijave` ako nema prijava ili ima nepotpunih, inače `rotacije` ako ima neraspoređenih, inače `spremno`. Nepotvrđen spisak ne zaustavlja pripremu, samo se prikazuje.

## Takmičenja

- Lista je preko cele širine: naziv i mesto, datum, broj E sudija, status, priprema (oznake stanja), „Izmeni" i „Otvori".
- Klik na red, Enter na izabranom redu ili „Otvori": takmičenje postaje aktivno i otvara se prvi nezavršen korak (Prijave ili Rotacije), a kad je sve spremno Pregled takmičenja. Aktivno je tačno jedno u svakom delu. Dugme „Aktiviraj" ne postoji.
- „Novo takmičenje" (Alt+N) pravi takmičenje u izabranom delu i otvara formu preko celog ekrana (`takmicenja/novo`): levo naziv, datum, mesto, broj E sudija i pravila, desno zvanični podaci za bilten (zaglavlje, organizator, domaćin, grbovi). „Sačuvaj" pravi takmičenje, postavlja ga kao aktivno i vodi na Prijave. Ista forma služi za izmenu (`takmicenja/izmeni`).

## Prijave

- Učešće je jedan izbor od tri: **Ekipa, Pojedinac, VK**. U bazi ostaju polja `clan_ekipe` i `van_konkurencije` (Ekipa = 1/0, Pojedinac = 0/0, VK = 0/1). Stari red sa oba polja uključena prikazuje se kao VK i ne menja se dok se ne klikne.
- „Novi" u levom panelu (Alt+N) otvara dijalog za takmičara koga nema u bazi: prezime, ime, ID broj (predložen sledeći), godina rođenja, klub, lekarski (pol je pol izabranog dela). Takmičar se upisuje u bazu takmičara i odmah prijavljuje; fokus ide na njegov red.
- Tabela Prijavljeni je složena po klubovima (po skraćenici, prijave bez kluba na kraju; unutar kluba po polu i prezimenu). Svaki klub ima red-naslov sa skraćenicom, punim imenom, brojem prikazanih prijava i kućicom „Spisak potvrdio klub" (tabela `potvrde_klubova`, migracija 003). Dodavanje ili uklanjanje prijave tog kluba poništava potvrdu.
- U zaglavlju tabele Prijavljeni je izbor kluba („Svi klubovi" ili jedan klub sa prijavama, „bez kluba" ako takvih ima). Prikazuje samo prijave tog kluba, da zapisničar sa trenerom prođe spisak: ugasi sprave koje takmičar ne radi, ukloni prijavu onoga ko ne nastupa (kanta), pa potvrdi spisak. Izbor se pamti po takmičenju dok je kartica pregledača otvorena; levi filter baze takmičara je nezavisan.
- Kolona Sprave je široka koliko treba polu sa najviše sprava među prikazanima; kolona Takmičar uzima ostatak (na širokom ekranu je ograničena). Ekran staje na 1366x768 bez vodoravnog skrolovanja i kad su prikazani i muški sa šest sprava.
- Dole desno „Sledeće: Rotacije". Ne zaustavlja; ako ima nepotpunih prijava ili nepotvrđenih klubova, kaže koliko.

### Uvoz prijava iz fajla

- „Uvezi iz fajla" u zaglavlju tabele Prijavljeni prima prijave klubova kao Word (.docx) ili Excel (.xlsx), više fajlova odjednom. PDF, skenovi i slike ne mogu; stari .doc i .xls klub prvo sačuva kao .docx ili .xlsx. Desktop verzija (Electron) prima i .doc, .xls, .odt, .ods i PDF sa tekstom (`electron/uvoz/citac.cjs`); skenovi i slike ni tamo ne mogu. Fajl se čita bez spoljnih biblioteka (`app/Uvoz/Docx.php`, `Xlsx.php` preko `Jezgro\Zip`).
- Program u fajlu traži tabelu čije zaglavlje ima PREZIME i IME (ili „Ime i prezime"), a ostale kolone prepoznaje po nazivu: KATEGORIJA (oznaka kao `I "B"` je kategorija I i program B), DATUM ROĐENJA ili godište, FUNKCIJA/EKIPA/UČEŠĆE (ekipa, pojedinac, VK; prazno je pojedinac), po želji POL i PROGRAM. Klub čita iz reda „Klub | ..." u zaglavlju dokumenta. Pol iz fajla (kolona ili naslov) se ne koristi: uvoz ide u aktivno takmičenje izabranog dela i svi novi takmičari dobijaju pol tog dela. Logika je u `app/Uvoz/TumacPrijave.php` i `Uparivanje.php` (čiste funkcije, testovi u `testovi/UvozTest.php`).
- Ekran Uvoz prijava (`uvoz`) je pregled pre upisa: po fajlu klub (predložen po nazivu iz fajla) i za svaku oznaku iz fajla kategorija i program iz šifarnika (ili „+ nova" kad ne postoje). Redovi su zeleni (novi takmičar), žuti (isto ime i prezime u bazi: podrazumevano se prijavljuje postojeći kad je i godina ista, inače se upisuje novi; zapisničar bira), plavi (već prijavljen, preskače se) ili crveni (nema imena, nerazumljiv datum, novi bez godine rođenja, isti takmičar dva puta u fajlu, ili takmičar koji već postoji u drugom delu). Svaki red ima kućicu „uvezi".
- „Uvezi prijave" (Ctrl+Enter) upisuje nove takmičare u bazu (ID broj dodeljuje program, sledeći slobodan; lekarski ostaje prazan) i prijavljuje sve izabrane sa kategorijom, programom, učešćem i svim spravama svog pola; klub postojećeg takmičara se ne menja. Poruka na Prijavama kaže koliko je prijavljeno, novih, postojećih i šta je preskočeno. „Otkaži" (Esc) ne upisuje ništa. Pripremljeni fajlovi stoje u sesiji do potvrde ili otkaza.

## Rotacije

Svaka izmena se čuva odmah. Dole desno „Završi pripremu" vodi na Pregled takmičenja i upozorava ako ima neraspoređenih.

**Redosled po rotaciji (od 1.1.1, migracija 004, tabela `grupa_redosled`):**

- Sastav grupe je isti u svim rotacijama. Premeštanje takmičara u drugu grupu važi za sve rotacije.
- **Promena redosleda važi samo za rotaciju u kojoj je napravljena** (odluka naručioca 01.10.2026, zamenjuje ranije pravilo da promenu u rotaciji 1 prate ostale rotacije).
- Dok se redosled u grupi ne menja, sve rotacije imaju redosled rotacije 1 (uz pomeranje „prvi ide na kraj" ako je uključeno). Redosled rotacije 1 je u `grupa_clanovi` (osnovni redosled).
- Promena redosleda u **rotaciji 1**: rotacije te grupe koje još nemaju svoj redosled prvo dobijaju upisan redosled koji su do tada imale, pa ostaju kako su bile.
- Promena redosleda u **rotaciji 2 i daljim** pamti se samo za tu rotaciju.
- Grupa koja u izabranoj rotaciji ima svoj redosled ima u zaglavlju dugme „Preuzmi redosled iz rotacije 1" (briše redosled te rotacije). Tekstualne oznake nema (odluka naručioca).
- Svoj redosled ima prednost nad pomeranjem. Takmičar dodat u grupu posle toga ide na kraj svog redosleda.
- Ako se u rotaciji 2 i daljim složeni redosled poklopi sa onim koji bi rotacija imala i bez njega, ne pamti se ništa.
- Unos ocena koristi isti redosled (`Grupe::grupaNaSpravi`).

## Pregled takmičenja (`takmicenje`)

Ono što je do 1.0.1 bila Početna, za aktivno takmičenje: naziv, datum, mesto, brojevi, pločice „Unos ocena" (nastavlja gde se stalo) i „Rang liste", plus tabela pripreme po klubovima (prijave potpune, spisak potvrđen, raspoređeni). Stavka „Pregled" u bočnom meniju.

## Početna

- Aktivno takmičenje izabranog dela sa oznakama stanja i dugmetom „Nastavi pripremu" (prvi nezavršen korak) ili „Otvori takmičenje" kad je spremno.
- Priprema aktivnog takmičenja po klubovima.
- Ostala takmičenja izabranog dela (u pripremi i završena) sa oznakama stanja i „Otvori".
- Lekarski pregledi: prijavljeni (samo takmičari izabranog dela) na nezavršena takmičenja kojima lekarski ne važi na dan takmičenja (nema ga ili je istekao) ili ističe u roku iz podešavanja `lekarski_prag_dana` posle njega.
- Rezervna kopija i prečice, kao pre.
