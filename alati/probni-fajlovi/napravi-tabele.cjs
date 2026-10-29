// Pravi probne .xls i .ods fajlove nezavisnom bibliotekom (SheetJS), za proveru citaca.
// SheetJS nije zavisnost projekta: instalirati ga u privremenu fasciklu (npm install xlsx@0.18.5)
// i pokrenuti odande: node napravi-tabele.cjs <repo>/tests/fajlovi/prijava-vojvodina.xlsx <cilj>
// Pravi prijava-vojvodina.xls, prijava-vojvodina.ods, veliki.xls (u repou mnogo-nizova.xls) i veliki.ods.
// Napomena: SheetJS upisuje datume u .ods kao UTC trenutak lokalne ponoći ("...T23:00:00.000Z").
const XLSX = require('xlsx');
const path = require('node:path');
const [izvorXlsx, cilj] = process.argv.slice(2);

// 1) postojeci xlsx primer preveden u xls i ods
const wb = XLSX.readFile(izvorXlsx, { cellDates: true, cellNF: true, cellStyles: true });
XLSX.writeFile(wb, path.join(cilj, 'prijava-vojvodina.xls'), { bookType: 'biff8', bookSST: true });
XLSX.writeFile(wb, path.join(cilj, 'prijava-vojvodina.ods'), { bookType: 'ods' });
console.log('primer:', JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false })));

// 2) veliki list: mnogo razlicitih nizova sa kvacicama (SST preko vise CONTINUE zapisa),
// brojevi, datumi, logicka vrednost, drugi list
const redovi = [['Klub', 'GK Šabac'], [], ['Prezime', 'Ime', 'Kategorija', 'Datum rođenja', 'Učešće']];
for (let i = 0; i < 1500; i++) {
  redovi.push([`Đorđević${i}ćšž`, `Žarko${i}`, i % 2 ? 'I B' : 'IV A', new Date(Date.UTC(2014, 0, 1 + i)), i % 3 ? 'ekipa' : 'pojedinac']);
}
redovi.push(['Kraj', 'Broj', 1.5, 2013, true]);
const ws = XLSX.utils.aoa_to_sheet(redovi, { cellDates: true, dateNF: 'yyyy-mm-dd' });
const veliki = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(veliki, ws, 'Prijava');
XLSX.utils.book_append_sheet(veliki, XLSX.utils.aoa_to_sheet([['drugi list', 42]]), 'Drugi');
XLSX.writeFile(veliki, path.join(cilj, 'veliki.xls'), { bookType: 'biff8', bookSST: true });
XLSX.writeFile(veliki, path.join(cilj, 'veliki.ods'), { bookType: 'ods' });
console.log('veliki gotov');
