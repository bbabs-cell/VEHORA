// Contraste des tokens — WCAG 2.1 AA (4,5:1 pour du texte).
//
// Les valeurs sont LUES dans `src/styles/_tokens.css`, jamais recopiées ici :
// une copie serait une seconde vérité en sommeil, et c'est exactement le
// défaut que ce projet a déjà payé deux fois (le repli Tailwind de MagyaPro,
// la police « Inter » jamais servie).
//
// Chaque paire testée est une paire qui existe VRAIMENT à l'écran : du texte
// atténué sur les trois surfaces, du blanc sur le bouton d'action, la marque
// en trait sur le fond. Tester des combinaisons qui ne s'affichent nulle part
// donnerait un chiffre rassurant et faux.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/_tokens.css', import.meta.url), 'utf8');

/** Les tokens d'un bloc : `:root` pour le sombre, `[data-theme='light']`. */
function tokens(selecteur) {
  const debut = css.indexOf(selecteur);
  if (debut < 0) throw new Error(`bloc « ${selecteur} » introuvable dans _tokens.css`);
  const corps = css.slice(css.indexOf('{', debut) + 1, css.indexOf('\n}', debut));
  const table = {};
  for (const [, cle, valeur] of corps.matchAll(/(--vh-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    table[cle] = valeur;
  }
  return table;
}

const luminance = (hex) => {
  const canaux = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
};

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2);
};

/** [texte, fond] — des paires réellement affichées. */
const paires = [
  ['--vh-text', '--vh-bg'],
  ['--vh-text', '--vh-surface-1'],
  ['--vh-text', '--vh-surface-2'],
  ['--vh-text', '--vh-surface-3'],
  ['--vh-text-muted', '--vh-bg'],
  ['--vh-text-muted', '--vh-surface-1'],
  ['--vh-text-muted', '--vh-surface-2'],
  ['--vh-text-muted', '--vh-surface-3'],
  ['--vh-primary-ink', '--vh-primary'],
  ['--vh-primary-bright', '--vh-bg'],
  ['--vh-primary-bright', '--vh-surface-1'],
  ['--vh-money', '--vh-bg'],
  ['--vh-money', '--vh-surface-1'],
  ['--vh-success', '--vh-bg'],
  ['--vh-success', '--vh-surface-1'],
  ['--vh-warning', '--vh-bg'],
  ['--vh-warning', '--vh-surface-1'],
  ['--vh-error-text', '--vh-bg'],
  ['--vh-error-text', '--vh-surface-1'],
  ['--vh-primary-ink', '--vh-error'],
];

const SEUIL = 4.5;
let echecs = 0;
let total = 0;

for (const [nom, selecteur] of [
  ['sombre', ':root'],
  ['clair', "[data-theme='light']"],
]) {
  const sombre = tokens(':root');
  const table = nom === 'clair' ? { ...sombre, ...tokens(selecteur) } : sombre;
  console.log(`\nThème ${nom}`);

  for (const [texte, fond] of paires) {
    const a = table[texte];
    const b = table[fond];
    if (!a || !b) {
      echecs++;
      console.log(`  ÉCHEC  token absent : ${!a ? texte : fond}`);
      continue;
    }
    total++;
    const v = ratio(a, b);
    const ok = v >= SEUIL;
    if (!ok) echecs++;
    console.log(`  ${ok ? 'ok    ' : 'ÉCHEC '} ${`${texte} sur ${fond}`.padEnd(44)} ${v}`);
  }
}

console.log(
  echecs === 0
    ? `\n✅ ${total} paires au-dessus de ${SEUIL}:1 dans les deux thèmes.`
    : `\n❌ ${echecs} paire(s) sous le seuil.`,
);
process.exit(echecs === 0 ? 0 : 1);
