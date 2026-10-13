// Jetons de design — règle n°2 de la méthode MagyaPro : « aucune couleur
// écrite en dur dans un composant ».
//
// Deux contrôles, sans navigateur :
// 1. tout `var(--vh-…)` employé quelque part est déclaré dans `src/styles/`.
//    Un jeton absent ne lève aucune erreur : la propriété retombe en silence
//    sur sa valeur initiale. `--vh-space-5` a ainsi valu 0 pendant des phases
//    sur trois écrans.
// 2. aucune couleur littérale (#hex, rgb(), hsl()) dans un composant. Les
//    seules exceptions sont les feuilles de `src/styles/`, qui DÉCLARENT les
//    jetons, et le masque CSS (`linear-gradient(#000 0 0)`), qui n'est pas une
//    couleur affichée mais une forme.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const fichiers = [];
const parcourir = (dossier) => {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(css|html|ts)$/.test(nom) && !nom.endsWith('database.types.ts')) fichiers.push(chemin);
  }
};
parcourir(join(racine, 'src'));

// Un jeton de FOND employé comme couleur de texte : `--vh-error` et
// `--vh-primary` portent du blanc en bouton, mais écrits en texte sur le fond
// sombre ils tombent sous 4,5:1. Leur version « texte » existe pour ça
// (`--vh-error-text`, `--vh-primary-bright`). Neuf feuilles s'étaient trompées.
const FONDS_EN_TEXTE = /(?<![\w-])color:\s*var\(--vh-(error|primary)\)/;
const fondsEnTexte = [];

const declares = new Set();
const employes = new Map();
const couleurs = [];

for (const fichier of fichiers) {
  const texte = readFileSync(fichier, 'utf8');
  for (const [, nom] of texte.matchAll(/^\s*(--vh-[\w-]+)\s*:/gm)) declares.add(nom);
  // `var(--vh-x, repli)` est un réglage par élément (le rail d'état prend sa
  // couleur d'un attribut style) : son repli dit quoi faire s'il manque.
  for (const [, nom] of texte.matchAll(/var\((--vh-[\w-]+)\s*\)/g)) {
    if (!employes.has(nom)) employes.set(nom, relative(racine, fichier));
  }
  texte.split('\n').forEach((ligne, i) => {
    if (FONDS_EN_TEXTE.test(ligne)) fondsEnTexte.push(`${relative(racine, fichier)}:${i + 1}  ${ligne.trim()}`);
  });
  if (fichier.includes('/src/styles/')) continue;
  texte.split('\n').forEach((ligne, i) => {
    // Ni le masque CSS, ni une teinte lue dans un jeton (`rgb(var(--vh-…))`),
    // ni la balise <meta theme-color>, qui ne lit pas les variables CSS.
    const sansMasque = ligne
      .replace(/linear-gradient\(#000 0 0\)/g, '')
      .replace(/rgba?\(var\(--vh-[\w-]+\)[^)]*\)/g, '')
      .replace(/<meta name="theme-color"[^>]*>/, '');
    if (/#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/.test(sansMasque) && !/^\s*(\/\/|\*|\/\*)/.test(ligne)) {
      couleurs.push(`${relative(racine, fichier)}:${i + 1}  ${ligne.trim()}`);
    }
  });
}

let echecs = 0;
for (const [nom, fichier] of employes) {
  if (!declares.has(nom)) {
    echecs++;
    console.log(`  ÉCHEC — ${nom} employé (${fichier}) mais déclaré nulle part`);
  }
}
for (const ligne of fondsEnTexte) {
  echecs++;
  console.log(`  ÉCHEC — jeton de fond employé en texte : ${ligne}`);
}
for (const ligne of couleurs) {
  echecs++;
  console.log(`  ÉCHEC — couleur en dur : ${ligne}`);
}

console.log(
  echecs === 0
    ? `\n✅ ${employes.size} jetons employés, tous déclarés ; aucune couleur en dur hors de src/styles/.`
    : `\n❌ ${echecs} écart(s) à la règle des jetons.`,
);
process.exit(echecs === 0 ? 0 : 1);
