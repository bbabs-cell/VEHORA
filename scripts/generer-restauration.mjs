// Fabrique le SQL de restauration d'un projet Supabase neuf : les migrations
// du dépôt, concaténées dans l'ordre, prêtes à coller dans le SQL Editor.
//
// Pourquoi un script plutôt qu'un copier-coller : une recopie manuelle de
// 300 Ko de SQL introduit tôt ou tard un écart silencieux entre la base et le
// dépôt, et c'est précisément la classe de défaut que ce projet traque. Ici le
// contenu n'est jamais réécrit, seulement assemblé.
//
//   node scripts/generer-restauration.mjs [--depuis <horodatage>] [--morceaux]
//
// `--depuis` reprend à cette migration : ce qui précède est déjà appliqué sur
// le projet visé (ce que renvoie `list_migrations`).
//
// `--morceaux` découpe en fichiers d'environ 60 Ko dans `supabase/restauration/`
// au lieu d'un seul gros fichier. **C'est le mode à préférer** : un collage de
// 272 Ko dans l'éditeur web a été tronqué sans le dire, et l'éditeur a répondu
// « Success. No rows returned » — ce que répond aussi un `begin;` tout seul.
// La base était restée intacte, mais rien ne le signalait.
//
// Aucune migration n'est jamais coupée en deux : les coupes tombent entre deux
// fichiers, et chaque morceau est sa propre transaction.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = 'supabase/migrations';
const FICHIER_UNIQUE = 'supabase/restauration.sql';
const DOSSIER_MORCEAUX = 'supabase/restauration';
const LIMITE = Number(process.env.VEHORA_LIMITE_KO ?? 60) * 1024;

const argv = process.argv.slice(2);
const depuis = argv.includes('--depuis') ? argv[argv.indexOf('--depuis') + 1] : null;
const enMorceaux = argv.includes('--morceaux');

const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // les noms portent leur horodatage : l'ordre lexical est l'ordre réel

const debut = depuis ? fichiers.findIndex((f) => f.startsWith(depuis)) : 0;
if (debut < 0) throw new Error(`migration « ${depuis} » introuvable dans ${DOSSIER}`);

const restantes = fichiers.slice(debut);

/** L'historique complet : toutes les versions du dépôt, pas seulement celles
 *  de ce lot. Sans lui, un `supabase db push` ultérieur rejouerait le schéma. */
const historique = [
  '\n\n-- ---------------------------------------------------------------------------\n' +
    "-- Historique des migrations — les VRAIES versions du dépôt.\n" +
    '-- ---------------------------------------------------------------------------\n',
  'delete from supabase_migrations.schema_migrations;\n',
  'insert into supabase_migrations.schema_migrations (version) values\n',
  fichiers.map((f) => `  ('${f.replace(/_.*$/, '')}')`).join(',\n') + ';\n',
].join('');

const corps = (nom) =>
  '\n\n-- ---------------------------------------------------------------------------\n' +
  `-- ${nom}\n` +
  '-- ---------------------------------------------------------------------------\n' +
  readFileSync(join(DOSSIER, nom), 'utf8');

const ko = (texte) => Math.round(Buffer.byteLength(texte) / 1024);

if (!enMorceaux) {
  const texte =
    `-- VEHORA — restauration du schéma sur un projet Supabase neuf.
--
-- Fichier PRODUIT par \`scripts/generer-restauration.mjs\`. Rien n'y a été
-- réécrit à la main. À coller EN UNE FOIS dans le SQL Editor.
${depuis ? `-- Reprend à « ${depuis} » : ce qui précède est déjà appliqué.\n` : ''}--
-- Une seule transaction : si une instruction échoue, rien n'est appliqué.
--
-- ⚠️ Au-delà d'une centaine de kilo-octets, préférer \`--morceaux\` : un collage
-- trop gros est tronqué silencieusement par l'éditeur web.

begin;
` +
    restantes.map(corps).join('') +
    historique +
    '\ncommit;\n';

  writeFileSync(FICHIER_UNIQUE, texte);
  console.log(`${FICHIER_UNIQUE} — ${restantes.length} migration(s), ${ko(texte)} Ko.`);
} else {
  // Répartition : on ferme un lot dès qu'ajouter le fichier suivant le ferait
  // dépasser la limite. Un fichier plus gros que la limite part seul.
  const lots = [[]];
  let taille = 0;
  for (const f of restantes) {
    const n = statSync(join(DOSSIER, f)).size;
    if (taille && taille + n > LIMITE) {
      lots.push([]);
      taille = 0;
    }
    lots[lots.length - 1].push(f);
    taille += n;
  }

  rmSync(DOSSIER_MORCEAUX, { recursive: true, force: true });
  mkdirSync(DOSSIER_MORCEAUX, { recursive: true });

  lots.forEach((lot, i) => {
    const rang = i + 1;
    const dernier = rang === lots.length;
    const texte =
      `-- VEHORA — restauration, morceau ${rang} sur ${lots.length}.
--
-- À coller dans le SQL Editor et exécuter, PUIS passer au suivant. L'ordre
-- compte. Ce morceau est une transaction à lui seul : s'il échoue, il
-- n'applique rien, et les morceaux déjà passés restent acquis.
--
-- Vérifier qu'il est VRAIMENT passé, plutôt que de se fier au message de
-- l'éditeur : le nombre de tables de \`public\` doit avoir augmenté.
--
-- Migrations contenues :
` +
      lot.map((f) => `--   ${f}\n`).join('') +
      '\nbegin;\n' +
      lot.map(corps).join('') +
      (dernier ? historique : '') +
      '\ncommit;\n';

    const chemin = join(DOSSIER_MORCEAUX, `${String(rang).padStart(2, '0')}.sql`);
    writeFileSync(chemin, texte);
    console.log(`${chemin}  ${String(lot.length).padStart(2)} migration(s)  ${ko(texte)} Ko`);
  });
}
