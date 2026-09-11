# Phase 1 — Auth, organisation, rôles, RLS (partie base de données)

## Périmètre

Application du socle de la phase 0 sur le projet Supabase réel
(`VAHORA`, `entpmxssjxllggsqhnwc`, PostgreSQL 17, eu-central-1), puis
vérification en conditions réelles de ce qui n'avait pu être testé qu'en local.

## Ce qui a été fait

8 migrations appliquées : les 6 de la phase 0, plus 2 correctives issues de
l'audit de cette phase. Base vierge au départ, aucune migration préexistante.

Référentiel en place : **10 rôles, 36 permissions, 142 associations**.

## Le risque résiduel de la phase 0 est levé

Le custom access token hook n'avait jamais été exécuté par un vrai Supabase.
Test réalisé : compte créé, organisation, adhésion `OWNER`, appel du hook.

Claims produits : `org_id` correct, `role = OWNER`,
`role_scope = ORGANIZATION`, **30 permissions**, `is_platform_admin = false`,
aucune permission `platform.*`. Le profil a bien été créé automatiquement par
le trigger `on_auth_user_created`.

Point levé au passage : on craignait que la RLS bloque `supabase_auth_admin`
lors de la lecture des adhésions. Ce n'est pas le cas — le hook est
`SECURITY DEFINER` et s'exécute donc avec les droits de son propriétaire.

## Tests de sécurité en conditions réelles

Exécutés sur le projet Supabase, sous le rôle `authenticated`, avec un JWT
produit par le hook lui-même.

| Angle | Test | Résultat |
|---|---|---|
| Autorisé | l'organisation et sa station sont visibles | ✅ |
| Autorisé | le référentiel des rôles est lisible | ✅ |
| Non autorisé | une seconde organisation reste invisible | ✅ |
| Non autorisé | le journal d'audit n'est pas lisible sans `audit.read` | ✅ |
| Malveillant | `organization_id` falsifié à l'insertion | refusé ✅ |
| Malveillant | escalade vers `SUPER_ADMIN` via `users.manage` | refusée ✅ |
| Malveillant | modification du journal d'audit hors RLS | refusée ✅ |

Validation locale : `scripts/validate-sql.sh` — **17 assertions au vert**
(16 + le test de non-régression ajouté ci-dessous).

## Vulnérabilités et défauts trouvés

### MEDIUM — `search_path` modifiable sur 13 fonctions

**Constat.** Advisors Supabase : 13 fonctions sans `search_path` fixe, dont des
`SECURITY DEFINER`. Une fonction sans `search_path` figé résout ses noms selon
le `search_path` de l'appelant.

**Impact.** Vecteur d'escalade de privilèges classique : un utilisateur crée
`son_schema.profiles`, le place en tête de son `search_path`, et la fonction
privilégiée lit sa table au lieu de la vraie.

**Correction.** `20260911130000_harden_function_search_path.sql` —
`set search_path = ''` sur les 13 fonctions. Sans régression : toutes utilisent
déjà des noms pleinement qualifiés. Hook revérifié après correction :
30 permissions, identique.

### MEDIUM — une organisation ne pouvait pas être supprimée

**Constat.** Découvert en tentant de nettoyer les données de test.
Le trigger `memberships_last_owner` protège le dernier propriétaire actif —
mais il se déclenchait **aussi** pendant la suppression en cascade d'une
organisation. La suppression échouait donc toujours, sur son propre propriétaire.

**Impact.** Suppression d'organisation impossible : ni pour la conformité
(droit à l'effacement), ni pour le nettoyage des comptes d'essai, ni pour les
tests. Un défaut de conception qui se serait révélé bien plus tard.

**Correction.** `20260911130100_fix_last_owner_on_cascade.sql` — la ligne
parente étant supprimée avant la cascade en PostgreSQL, l'absence de
l'organisation signale une cascade légitime et l'invariant est ignoré.

**Test ajouté.** `01_tenant_isolation.sql` vérifie désormais que
l'organisation est supprimable en cascade **et** que l'invariant protège
toujours une organisation vivante. Les deux au vert.

### INFO — protection contre les mots de passe compromis

L'advisor signalait initialement que la vérification HaveIBeenPwned est
désactivée. À activer dans le tableau de bord Supabase
(Authentication → Policies) — non modifiable par migration.

## Action requise du propriétaire

**Le custom access token hook doit être activé dans le tableau de bord** :
Authentication → Hooks → Customize Access Token → `vehora.custom_access_token_hook`.

Ce n'est pas automatisable par migration. Tant que ce n'est pas fait, les JWT
émis à la connexion ne porteront aucun claim et **toute la RLS refusera tout
accès**. La fonction est en place et testée ; seul le branchement manque.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Hook non encore activé dans le tableau de bord | HIGH tant que non fait | action propriétaire ci-dessus |
| Durée de vie des JWT encore à 3600 s (ADR-001 prévoit 900 s) | LOW | réglage tableau de bord, à faire avec l'activation du hook |
| Policies Storage non écrites | MEDIUM | phase 5 |
| Application Angular non démarrée | — | suite de la phase 1 |

Aucune vulnérabilité CRITICAL ou HIGH non corrigée sur le périmètre base.

## Suite de la phase 1

Projet Angular, client Supabase, parcours de connexion, garde de route,
sélection d'organisation, et premier écran authentifié.
