// Dev: pokrece vite, saceka server, pa electron sa VITE_DEV_URL.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const url = 'http://localhost:5173';
const koren = path.join(__dirname, '..');
const vite = spawn(process.execPath, [path.join(koren, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5173', '--strictPort'], { cwd: koren, stdio: 'inherit' });
let gotovo = false;

function ugasi(kod) {
  if (gotovo) return;
  gotovo = true;
  vite.kill();
  process.exit(kod);
}
vite.on('exit', (kod) => ugasi(kod || 1));

function saceka(pokusaj) {
  if (gotovo) return;
  http.get(url, (res) => { res.resume(); pokreniElectron(); })
    .on('error', () => {
      if (pokusaj > 100) { console.error('Vite server nije odgovorio'); ugasi(1); }
      else setTimeout(() => saceka(pokusaj + 1), 200);
    });
}

function pokreniElectron() {
  const el = spawn(require('electron'), ['.'], { cwd: koren, stdio: 'inherit', env: { ...process.env, VITE_DEV_URL: url } });
  el.on('exit', (kod) => ugasi(kod || 0));
}
saceka(0);
