// Mali GitHub klijent za objavljivanje (samo fetch). Token se nikad ne ispisuje.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const API = 'https://api.github.com';

function zaglavlja(token, extra) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gimnastika-publish',
    ...extra,
  };
}

function citajToken(putanja = path.join(os.homedir(), '.config', 'github-token.txt')) {
  let tekst;
  try {
    tekst = fs.readFileSync(putanja, 'utf8');
  } catch {
    throw new Error(`Nema fajla sa GitHub tokenom: ${putanja}`);
  }
  const token = tekst.trim();
  if (!token) throw new Error(`Fajl sa GitHub tokenom je prazan: ${putanja}`);
  return token;
}

function spisakFajlova(fascikla, verzija) {
  const imena = [`Gimnastika-Setup-${verzija}.exe`, `Gimnastika-Setup-${verzija}.exe.blockmap`, 'latest.yml'];
  for (const ime of imena) {
    if (!fs.existsSync(path.join(fascikla, ime))) throw new Error(`Fali fajl za objavu: ${ime} (fascikla ${fascikla})`);
  }
  return imena;
}

// Vraca release za tag ili null (404).
async function nadjiRelease({ owner, repo, token, tag }) {
  const r = await fetch(`${API}/repos/${owner}/${repo}/releases/tags/${tag}`, { headers: zaglavlja(token) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub: trazenje releasea ${tag} nije uspelo (HTTP ${r.status})`);
  return r.json();
}

// Vraca true ako tag postoji na GitHub-u.
async function tagPostoji({ owner, repo, token, tag }) {
  const r = await fetch(`${API}/repos/${owner}/${repo}/git/ref/tags/${tag}`, { headers: zaglavlja(token) });
  // 409 = prazan repo (nema nijednog commita), znaci ni taga.
  if (r.status === 404 || r.status === 409) return false;
  if (!r.ok) throw new Error(`GitHub: provera taga ${tag} nije uspela (HTTP ${r.status})`);
  return true;
}

async function napraviRelease({ owner, repo, token, tag, naziv, beleske }) {
  const r = await fetch(`${API}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: zaglavlja(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ tag_name: tag, name: naziv, body: beleske, draft: false, prerelease: false }),
  });
  if (!r.ok) throw new Error(`GitHub: pravljenje releasea nije uspelo (HTTP ${r.status})`);
  const j = await r.json();
  return { id: j.id, upload_url: j.upload_url };
}

async function dodajFajl({ upload_url, token, putanja, ime }) {
  const url = `${upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(ime)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: zaglavlja(token, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(fs.statSync(putanja).size) }),
    body: fs.readFileSync(putanja),
  });
  if (!r.ok) throw new Error(`GitHub: slanje fajla ${ime} nije uspelo (HTTP ${r.status})`);
  return r.json();
}

module.exports = { citajToken, spisakFajlova, nadjiRelease, tagPostoji, napraviRelease, dodajFajl };
