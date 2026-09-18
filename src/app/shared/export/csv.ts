/**
 * Export CSV — un rapport qu'on ne peut pas sortir de l'écran ne va pas chez le
 * comptable.
 *
 * Trois choses ne vont pas de soi, et chacune a déjà cassé un export ailleurs.
 *
 * 1. **L'injection de formule.** Un tableur traite une cellule commençant par
 *    `=`, `+`, `-`, `@`, une tabulation ou un retour chariot comme une formule.
 *    Une prestation nommée `=HYPERLINK("http://…","Facture")` — un nom que
 *    n'importe quel utilisateur de l'organisation peut saisir — s'exécuterait
 *    chez le comptable qui ouvre le fichier. Ce n'est pas une faille de la base
 *    (la donnée est légitime), c'est une faille du fichier qu'on produit. On
 *    préfixe donc ces cellules d'une apostrophe.
 *
 * 2. **Le séparateur.** Excel en locale française attend `;`. Avec `,` il met
 *    toute la ligne dans une seule colonne, et l'utilisateur conclut que
 *    l'export est cassé.
 *
 * 3. **L'encodage.** Sans BOM, Excel lit l'UTF-8 comme du Latin-1 :
 *    « Libert� 6 ». Le BOM est ici volontaire — c'est le seul endroit du projet
 *    où on en écrit un.
 */

const SEPARATEUR = ';';

/** Caractères qui font d'une cellule une formule pour un tableur. */
const DEBUT_DE_FORMULE = /^[=+\-@\t\r]/;

/** Une cellule : échappée pour le CSV, et désamorcée pour le tableur. */
function cellule(valeur: string | number | null | undefined): string {
  const texte = valeur === null || valeur === undefined ? '' : String(valeur);
  const sur = DEBUT_DE_FORMULE.test(texte) ? `'${texte}` : texte;
  // Guillemets systématiques : une valeur peut contenir le séparateur, un
  // guillemet ou un saut de ligne, et on ne veut pas avoir à y penser.
  return `"${sur.replace(/"/g, '""')}"`;
}

/**
 * Un nombre pour un tableur francophone : virgule décimale, pas de séparateur
 * de milliers. `1 234,50` deviendrait trois colonnes.
 */
export function nombreCsv(valeur: number): string {
  return String(valeur).replace('.', ',');
}

/** Lignes → contenu CSV, en-tête compris. */
export function versCsv(
  entetes: readonly string[],
  lignes: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const toutes = [entetes, ...lignes];
  // CRLF : c'est ce qu'attend Excel, et ce que tolèrent les autres.
  return toutes.map((l) => l.map(cellule).join(SEPARATEUR)).join('\r\n');
}

/**
 * Propose le fichier au téléchargement. Le BOM est ajouté ici, une seule fois.
 *
 * L'URL objet est révoquée : sans cela, le contenu du fichier reste en mémoire
 * pour toute la durée de la session — sur un téléphone d'entrée de gamme, un
 * export de deux cents lignes répété fait la différence.
 */
export function telechargerCsv(nomFichier: string, contenu: string): void {
  const fichier = new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Nom de fichier lisible et sans surprise : pas d'espace, pas d'accent, pas de
 * caractère qu'un système de fichiers refuse.
 */
export function nomFichierCsv(base: string, debut: string, fin: string): string {
  const propre = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `vehora-${propre}-${debut}-${fin}.csv`;
}
