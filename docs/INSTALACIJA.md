# Instalacija, rezervne kopije i ažuriranje

Uputstvo je pisano za nekoga ko nije programer. Sve se radi na jednom računaru sa Windows-om, bez interneta (internet treba samo za ažuriranje programa).

## 1. Instalacija

1. **Pokrenuti instaler.** Dvoklik na `Gimnastika-Setup-<verzija>.exe`. Ako Windows prikaže plavi prozor „Windows protected your PC“, kliknuti „More info“, pa „Run anyway“ (instaler nije digitalno potpisan).
2. **Fascikla.** Može se ostaviti ponuđena ili izabrati druga. Ne birati fasciklu u kojoj je stara PHP verzija (sa `Gimnastika.exe` i fasciklom `server`): instaler to odbija da se stara verzija ne pokvari.
3. **Pokretanje.** Dvoklik na prečicu „Gimnastika desktop“ na radnoj površini ili u Start meniju. Program se otvara u svom prozoru; browser i server ne trebaju.
4. **Zatvaranje.** Zatvaranjem prozora zatvara se ceo program. Program se ne može otvoriti dvaput: drugi dvoklik samo vraća postojeći prozor napred.
5. **Gde su podaci.** U fascikli `%APPDATA%\Gimnastika` (u Eksploreru ukucati taj tekst u adresnu liniju). Tamo su baza `gimnastika.sqlite`, dnevnik `dnevnik.log` i fascikla `kopije`. Deinstalacija programa ne briše tu fasciklu.

Posle prve instalacije baza je prazna: sprave i podešavanja su već upisani, a klubove, takmičare i takmičenja unosi zapisničar.

## 2. Prenos podataka sa drugog računara

1. Na starom računaru: ekran **Rezervna kopija**, dugme „Napravi rezervnu kopiju“. Zatim u listi „Prethodne kopije“ kod nove kopije kliknuti „Prikaži u fascikli“ i fajl prekopirati na USB.
2. Na novom računaru: ekran **Rezervna kopija**, dugme „Vrati iz kopije“, izabrati fajl sa USB-a i potvrditi.

Kopija iz starije verzije programa se vraća normalno. Kopija iz novije verzije se odbija: prvo treba ažurirati program. Pre vraćanja program sam pravi kopiju trenutnog stanja.

## 3. Prenos iz stare PHP verzije

1. U staroj (PHP) verziji: ekran **Rezervna kopija**, „Napravi rezervnu kopiju“, pa „Preuzmi“. Dobija se fajl `kopija_GGGG-MM-DD_HHMM.zip`. Prekopirati ga na USB ili na ovaj računar.
2. U novom programu: ekran **Rezervna kopija**, „Vrati iz kopije“ prihvata i taj zip. Posle potvrde se uvoze klubovi, takmičari, takmičenja, prijave, rotacije i ocene.

Ne prenose se grbovi (slike se ponovo dodaju na ekranu Podešavanja) i fascikla za kopije (u novom programu se podešava posebno).

Isto se može uraditi i iz komandne linije (za programera): `node alati/uvezi-php-kopiju.cjs <kopija.zip>` uz postavljen `GIM_PODACI`.

## 4. Rezervne kopije

- Kopija je jedan fajl `kopija_GGGG-MM-DD_HHMM.sqlite` sa celom bazom. Ako je u istom minutu napravljeno više kopija, imena dobijaju nastavak `_2`, `_3`.
- Prečica na ekranu Rezervna kopija: `Ctrl+S`. Isto radi i dugme „Napravi rezervnu kopiju“ (na ekranu Početna ima dugme, ali bez prečice).
- Fascikla za kopije se menja dugmetom „Promeni fasciklu“ (na primer na USB: `E:\Gimnastika\kopije`). Dugme „Vrati podrazumevanu“ vraća `%APPDATA%\Gimnastika\kopije`.
- Ako izabrana fascikla nije dostupna (USB je isključen), program koristi podrazumevanu, pored naslova piše „(podrazumevana)“ i ispod stoji poruka „Izabrana fascikla ... nije dostupna.“. Kad se USB vrati, kopije idu opet tamo.
- Program sam pravi kopije u tri slučaja: „Pre vraćanja“ (pre svakog vraćanja), „Pre ažuriranja“ (pre instalacije nove verzije) i „Pre migracije“ (kad nova verzija menja bazu). Vrsta se vidi u listi.
- Preporuka: napraviti kopiju pre početka takmičenja, posle svake rotacije i na kraju dana, i povremeno je prekopirati na USB.

## 5. Ažuriranje

Program sam proverava ima li nove verzije kad se pokrene, ako je računar na internetu. Ništa se ne preuzima niti instalira bez klika.

1. Kad nova verzija postoji, u gornjoj traci se pojavi dugme „Nova verzija“. Klik preuzima je, pa dugme postaje „Ponovo pokreni i ažuriraj“.
2. Isto se može uraditi na ekranu **Rezervna kopija**, kartica „Ažuriranje“, dugme „Proveri ažuriranje“.
3. Pre instalacije program pravi kopiju „Pre ažuriranja“. Podaci se ne menjaju; ako nova verzija menja bazu, to se radi pri pokretanju, posle kopije „Pre migracije“.

Bez interneta ažuriranja nema, a program radi kao i do sada.

## 6. Ako nešto ne radi

- **Poruka o grešci u programu.** Detalji se zapisuju u `%APPDATA%\Gimnastika\dnevnik.log`. Taj fajl poslati programeru.
- **Nestalo struje usred unosa.** Potvrđene ocene su sačuvane. Red koji je bio u toku unosa sačuvan je kao nacrt i čeka da se potvrdi.
- **Program neće da krene posle vraćanja kopije.** Pri pokretanju program sam vraća prethodnu bazu ako je vraćanje prekinuto. Ako ipak ne kreće, ništa ne brisati u fascikli `%APPDATA%\Gimnastika`: u njoj je fajl `gimnastika.sqlite.staro` (baza pre vraćanja) i u fascikli `kopije` poslednja kopija. Poslati programeru `dnevnik.log` i reći koji je od ta dva fajla sačuvan.
- **Vraćanje nije uspelo.** Poruka kaže zašto (na primer da je kopija iz novije verzije). Podaci ostaju kakvi su bili, a kopija trenutnog stanja je sačuvana kao „Pre vraćanja“.

## 7. Za programera

```
npm install                                    zavisnosti
npm start                                      gradi interfejs i otvara program
npm run dev                                    razvojni režim
npm test                                       testovi
node alati/primer-podaci.cjs                   primer takmičenje (GIM_PODACI, program zatvoren)
node alati/uvezi-php-kopiju.cjs <kopija.zip>   uvoz PHP kopije (GIM_PODACI je obavezan)
npm run installer                              pravi release\Gimnastika-Setup-<verzija>.exe
npm run publish-release -- --notes beleske/<verzija>.md --dry-run   objava izdanja (prvo probni rad)
```

Okruženje: `GIM_PODACI` (druga fascikla podataka), `GIM_EKRAN` (ekran pri pokretanju), `GIM_DEBUG=1` (ispis iz prozora i Ctrl+Shift+I). Instalirani program je `GimnastikaDesktop.exe`. Potreban je Node 22.12 ili noviji.
