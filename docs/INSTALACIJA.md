# Instalacija, rezervne kopije i ažuriranje

Uputstvo je pisano za nekoga ko nije programer. Sve se radi na jednom računaru sa Windows-om, bez interneta (internet treba samo za ažuriranje programa).

## 1. Instalacija

1. **Pokrenuti instaler.** Dvoklik na `Gimnastika-Setup-<verzija>.exe`. Ako Windows prikaže plavi prozor „Windows protected your PC“, kliknuti „More info“, pa „Run anyway“ (instaler nije digitalno potpisan).
2. **Fascikla.** Može se ostaviti ponuđena ili izabrati druga. Ne birati fasciklu u kojoj je stara PHP verzija (u kojoj postoji `Gimnastika.exe` ili fascikla `server`): instaler to odbija da se stara verzija ne pokvari.
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

1. Kad nova verzija postoji, u gornjoj traci se pojavi dugme „Nova verzija {broj}“. Klik preuzima je, pa dugme postaje „Ponovo pokreni i ažuriraj“.
2. Na ekranu **Rezervna kopija**, kartica „Ažuriranje“, dugme „Proveri ažuriranje“ samo proverava i javlja „Dostupna je verzija X.“. Preuzimanje i instalacija idu preko dugmadi u gornjoj traci iz koraka 1.
3. Pre instalacije program pravi kopiju „Pre ažuriranja“. Podaci se ne menjaju; ako nova verzija menja bazu, to se radi pri pokretanju, posle kopije „Pre migracije“.

Bez interneta ažuriranja nema, a program radi kao i do sada.

## 6. Ako nešto ne radi

- **Poruka o grešci u programu.** Detalji se zapisuju u `%APPDATA%\Gimnastika\dnevnik.log`. Taj fajl poslati programeru.
- **Nestalo struje usred unosa.** Potvrđene ocene su sačuvane. Red koji je bio u toku unosa sačuvan je kao nacrt i čeka da se potvrdi.
- **Program neće da krene posle vraćanja kopije.** Pri pokretanju program sam vraća prethodnu bazu ako je vraćanje prekinuto. Ako ipak ne kreće, ništa ne brisati u fascikli `%APPDATA%\Gimnastika`: u njoj je fajl `gimnastika.sqlite.staro` (baza pre vraćanja) i u fascikli `kopije` poslednja kopija. Poslati programeru `dnevnik.log` i reći koji je od ta dva fajla sačuvan.
- **Vraćanje nije uspelo.** Poruka kaže zašto (na primer da je kopija iz novije verzije). Podaci ostaju kakvi su bili. Fajl se prvo proverava; ako ne prođe proveru (nije kopija ovog programa, iz novije je verzije ili je oštećen), ništa se ne menja i kopija „Pre vraćanja“ se ne pravi. Ta kopija postoji samo ako je fajl prošao proveru i vraćanje je počelo.

## 7. Rezultati uživo na sajtu

Program može da šalje rang liste aktivnog takmičenja na sajt, da ih gledaoci prate uživo. Slanje ide posle svake potvrđene, odustale ili vraćene ocene (uz kratko odlaganje, pa više brzih izmena daje jedno slanje), pri startu programa ako ima izmena koje nisu poslate i na dugme „Pošalji sada“.

Adresa i token se unose na ekranu Podešavanja, u kartici „Rezultati uživo na sajtu“ (adresu i token dobijate od onoga ko održava sajt). Posle unosa kliknite „Sačuvaj podešavanja“, pa „Proveri vezu“. Dugmad „Proveri vezu“ i „Pošalji sada“ koriste već sačuvane vrednosti. Adresa mora da počinje sa `https://`; `http://` je dozvoljen samo za probni server na istom računaru (`localhost`, `127.0.0.1`). Adresa ne sme da sadrži korisničko ime, lozinku ni upit. Kad unesete adresu i token, program sam šalje rezultate koji još nisu poslati.

- Dok je adresa (ili token) prazna, ništa se ne šalje.
- Stanje slanja piše na Pregledu takmičenja: „Rezultati uživo: poslato 27.10.2026. 14:05“, „čeka slanje“, „slanje u toku“ ili „greška: …“.
- Bez interneta stanje je „greška: Sajt nije dostupan.“ Unos ocena se zbog toga ne usporava ni ne zaustavlja, a sledeća potvrđena ocena (ili „Pošalji sada“) pokušava ponovo.

## 8. Za programera

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
