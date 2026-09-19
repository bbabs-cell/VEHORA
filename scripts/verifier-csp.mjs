// Vérifie que l'application tourne sous la politique de sécurité de contenu
// (CSP) que Vercel servira — avant de la découvrir cassée en ligne.
//
// Une CSP trop stricte ne casse rien à la compilation : elle casse l'écran, en
// production, sans message autre qu'une ligne de console. Ce script sert donc
// le build réel avec l'en-tête réel, promène un navigateur sur les écrans, et
// échoue à la moindre violation.
//
//   npm run build && node scripts/verifier-csp.mjs
import './env-local.mjs';
import './proxy-node.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const RACINE = path.resolve('dist/vehora/browser');
const CONFIG = JSON.parse(await readFile('vercel.json', 'utf8'));

/** L'en-tête tel que `vercel.json` le déclare — pas une copie approximative. */
const entetes = CONFIG.headers.find((h) => h.source === '/(.*)').headers;
const csp = entetes.find((e) => e.key === 'Content-Security-Policy')?.value;
if (!csp) {
  console.log('❌ Aucune Content-Security-Policy dans vercel.json.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// Le serveur reproduit la réécriture SPA de `vercel.json` : tout ce qui n'est
// pas un fichier rend `index.html`.
const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const candidat = path.join(RACINE, chemin);
  const fichier =
    chemin !== '/' && path.extname(chemin) && existsSync(candidat)
      ? candidat
      : path.join(RACINE, 'index.html');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Content-Type', TYPES[path.extname(fichier)] ?? 'application/octet-stream');
  res.end(await readFile(fichier));
});

await new Promise((ok) => serveur.listen(4290, ok));

const proxy = process.env.HTTPS_PROXY;
const navigateur = await chromium.launch({
  executablePath: process.env.VEHORA_CHROMIUM || undefined,
  ...(proxy
    ? { args: [`--proxy-server=${proxy}`, '--proxy-bypass-list=localhost;127.0.0.1;[::1]'] }
    : {}),
});
const contexte = await navigateur.newContext({ ignoreHTTPSErrors: Boolean(proxy) });
const page = await contexte.newPage();

const violations = [];
page.on('console', (m) => {
  const t = m.text();
  if (/Content Security Policy|Refused to/i.test(t)) violations.push(t);
});

let ko = 0;
for (const chemin of ['/', '/connexion', '/tableau-de-bord']) {
  await page.goto(`http://localhost:4290${chemin}`, { waitUntil: 'networkidle' });
  const demarre = await page.locator('vh-root *').count();
  if (demarre === 0) {
    ko++;
    console.log(`  ÉCHEC — ${chemin} : l'application ne démarre pas sous cette CSP`);
  } else {
    console.log(`  ok — ${chemin} rendu sous CSP`);
  }
}

await navigateur.close();
serveur.close();

for (const v of violations) {
  ko++;
  console.log(`  ÉCHEC — violation CSP : ${v}`);
}

console.log(ko === 0 ? '\n✅ L’application tourne sous sa CSP.' : `\n❌ ${ko} problème(s).`);
process.exit(ko === 0 ? 0 : 1);
