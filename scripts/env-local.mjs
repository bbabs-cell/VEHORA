// Charge `.env.local` pour les scripts Node du projet.
//
// `playwright.config.ts` garde sa propre copie de cette logique, et c'est
// volontaire : Playwright charge sa configuration avant tout module à nous, et
// un import depuis `scripts/` y arriverait trop tard. Les deux lisent le même
// fichier de la même façon — BOM compris (PowerShell 5 en écrit un).
import { readFileSync } from 'node:fs';

let contenu;
try {
  contenu = readFileSync('.env.local', 'utf8');
} catch {
  contenu = ''; // Pas de fichier : les variables viennent de l'environnement.
}

for (const ligne of contenu.replace(/^﻿/, '').split(/\r?\n/)) {
  const texte = ligne.trim();
  if (texte === '' || texte.startsWith('#')) continue;
  const separateur = texte.indexOf('=');
  if (separateur <= 0) continue;

  const cle = texte.slice(0, separateur).trim();
  let valeur = texte.slice(separateur + 1).trim();
  if (
    (valeur.startsWith('"') && valeur.endsWith('"')) ||
    (valeur.startsWith("'") && valeur.endsWith("'"))
  ) {
    valeur = valeur.slice(1, -1);
  }
  if (process.env[cle] === undefined) process.env[cle] = valeur;
}
