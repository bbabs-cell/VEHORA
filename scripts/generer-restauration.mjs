// Fabrique `supabase/restauration.sql` : les migrations du dépôt, concaténées
// dans l'ordre, prêtes à coller dans le SQL Editor d'un projet Supabase neuf.
//
// Pourquoi un script plutôt qu'un copier-coller : une recopie manuelle de
// 300 Ko de SQL introduit tôt ou tard un écart silencieux entre la base et le
// dépôt, et c'est précisément la classe de défaut que ce projet traque.
// Ici le contenu n'est jamais réécrit, seulement assemblé.
//
//   node scripts/generer-restauration.mjs [--depuis <nom_de_migration>]
//
// `--depuis` saute les migrations déjà appliquées sur le projet visé (celles
// que `list_migrations` renvoie), et reprend à partir de celle nommée.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = 'supabase/migrations';
const SORTIE = 'supabase/restauration.sql';

const argv = process.argv.slice(2);
const depuis = argv.includes('--depuis') ? argv[argv.indexOf('--depuis') + 1] : null;

const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // les noms portent leur horodatage : l'ordre lexical est l'ordre réel

const debut = depuis ? fichiers.findIndex((f) => f.startsWith(depuis)) : 0;
if (debut < 0) throw new Error(`migration « ${depuis} » introuvable dans ${DOSSIER}`);

const restantes = fichiers.slice(debut);
const versions = fichiers.map((f) => f.replace(/_.*$/, ''));

const morceaux = [
  `-- VEHORA — restauration du schéma sur un projet Supabase neuf.
--
-- Fichier PRODUIT par \`scripts/generer-restauration.mjs\` : concaténation
-- exacte des migrations du dépôt, dans l'ordre de leurs horodatages. Rien n'y
-- a été réécrit à la main.
--
-- À coller EN UNE FOIS dans le SQL Editor du dashboard Supabase.
${depuis ? `-- Reprend à « ${depuis} » : ce qui précède est déjà appliqué sur le projet visé.\n` : ''}--
-- Le bloc final réinscrit l'historique complet dans
-- \`supabase_migrations.schema_migrations\` avec les VRAIES versions du dépôt.
-- Sans lui, un \`supabase db push\` ultérieur rejouerait tout le schéma.
--
-- Une seule transaction : si une instruction échoue, rien n'est appliqué et la
-- base reste telle quelle. On corrige, on recolle.

begin;
`,
];

for (const nom of restantes) {
  morceaux.push(
    `\n\n-- ===========================================================================\n` +
      `-- ${nom}\n` +
      `-- ===========================================================================\n`,
    readFileSync(join(DOSSIER, nom), 'utf8'),
  );
}

morceaux.push(
  `\n\n-- ===========================================================================\n` +
    `-- Historique des migrations\n` +
    `-- ===========================================================================\n`,
  `delete from supabase_migrations.schema_migrations;\n`,
  `insert into supabase_migrations.schema_migrations (version) values\n`,
  versions.map((v) => `  ('${v}')`).join(',\n') + ';\n',
  `\ncommit;\n`,
);

const texte = morceaux.join('');
writeFileSync(SORTIE, texte);
console.log(
  `${SORTIE} — ${restantes.length} migration(s), ` +
    `${Math.round(Buffer.byteLength(texte) / 1024)} Ko, ` +
    `${versions.length} versions d'historique.`,
);
