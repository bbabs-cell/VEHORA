#!/usr/bin/env node
// Audit mobile — méthode MagyaPro, `scripts/audit-debordement.mjs`, adapté à
// VEHORA (SPA Angular + Supabase).
//
//   npm run build && npm run audit:mobile
//
// Il sert le build RÉEL avec la CSP RÉELLE de vercel.json, ouvre chaque écran
// à 375 px (Chromium, tactile) et signale :
//   1. le défilement horizontal de la page, et l'élément le plus haut qui
//      dépasse de l'écran ;
//   2. les boutons écrasés — un libellé qui se casse sur trois lignes ou un
//      bouton plus étroit que son plus long mot. Un audit de débordement seul
//      les déclarait conformes sur MagyaPro ;
//   3. plus d'UN bouton principal visible hors boîte de dialogue (règle n°1 :
//      deux boutons de marque s'annulent) ;
//   4. un texte affiché sous 13 px, le plancher du projet ;
//   5. une violation de CSP ou une erreur JavaScript.
// Puis il enregistre une capture pleine page de chaque écran — à REGARDER,
// pas seulement à générer.
//
// Données : par défaut, Supabase est SIMULÉ (`scripts/maquette/`) — aucun
// compte, aucun secret, aucune base. C'est ce qui permet de capturer tous les
// écrans, profil par profil, dans un environnement sans identifiants.
//
// Variables (toutes facultatives) :
//   AUDIT_LARGEURS  « 375 » par défaut ; ex. « 320,375,1280 »
//   AUDIT_THEMES    « sombre » par défaut ; « sombre,clair »
//   AUDIT_PROFILS   restreint aux profils nommés (« proprietaire,caissier »)
//   AUDIT_CHEMINS   restreint aux chemins qui contiennent l'un de ces mots
//   AUDIT_SHOTS     dossier des captures (défaut : <tmp>/vehora-audit) — jamais
//                   dans le dépôt : une capture ne se committe pas
//   VEHORA_CHROMIUM exécutable Chromium (environnement cloud)
//
// Code de sortie 1 s'il y a au moins un problème : utilisable en CI.
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { TABLES } from './maquette/donnees.mjs';
import { installerSupabaseSimule } from './maquette/supabase-simule.mjs';

const RACINE = path.resolve('dist/vehora/browser');
if (!existsSync(path.join(RACINE, 'index.html'))) {
  console.error('Aucun build : lancez d’abord `npm run build`.');
  process.exit(2);
}

const CONFIG = JSON.parse(await readFile('vercel.json', 'utf8'));
const csp = CONFIG.headers
  .find((h) => h.source === '/(.*)')
  .headers.find((e) => e.key === 'Content-Security-Policy').value;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const candidat = path.join(RACINE, chemin);
  const fichier =
    chemin !== '/' && path.extname(chemin) && existsSync(candidat) ? candidat : path.join(RACINE, 'index.html');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Content-Type', TYPES[path.extname(fichier)] ?? 'application/octet-stream');
  res.end(await readFile(fichier));
});
await new Promise((ok) => serveur.listen(4291, ok));
const BASE = 'http://localhost:4291';

const vehicule = TABLES.vehicles[0].id;
const recu = TABLES.receipts[0].id;
const PARCOURS = {
  anonyme: ['/connexion'],
  'sans-organisation': ['/sans-organisation', '/creer-organisation'],
  proprietaire: [
    '/tableau-de-bord', '/file-attente', '/operations', '/caisse', '/caisse/historique', '/clients',
    '/vehicules', `/vehicules/${vehicule}/inspection`, '/catalogue', '/stations', '/utilisateurs',
    '/employes', '/rapports', '/messages', '/abonnement', '/parametres', `/recus/${recu}`,
  ],
  caissier: ['/tableau-de-bord', '/file-attente', '/caisse'],
  plateforme: ['/plateforme/organisations', '/plateforme/facturation', '/plateforme/journal'],
};

const liste = (v, defaut) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : defaut);
const largeurs = liste(process.env.AUDIT_LARGEURS, ['375']).map(Number);
const themes = liste(process.env.AUDIT_THEMES, ['sombre']);
const profils = liste(process.env.AUDIT_PROFILS, Object.keys(PARCOURS));
const filtres = liste(process.env.AUDIT_CHEMINS, []);
const retenu = (chemin) => filtres.length === 0 || filtres.some((f) => chemin.includes(f));
const captures = process.env.AUDIT_SHOTS ?? path.join(tmpdir(), 'vehora-audit');
mkdirSync(captures, { recursive: true });

const navigateur = await chromium.launch({ executablePath: process.env.VEHORA_CHROMIUM || undefined });

let problemes = 0;
for (const largeur of largeurs) {
  for (const theme of themes) {
    for (const profil of profils) {
      const contexte = await navigateur.newContext({
        viewport: { width: largeur, height: 812 },
        deviceScaleFactor: 2,
        isMobile: largeur < 1024,
        hasTouch: largeur < 1024,
        // Les animations vont à leur état final : une capture prise au milieu
        // d'une entrée montrerait un écran à moitié transparent.
        reducedMotion: 'reduce',
        locale: 'fr-FR',
        timezoneId: 'Africa/Dakar',
      });
      await contexte.addInitScript((t) => {
        try {
          localStorage.setItem('vehora.theme', t);
        } catch {}
      }, theme);
      await installerSupabaseSimule(contexte, profil === 'anonyme' ? null : profil);

      for (const chemin of (PARCOURS[profil] ?? []).filter(retenu)) {
        const page = await contexte.newPage();
        const erreurs = [];
        page.on('console', (m) => {
          const t = m.text();
          if (/Content Security Policy|Refused to/i.test(t)) erreurs.push(`CSP : ${t.slice(0, 160)}`);
        });
        page.on('pageerror', (e) => erreurs.push(`erreur JS : ${e.message.split('\n')[0]}`));

        const etiquette = `${profil} · ${theme} · ${largeur}px · ${chemin}`;
        try {
          await page.goto(BASE + chemin, { waitUntil: 'networkidle', timeout: 30_000 });
          await page.waitForTimeout(400);
          const arrivee = new URL(page.url()).pathname;
          const redirige = arrivee !== chemin ? ` (redirigé vers ${arrivee})` : '';

          const constats = await page.evaluate((vw) => {
            const out = [];
            const decrire = (el) => {
              const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
              const c = typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
              return `<${el.tagName.toLowerCase()}${c ? '.' + c : ''}> « ${t} »`;
            };
            const visible = (el) => {
              const s = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && Number(s.opacity) > 0;
            };
            const dansDefileur = (el) => {
              for (let p = el.parentElement; p; p = p.parentElement) {
                const o = getComputedStyle(p).overflowX;
                if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
              }
              return false;
            };

            const sw = document.documentElement.scrollWidth;
            if (sw > vw + 1) out.push(`défilement horizontal : ${sw}px pour ${vw}px`);

            for (const el of document.body.querySelectorAll('*')) {
              if (!visible(el) || dansDefileur(el)) continue;
              const r = el.getBoundingClientRect();
              if (r.right > vw + 1 || r.left < -1) {
                let parentDeborde = false;
                for (let p = el.parentElement; p; p = p.parentElement) {
                  const pr = p.getBoundingClientRect();
                  if (pr.right > vw + 1 || pr.left < -1) { parentDeborde = true; break; }
                }
                if (!parentDeborde) out.push(`dépasse l'écran (${Math.round(r.left)}→${Math.round(r.right)}px) : ${decrire(el)}`);
              }
            }

            // Lignes RÉELLEMENT occupées par le libellé, mesurées sur ses nœuds
            // texte : la hauteur du bouton ne suffit pas (une entrée de barre
            // basse empile une icône et un mot, sans rien d'écrasé).
            const lignesDeTexte = (el) => {
              const hauts = new Set();
              const m = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              for (let n = m.nextNode(); n; n = m.nextNode()) {
                if (!n.textContent.trim()) continue;
                const r = document.createRange();
                r.selectNodeContents(n);
                for (const rect of r.getClientRects()) if (rect.width > 1) hauts.add(Math.round(rect.top));
              }
              return hauts.size;
            };
            for (const el of document.querySelectorAll('button, a.vh-button, [role="button"]')) {
              if (!visible(el)) continue;
              const r = el.getBoundingClientRect();
              const texte = (el.innerText || '').trim();
              const motLong = Math.max(0, ...texte.split(/\s+/).map((w) => w.length));
              if (texte && ((lignesDeTexte(el) > 2 && texte.length < 40) || (motLong > 3 && r.width < 28))) {
                out.push(`bouton écrasé (${Math.round(r.width)}×${Math.round(r.height)}px) : ${decrire(el)}`);
              }
            }

            // Texte coupé : un conteneur qui masque son débordement cache aussi
            // ce qui dépasse. « 976 500 FCFA » sortait de sa tuile sans qu'aucun
            // défilement ne le trahisse. Une troncature voulue porte
            // `text-overflow: ellipsis` ; le décor est `aria-hidden`.
            for (const el of document.body.querySelectorAll('*')) {
              if (!visible(el) || el.closest('[aria-hidden="true"], .vh-sr-only')) continue;
              const s = getComputedStyle(el);
              if (!['hidden', 'clip'].includes(s.overflowX) || s.textOverflow === 'ellipsis') continue;
              const boite = el.getBoundingClientRect();
              // On mesure le TEXTE, pas le contenu : un halo décoratif qui
              // dépasse d'une carte n'est pas une phrase coupée.
              const m = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              for (let n = m.nextNode(); n; n = m.nextNode()) {
                if (!n.textContent.trim() || n.parentElement?.closest('[aria-hidden="true"]')) continue;
                const r = document.createRange();
                r.selectNodeContents(n);
                const hors = [...r.getClientRects()].some(
                  (rect) => rect.width > 0 && (rect.right > boite.right + 1 || rect.left < boite.left - 1),
                );
                if (hors) {
                  out.push(`texte coupé : « ${n.textContent.trim().slice(0, 30)} » dans ${decrire(el)}`);
                  break;
                }
              }
            }

            // Règle n°1 : un seul bouton à fond de marque hors boîte de dialogue.
            const principaux = [...document.querySelectorAll('.vh-button')].filter(
              (el) =>
                visible(el) &&
                !el.closest('[role="dialog"]') &&
                !/vh-button--(ghost|trait|discret|danger)/.test(el.className),
            );
            if (principaux.length > 1) {
              out.push(`${principaux.length} boutons principaux visibles : ${principaux.slice(0, 4).map(decrire).join(', ')}`);
            }

            // Plancher typographique : 13 px.
            const vus = new Set();
            const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
              const el = n.parentElement;
              if (!el || vus.has(el) || !n.textContent.trim() || !visible(el)) continue;
              vus.add(el);
              const taille = parseFloat(getComputedStyle(el).fontSize);
              if (taille < 12.9 && !el.closest('.vh-sr-only')) out.push(`texte à ${taille}px : ${decrire(el)}`);
            }
            return out;
          }, largeur);

          const nom = `${profil}-${theme}-${largeur}-${chemin.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'racine'}.png`;
          await page.screenshot({ path: path.join(captures, nom), fullPage: true });

          const tout = [...constats, ...erreurs];
          if (tout.length === 0) {
            console.log(`✓ ${etiquette}${redirige}`);
          } else {
            problemes += tout.length;
            console.log(`✗ ${etiquette}${redirige}`);
            for (const c of tout) console.log(`    – ${c}`);
          }
        } catch (erreur) {
          problemes++;
          console.log(`✗ ${etiquette} — ${erreur.message.split('\n')[0]}`);
        } finally {
          await page.close();
        }
      }
      await contexte.close();
    }
  }
}

await navigateur.close();
serveur.close();
console.log(`\nCaptures : ${captures}`);
console.log(problemes === 0 ? '✅ Aucun problème.' : `❌ ${problemes} problème(s).`);
process.exit(problemes === 0 ? 0 : 1);
