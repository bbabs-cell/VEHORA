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

---

# Phase 1 — seconde partie : application Angular et authentification

## Périmètre

Projet Angular 22, client Supabase, parcours de connexion, gardes de route,
écran authentifié minimal, tests de parcours Playwright.

## Ce qui a été construit

| Élément | Emplacement |
|---|---|
| Client Supabase unique | `src/app/core/supabase/` |
| Lecture des claims JWT | `src/app/core/auth/session-claims.ts` |
| Service d'authentification (signals) | `src/app/core/auth/auth.service.ts` |
| Gardes : session, organisation, permission | `src/app/core/auth/auth.guard.ts` |
| Écran de connexion | `src/app/features/auth/login/` |
| Écran « aucune organisation » | `src/app/features/auth/no-organization/` |
| Tableau de bord minimal | `src/app/features/dashboard/` |
| Types générés | `src/app/types/database.types.ts` |
| Tests de parcours | `e2e/auth.spec.ts` |

Angular 22 exige **Node ≥ 22.22.3** ; l'environnement disposait de 22.22.2.
Node 24 a été installé plutôt que de rétrograder Angular, et le hook
`SessionStart` bascule dessus automatiquement en cloud.

## Vulnérabilités et défauts trouvés

### CRITICAL — collision sur le claim JWT `role`

**Constat.** Supabase place dans chaque JWT un claim `role` valant
`authenticated`. **PostgREST s'en sert pour choisir le rôle PostgreSQL de la
session.** Notre hook l'écrasait avec le code de rôle métier (`OWNER`,
`CASHIER`…).

**Impact.** PostgREST aurait exécuté `set role OWNER` — un rôle inexistant en
base. **Toutes les requêtes API auraient échoué**, ou se seraient exécutées
avec un rôle inattendu. L'application entière aurait été inutilisable dès la
première connexion réelle.

**Pourquoi le test de la première partie ne l'a pas vu.** L'événement simulé ne
contenait que `sub` — pas le claim `role` que Supabase fournit réellement. Une
leçon de méthode : un test doit reproduire l'entrée réelle, pas une version
simplifiée.

**Correction.** `20260912090000_fix_jwt_role_claim_collision.sql` — le rôle
métier passe désormais par `vehora_role` ; le claim `role` n'est plus jamais
touché. Vérifié avec un événement réaliste : `role` reste `authenticated`,
`vehora_role` vaut `CASHIER`, 10 permissions.

**Règle retenue** (inscrite dans `CLAUDE.md`) : ne jamais réutiliser un nom de
claim réservé — `role`, `sub`, `aud`, `exp`, `iat`, `iss`, `email`, `phone`,
`session_id`, `aal`, `amr`, `is_anonymous`.

### MEDIUM — blocage définitif de l'application si la session ne se restaure pas

**Constat.** `getSession()` n'était pas protégé. En cas d'échec (réseau coupé au
démarrage, stockage local inaccessible), la promesse était rejetée, l'état
restait à « chargement », et les gardes attendaient **indéfiniment**.

**Impact.** Application figée sur l'écran de chargement, sans issue ni message.
Sur un réseau instable — précisément notre marché — ce n'est pas théorique.

**Correction.** `try/catch` dans `restoreSession()` (l'utilisateur est
considéré déconnecté), et attente **bornée à 5 secondes** dans les gardes. Deux
filets indépendants.

### LOW — écran blanc pendant le démarrage

Entre le chargement de la page et le démarrage d'Angular, l'écran restait vide.
Corrigé par un indicateur inline dans `index.html`, remplacé au démarrage.
Coût : quelques octets, aucun script.

## Tests

| Suite | Résultat |
|---|---|
| Types (`tsc --noEmit`, strict complet) | ✅ |
| Build de production, budgets appliqués | ✅ 445 kB bruts → **109 kB transférés** |
| Sécurité SQL (`validate-sql.sh`) | ✅ 17 assertions |
| Parcours Playwright (mobile + desktop) | ✅ 12 tests |

Les tests de parcours couvrent : redirection d'un visiteur non connecté,
conservation de la cible de redirection, validation avant tout appel réseau,
message d'erreur ne révélant pas l'existence d'un compte, cibles tactiles
≥ 44 px, et **absence de `service_role` ou de secret dans le bundle servi**.

Vérification visuelle : écran de connexion capturé en 360 px et 1280 px, en
thème sombre et clair. Les deux sont lisibles et conformes au design system.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Hook non encore activé dans le tableau de bord Supabase | HIGH tant que non fait | action propriétaire — la connexion ne donnera aucun droit sans lui |
| Jeton de session en `localStorage` : une faille XSS le volerait | MEDIUM | inhérent à Supabase ; Angular échappe par défaut, aucun `innerHTML` dans le code |
| Durée de vie des JWT encore à 3600 s | LOW | réglage tableau de bord (ADR-001 prévoit 900 s) |
| Aucun parcours connecté testé de bout en bout | MEDIUM | dépend de l'activation du hook ; à faire en priorité en phase 2 |
| Policies Storage non écrites | MEDIUM | phase 5 |

Aucune vulnérabilité CRITICAL ou HIGH non corrigée.

## Suite — phase 2

Design system appliqué, layout, navigation, responsive, et mode clair
fonctionnel. Puis création d'une organisation et d'un premier compte réel, pour
tester le parcours connecté de bout en bout.
