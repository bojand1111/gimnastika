// Azuriranje iz GitHub Releases (electron-updater). Nista se ne preuzima ni ne instalira bez klika.
// Provajder i repo dolaze iz resources/app-update.yml koji electron-builder upise iz publish bloka.
const { pocetno, sledece } = require('./updater-stanje.mjs');

const VAN_INSTALACIJE = 'Ažuriranje radi samo u instaliranom programu.';
const kratko = (e) => String((e && e.message) || e).slice(0, 300);

function createUpdater({ app, send, dnevnik, preInstalacije }) {
  let stanje = pocetno(app.getVersion());
  let updater = null;

  function primeni(dogadjaj) {
    stanje = sledece(stanje, dogadjaj);
    dnevnik.info(`Azuriranje: ${dogadjaj.tip} -> ${stanje.stanje}${stanje.poruka ? ` (${stanje.poruka})` : ''}${stanje.verzija ? ` verzija ${stanje.verzija}` : ''}`);
    send(stanje);
  }

  if (app.isPackaged) {
    updater = require('electron-updater').autoUpdater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.logger = {
      info: (m) => dnevnik.info(`updater: ${m}`),
      warn: (m) => dnevnik.info(`updater upozorenje: ${m}`),
      error: (m) => dnevnik.info(`updater greska: ${kratko(m)}`),
      debug: () => {},
    };
    updater.on('checking-for-update', () => primeni({ tip: 'checking' }));
    updater.on('update-available', (i) => primeni({ tip: 'available', verzija: i.version }));
    updater.on('update-not-available', () => primeni({ tip: 'none' }));
    updater.on('download-progress', (p) => primeni({ tip: 'progress', procenat: Math.round(p.percent) }));
    updater.on('update-downloaded', (i) => primeni({ tip: 'downloaded', verzija: i.version }));
    updater.on('error', (e) => primeni({ tip: 'error', poruka: kratko(e) }));
  } else {
    stanje = { ...stanje, poruka: VAN_INSTALACIJE };
  }

  return {
    status: () => stanje,
    async check() {
      if (!updater || ['checking', 'downloading', 'ready'].includes(stanje.stanje)) return stanje;
      try {
        await updater.checkForUpdates();
      } catch (err) {
        // electron-updater obicno vec javi 'error' dogadjaj; ako nije, javi ovde.
        if (stanje.stanje === 'checking') primeni({ tip: 'error', poruka: kratko(err) });
      }
      return stanje;
    },
    async download() {
      if (!updater || stanje.stanje !== 'available') return stanje;
      try {
        await updater.downloadUpdate();
      } catch (err) {
        if (stanje.stanje !== 'error') primeni({ tip: 'error', poruka: kratko(err) });
      }
      return stanje;
    },
    install() {
      if (!updater || stanje.stanje !== 'ready') return false;
      preInstalacije();
      setImmediate(() => updater.quitAndInstall(false, true));
      return true;
    },
  };
}

module.exports = { createUpdater };
