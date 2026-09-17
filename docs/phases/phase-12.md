# Phase 12 — Espace Super Admin

La partie la plus sensible du produit, et la plus facile à rater : donner à
VEHORA les moyens de piloter sa plateforme **sans** lui donner accès aux données
de ses clients.

## La règle, et ce qu'elle interdit

Fondation 3 : **le Super Admin n'a aucune policy de lecture sur les tables
métier des clients**. Pas de `or vehora.is_platform_admin()` sur
`service_orders`, `payments`, `customers`. Ce serait un contournement unique,
global et silencieux de tout le cloisonnement multi-tenant — et invisible dans
les journaux, puisqu'il emprunterait le chemin normal.

Douze assertions SQL et une campagne d'intrusion vérifient cette propriété,
table par table. Si une telle policy apparaît un jour, elles tombent.

## Comment la plateforme voit sans accéder

Deux vues, `platform_organizations` et `platform_audit_logs`. Elles ne sont pas
en `security_invoker` : le Super Admin n'ayant aucune policy sur les tables
clientes, une vue en droits d'appelant ne renverrait rien — c'est précisément la
propriété qu'on veut garder. Elles portent donc leur garde-fou **dans leur
corps** (`where vehora.is_platform_admin()`) et ne rendent que des **agrégats**.

Ce qu'elles n'exposent pas, volontairement : le **chiffre d'affaires** des
organisations. La plateforme a besoin de savoir si un client est vivant, pas
combien il gagne. Le CA appartient au client ; les revenus de VEHORA sont ses
abonnements, et vivront dans leurs propres tables. Un test de parcours vérifie
qu'aucun montant n'apparaît sur l'écran.

Le journal de plateforme ne montre que les actions `platform.*`. Un Super Admin
n'a pas à lire le motif d'une remise accordée chez un client : ce journal-là
reste au client.

## Ce qu'une suspension fait réellement

Écrire `status = 'SUSPENDED'` ne coupe rien : aucune policy ne lit ce statut, et
aucune ne doit le lire — ce serait une sous-requête par ligne, exactement ce que
la fondation 3 interdit. La suspension agit donc sur deux temps :

- **immédiatement**, elle écrit une ligne de `session_revocations` par membre ;
  `vehora.can_write()` la consulte déjà, donc toute écriture est refusée dans la
  seconde. Une assertion le vérifie en tentant une écriture après suspension ;
- **au renouvellement du token** (15 minutes au plus), le *custom access token
  hook* refuse d'émettre des claims pour une organisation suspendue : la lecture
  s'arrête aussi.

La réactivation ne lève que les révocations posées par la suspension : celles
décidées pour une autre raison — un compte compromis — survivent. C'est testé.

Suspendre et réactiver exigent un motif, qui rejoint le journal. Aucune donnée
n'est supprimée ni altérée.

## Deux amendements à la fondation 3

Le document prévoyait des Edge Functions `service_role` pour les actions
sensibles. Ce sont des fonctions `SECURITY DEFINER` : mêmes garanties (droit
vérifié explicitement, audit obligatoire, verrou de ligne), **testables par la
suite SQL existante** — une Edge Function ne l'est pas —, aucune surface de
déploiement ajoutée, et la clé `service_role` reste inutilisée. La première
action qui demandera un appel réseau sortant deviendra une Edge Function ; aucune
du périmètre MVP n'en demande.

Le document ne disait pas non plus comment les vues seraient évaluées. Les deux
points sont maintenant écrits dans `docs/architecture/03-rls-super-admin.md`,
avec leur justification — la règle du projet étant de modifier le document
d'abord.

## Signalement d'audit de niveau ERROR, et son traitement

L'advisor Supabase signale les deux vues comme `security_definer_view`, au
niveau **ERROR**. Le mécanisme est délibéré et sans alternative, mais un ERROR
ne se classe pas d'un commentaire. Trois mesures :

1. `anon` n'a plus aucun droit de lecture sur ces vues — vérifié depuis un
   client anonyme réel (`42501`) ;
2. un commentaire en base dit que le signalement est attendu et pourquoi ;
3. **un test structurel permanent** (`supabase/tests/00_platform_views.sql`)
   échoue si une vue `platform_%` perd son filtre `is_platform_admin()`, ou
   redevient lisible par `anon`. C'est le pendant du test de couverture RLS :
   la règle ne doit pas pouvoir disparaître sans que quelque chose casse.

## Défaut trouvé dans le harnais de test lui-même

En écrivant ce test, il a échoué pour une raison inattendue : les vues étaient
lisibles par `anon` alors que la migration les avait révoquées. En cause,
`scripts/validate-sql.sh` : il rejouait les `GRANT` de Supabase **après** les
migrations, défaisant tout `revoke` qu'une migration avait écrit.

Le harnais faisait donc passer pour ouvert ce qui était fermé en réalité — et
aurait tout aussi bien pu faire passer pour fermé ce qui était ouvert. Corrigé
en posant des `alter default privileges` **avant** les migrations, ce qui est
aussi la façon dont Supabase procède réellement.

## L'espace, et sa séparation

Arbre de routes `/plateforme`, coquille propre, navigation propre, garde propre.
Un bandeau permanent dit « Espace plateforme » — la même exigence que pour une
future session d'assistance. Deux gardes symétriques : un compte client qui
tente `/plateforme` est renvoyé chez lui, un compte de plateforme qui tente
`/file-attente` est renvoyé chez lui aussi. Rien de la navigation cliente
n'apparaît dans l'espace de plateforme, et réciproquement.

## Défauts d'interface vus à l'écran

| Défaut | Gravité | Correction |
|---|---|---|
| « 0 personne perdront l’accès » : accord faux et message absurde à zéro membre | MEDIUM | phrase complète construite dans le composant, trois cas |
| Sur mobile, la navigation recouvrait « ESPACE PLATEFORME » — la mention qui dit justement où l’on est | MEDIUM | la navigation prend sa propre ligne sous 720 px |
| « Dossiers 30 j » tronqué par le bouton d’action | LOW | les volumes passent à la ligne plutôt que d’écraser l’intitulé |
| « dernière activité aucune activité » | LOW | phrase complète renvoyée par le composant |

Les deux premiers sont assertés à l'écran : le test mesure le chevauchement des
boîtes et la troncature réelle, pas la présence du texte dans le DOM.

## Validation

| Contrôle | Résultat |
|---|---|
| Migrations sur PostgreSQL jetable | ✅ |
| Assertions SQL de sécurité | ✅ 188 (dont 34 nouvelles) |
| Campagne d'intrusion par l'API réelle | ✅ 20 assertions, tout bloqué |
| Fermeture des vues de plateforme à `anon` | ✅ vérifiée depuis un client anonyme |
| Playwright | ✅ 201 passés, 1 ignoré |
| Vérification des types | ✅ |
| Build de production | ✅ 479,08 kB (119,72 kB compressé) |
| Advisors sécurité | ✅ l'ERROR est traité, documenté et protégé par un test |

`scripts/intrusion-plateforme.mjs` rejoue la campagne à volonté.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Les vues de plateforme sont `SECURITY DEFINER` | MEDIUM | assumé, documenté en base et en fondation 3, fermé à `anon`, protégé par un test structurel permanent |
| Pas de fiche organisation détaillée | LOW | la liste porte l'essentiel ; la fiche viendra avec les abonnements |
| Ni plans, ni abonnements, ni feature flags | — | hors périmètre MVP (skill `vehora-super-admin`) : après les premiers clients payants |
| Session d'assistance non implémentée | — | ADR-003 : reportée, contraintes écrites |
| `confirm()` / `prompt()` natifs sur quatre écrans clients | LOW | dette assumée, à reprendre d'un coup |

Les six avertissements d'advisor restants sont les fonctions `SECURITY DEFINER`
volontairement ouvertes aux comptes connectés, toutes documentées en base, et la
protection contre les mots de passe compromis.

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 12 validée.**

## Suite

1. **Reçus et rapports** — numérotation sans trou, reçu imprimable, chiffre
   d'affaires par station et par jour ;
2. **Abonnements et feature flags** — plans, souscriptions, résolution
   organisation → plan → global ;
3. **Dette d'interface** — remplacer `confirm()` et `prompt()`, poser le verrou
   de défilement partout, écran des sessions de caisse passées.
