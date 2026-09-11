# Phase 0 — Analyse, architecture, fondations

## Périmètre

Mise en place des cinq fondations obligatoires (§5.1 du prompt maître), du
design system, de la structure projet, et des migrations du socle multi-tenant.
Aucune fonctionnalité métier. Aucun projet Supabase rattaché : les migrations
sont écrites, versionnées et **validées sur un PostgreSQL 16 jetable**, pas
encore appliquées.

## Livrables

| Livrable | Emplacement |
|---|---|
| Guide de travail | `CLAUDE.md` |
| Fondations 1 à 5 | `docs/architecture/01` → `05` |
| Design system, structure, sécurité | `docs/architecture/06` → `08` |
| Décisions d'architecture | `docs/decisions/ADR-001` → `ADR-005` |
| Migrations du socle | `supabase/migrations/` (6 fichiers) |
| Tests de sécurité | `supabase/tests/` |
| Harnais de validation | `scripts/validate-sql.sh` |
| Tokens de design | `src/styles/_tokens.css` |

## Tests réalisés

`scripts/validate-sql.sh` applique les migrations sur un PostgreSQL neuf puis
exécute les tests. **16 assertions, toutes au vert.**

Couverture, selon les trois angles imposés par le §63 :

1. **Autorisé** — un propriétaire voit son organisation et ses stations ; un
   opérateur voit la station où il est affecté.
2. **Non autorisé** — organisation A → B refusé en lecture (organisations,
   stations, adhésions, profils) ; station A → B refusé pour un rôle de portée
   station ; un opérateur sans `stations.manage` ne peut pas créer de station.
3. **Malveillant** — `organization_id` falsifié à l'insertion refusé (IDOR) ;
   escalade vers `SUPER_ADMIN` via `users.manage` refusée ; journal d'audit non
   modifiable ni supprimable, y compris hors RLS ; écriture refusée
   immédiatement après révocation de session ; affectation croisée entre
   organisations refusée ; dernier propriétaire protégé.

Un test structurel permanent (`00_rls_coverage.sql`) échoue si une table de
`public` n'a pas RLS activée ou n'a aucune policy.

## Vulnérabilités trouvées et corrigées

### HIGH — Journal d'audit modifiable via `service_role`

**Constat.** `audit_logs` n'avait aucune policy `UPDATE`/`DELETE`, ce qui
protège correctement un utilisateur authentifié. Mais `service_role` — utilisé
par les Edge Functions, et porteur de la clé d'administration — **contourne la
RLS entièrement**. Un journal d'audit que le porteur de cette clé peut réécrire
silencieusement ne prouve rien : c'est précisément contre les actions
privilégiées qu'il est censé protéger.

**Impact.** Effacement de traces d'actions Super Admin ou d'opérations
financières, sans laisser d'indice. Non détectable a posteriori.

**Correction.** `20260911120500_audit_immutability.sql` — triggers
`BEFORE UPDATE` et `BEFORE DELETE` qui lèvent une exception. Un trigger
s'applique à **tous** les rôles, y compris `service_role` et `postgres`.

**Test ajouté.** Vérification de l'immuabilité sous RLS *et* sous un rôle qui
l'ignore. Au vert.

### INFO — Une absence de policy ne lève pas d'erreur

Sous RLS, un `UPDATE` sans policy correspondante modifie 0 ligne sans erreur.
Conséquence sur la méthode de test : ne jamais conclure d'une absence
d'exception qu'une opération a été refusée — toujours vérifier le nombre de
lignes affectées. Intégré à la méthode de test du projet.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Le hook JWT n'a pas été exécuté par un vrai Supabase Auth | MEDIUM | à vérifier dès le rattachement du projet — priorité 1 de la phase 1 |
| Les policies Storage ne sont pas écrites | MEDIUM | phase 5 (photos, inspection) |
| La latence de révocation (15 min) n'est mitigée que sur les opérations sensibles | LOW | accepté, ADR-001 |
| Aucune table métier n'existe encore | — | phases suivantes |

Aucune vulnérabilité CRITICAL ou HIGH non corrigée.

## Écarts assumés par rapport au prompt maître

1. **Interface Super Admin réduite dans le MVP** — architecture complète
   (tables plateforme, audit, abonnements), interface limitée à : liste des
   organisations, fiche, suspendre/réactiver, audit logs. Le §55 demandait le
   Command Center complet ; il contredit le §3 (« ne pas sur-engineer »). À
   arbitrer par le propriétaire.
2. **Impersonation reportée** — ADR-003.
3. **Rôle `PLATFORM_SUPPORT` ajouté** — ADR-002.
4. **Mode clair livré en phase 2, pas en phase 20** — contrainte terrain
   (usage en plein soleil), pas une case d'accessibilité.
5. **Tests de sécurité dès la phase 0**, et non en phase 23 — exigés par le §63.

## Prochaine étape — Phase 1

Auth, organisation, rôles, RLS en conditions réelles. Prérequis : le projet
Supabase. Première action à son rattachement : appliquer les migrations, puis
vérifier que le custom access token hook produit bien les claims attendus.
