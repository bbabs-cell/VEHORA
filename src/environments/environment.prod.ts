/**
 * Configuration de production. Ce fichier remplace `environment.ts` au build
 * (`fileReplacements`, configuration `production` dans `angular.json`).
 *
 * ⚠️ Il pointe aujourd'hui sur le MÊME projet Supabase que le développement.
 * C'est un point de départ, pas une cible : avant la première mise en
 * production réelle, créer un projet Supabase distinct, y rejouer les
 * migrations, et remplacer les deux valeurs ci-dessous. Tant que ce n'est pas
 * fait, une erreur de manipulation en développement touche les vraies données.
 *
 * L'URL et la clé « publishable » sont conçues pour être publiques : elles
 * n'accordent aucun droit par elles-mêmes. Toute la sécurité repose sur la RLS
 * et sur les claims du JWT (fondation 3).
 *
 * La clé `service_role` NE DOIT JAMAIS apparaître ici, ni nulle part dans le
 * frontend.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://entpmxssjxllggsqhnwc.supabase.co',
  supabasePublishableKey: 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2',
} as const;
