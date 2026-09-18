// Assertions sur la fabrique de CSV.
//
// Ce module ne touche ni au réseau ni au DOM tant qu'on ne télécharge pas : il
// se vérifie donc directement sous Node, qui exécute le TypeScript tel quel
// depuis la version 23.6. Pas de navigateur, pas de base, pas de compte —
// quelques millisecondes, et la règle qui compte est gardée.
import { versCsv, nombreCsv, nomFichierCsv } from '../src/app/shared/export/csv.ts';

let ko = 0;
const verifier = (label, reel, attendu) => {
  if (reel === attendu) { console.log('  ok —', label); return; }
  ko++;
  console.log(`  ÉCHEC — ${label}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(reel)}`);
};

// --- Le piège qui justifie ce fichier --------------------------------------
// Un tableur exécute une cellule qui commence par =, +, -, @, une tabulation ou
// un retour chariot. Le nom d'une prestation est saisi par un utilisateur de
// l'organisation : il arrive ici tel quel, et partirait chez le comptable.
for (const dangereux of ['=1+1', '+33600000000', '-2', '@SUM(A1)', '\tX', '\rY']) {
  const ligne = versCsv(['A'], [[dangereux]]).split('\r\n')[1];
  verifier(`« ${JSON.stringify(dangereux)} » est désamorcé`, ligne, `"'${dangereux}"`);
}

verifier(
  'une formule déguisée en lien reste du texte',
  versCsv(['A'], [['=HYPERLINK("http://x","Facture")']]).split('\r\n')[1],
  `"'=HYPERLINK(""http://x"",""Facture"")"`,
);

// --- Échappement CSV --------------------------------------------------------
verifier('un guillemet est doublé', versCsv(['A'], [['dit "oui"']]).split('\r\n')[1],
  '"dit ""oui"""');
verifier('un point-virgule ne coupe pas la cellule',
  versCsv(['A'], [['Liberté 6; Dakar']]).split('\r\n')[1], '"Liberté 6; Dakar"');
verifier('un saut de ligne reste dans la cellule',
  versCsv(['A'], [['deux\nlignes']]).split('\r\n')[1], '"deux\nlignes"');
verifier('vide et absent donnent une cellule vide',
  versCsv(['A', 'B'], [[null, undefined]]).split('\r\n')[1], '"";""');

// --- Forme du fichier -------------------------------------------------------
verifier('séparateur point-virgule, attendu par Excel en français',
  versCsv(['A', 'B'], []), '"A";"B"');
verifier('fin de ligne CRLF', versCsv(['A'], [['x']]), '"A"\r\n"x"');
verifier('décimale à la virgule', nombreCsv(12.5), '12,5');
verifier('un entier reste un entier', nombreCsv(9500), '9500');

verifier('le nom de fichier est sans accent ni espace',
  nomFichierCsv('Rapport journalier — été', '2026-09-01', '2026-09-18'),
  'vehora-rapport-journalier-ete-2026-09-01-2026-09-18.csv');

console.log(ko === 0 ? '\n✅ Fabrique de CSV : conforme.' : `\n❌ ${ko} écart(s).`);
process.exit(ko === 0 ? 0 : 1);
