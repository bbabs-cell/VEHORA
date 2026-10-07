# Phase 23 — Paramètres de l'organisation

Le dernier écran annoncé et non construit. L'entrée « Paramètres » portait
« Bientôt » dans la navigation depuis la phase 4 ; elle ouvre désormais la fiche
de l'organisation et ses règles de travail.

## Ce qui a été trouvé avant d'écrire l'écran

La policy `owners update own organization`, écrite en phase 1, autorise un
propriétaire à mettre à jour **toute colonne** de sa ligne. Une policy vérifie la
ligne, jamais la colonne : la règle était déjà écrite dans ce projet (phase 10,
« assigner n'est pas exécuter »), elle n'avait simplement jamais été appliquée
ici.

Vérifié sur la base réelle, par l'API, avec un compte propriétaire ordinaire :
`currency` est passée de `XOF` à `EUR`. Rien n'aurait été converti —
`amount_minor` est un entier, la devise est son étiquette. Un dossier de
60 000 F CFA serait devenu 60 000 €, **y compris dans les reçus déjà remis au
client**, dont le contenu est figé mais dont la devise se lit à l'affichage. La
valeur a été rétablie dans la minute.

Même ouverture sur `slug` (l'identité) et `status` (la suspension est une
décision de la plateforme, auditée : se réactiver soi-même annulait la sanction).

**Un écran de paramètres n'a pas été écrit tant que ce trou n'était pas fermé** :
un formulaire qui n'affiche pas un champ n'empêche personne de l'envoyer.

## Correction

`supabase/migrations/20260925100000_parametres_organisation.sql`

- `vehora.protect_organization()`, trigger `before update`, refuse `id`, `slug`,
  `status` et `currency` en `insufficient_privilege` (42501), avec un code
  `VEHORA_ORG_*` que le frontend traduit.
- **La fonction est en SECURITY INVOKER, et c'est le point décisif.** Écrite en
  `SECURITY DEFINER` au premier jet, `current_user` y valait le propriétaire de
  la fonction (`postgres`) et non l'appelant : le garde-fou laissait tout passer.
  L'assertion sur la devise l'a montré.
- Le filtre est `current_user <> 'authenticated'` → on laisse passer : la
  plateforme suspend et réactive comme avant, les migrations aussi.
- Rattrapage : une ligne `organization_settings` pour les organisations qui n'en
  avaient pas. Aucun trigger de création n'a été ajouté —
  `provisionner_organisation()` en pose déjà une, et un second l'aurait fait
  échouer sur clé dupliquée (essayé, retiré).

## Écran

`src/app/features/parametres/` — deux formulaires indépendants.

- **Votre entreprise** : nom, ville, pays, adresse, téléphone, courriel.
- **Règles de travail** : inspection obligatoire, contrôle qualité obligatoire,
  paiement avant restitution, remise maximale.
- **Devise et état du compte sont des lignes de lecture, pas des champs
  désactivés**, avec leur raison écrite dessous. Une action que le serveur
  refusera ne s'affiche pas comme possible.
- Les défauts sont posés par `effect` dès que la donnée asynchrone arrive
  (règle du projet contre l'échec silencieux de formulaire).
- Route gardée par `permissionGuard('organization.manage')` ; l'entrée de
  navigation passe à `disponible: true`.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` + `tsc -p tsconfig.spec.json` | vert |
| `npm run build` (budgets) | vert |
| `npm run validate:sql` | vert — **295 assertions** (287 + 8) |
| `npm run e2e -- e2e/parametres.spec.ts` | vert — 10 (5 tests × 2 projets) |
| Capture d'écran mobile | `captures/parametres-haut.png`, `-bas.png` |

Les 8 assertions SQL ajoutées à `supabase/tests/01_tenant_isolation.sql` :
le propriétaire règle nom, ville, téléphone et la règle de paiement ; devise,
slug et statut sont refusés ; la plateforme suspend et réactive toujours ; le
caissier ne change rien ; l'organisation B ne touche pas l'organisation A.

Une de ces assertions a d'abord prouvé le contraire de ce qu'elle visait : elle
écrivait `status = 'ACTIVE'` sur une organisation déjà `ACTIVE`, et le trigger ne
compare que ce qui change. Elle calcule maintenant un statut différent.

## Reste dû

Deux contrôles n'ont pas pu être exécutés : le proxy sortant du conteneur refuse
désormais `entpmxssjxllggsqhnwc.supabase.co` (`CONNECT` → 502) et le MCP Supabase
répond « You do not have permission ».

- `npm run e2e` **complet** (la suite connectée a besoin de Supabase ; seul
  `e2e/parametres.spec.ts` a tourné, avant la coupure) ;
- `scripts/intrusion-parametres.mjs` — **écrit, jamais exécuté**. 14 assertions
  par l'API réelle : devise, slug et statut refusés y compris glissés au milieu
  de champs légitimes, caissier sans écriture, organisation voisine sans lecture
  ni écriture, anonyme sans rien.

Le garde-fou lui-même **a** été vérifié sur la base réelle, par curl, au moment
de son application (42501 sur devise, slug et statut ; `city` toujours accepté) —
c'est la campagne qui rejoue l'ensemble d'un bloc qui reste à passer.
