// Objavljivanje: node installer/publish-release.cjs --notes <md> [--dry-run]
// Trazi tag v<verzija> na GitHub-u, odbija ako release postoji, salje exe, blockmap i latest.yml iz release/.
const fs = require('node:fs');
const path = require('node:path');
const { citajToken, spisakFajlova, nadjiRelease, tagPostoji, napraviRelease, dodajFajl } = require('./github.cjs');

const OWNER = 'bojand1111';
const REPO = 'gimnastika';

function argumenti(argv) {
  const a = { dryRun: false, notes: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true;
    else if (argv[i] === '--notes') a.notes = argv[++i];
    else throw new Error(`Nepoznat argument: ${argv[i]}`);
  }
  if (!a.notes) throw new Error('Nedostaje --notes <fajl.md>');
  return a;
}

async function main() {
  const { dryRun, notes } = argumenti(process.argv.slice(2));
  const koren = path.join(__dirname, '..');
  const verzija = require('../package.json').version;
  const tag = `v${verzija}`;
  if (!fs.existsSync(notes)) throw new Error(`Nema fajla sa beleskama: ${notes}`);
  const beleske = fs.readFileSync(notes, 'utf8').trim();
  const fascikla = path.join(koren, 'release');
  const imena = spisakFajlova(fascikla, verzija);
  // Probno pokretanje radi i bez tokena (javni repo, samo GET provere).
  let token = null;
  try {
    token = citajToken();
  } catch (err) {
    if (!dryRun) throw err;
    console.log(`[probno] ${err.message}; nastavljam bez tokena (samo citanje).`);
  }

  if (!(await tagPostoji({ owner: OWNER, repo: REPO, token, tag }))) {
    throw new Error(`Tag ${tag} nije na GitHub-u (${OWNER}/${REPO}). Prvo gurni tag, pa objavi.`);
  }
  if (await nadjiRelease({ owner: OWNER, repo: REPO, token, tag })) {
    throw new Error(`Release ${tag} vec postoji na GitHub-u. Podigni verziju u package.json.`);
  }

  console.log(`${dryRun ? '[probno] Poslao bih' : 'Saljem'} release ${tag} u ${OWNER}/${REPO}:`);
  console.log(`  naziv: Gimnastika ${verzija}`);
  console.log(`  beleske (${beleske.split('\n').length} reda) iz ${notes}`);
  for (const ime of imena) console.log(`  fajl: ${ime} (${fs.statSync(path.join(fascikla, ime)).size} B)`);
  if (dryRun) return;

  const r = await napraviRelease({ owner: OWNER, repo: REPO, token, tag, naziv: `Gimnastika ${verzija}`, beleske });
  for (const ime of imena) {
    await dodajFajl({ upload_url: r.upload_url, token, putanja: path.join(fascikla, ime), ime });
    console.log(`  poslato: ${ime}`);
  }
  console.log(`Gotovo: https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`);
}

main().catch((err) => { console.error(`Greska: ${err.message}`); process.exit(1); });
