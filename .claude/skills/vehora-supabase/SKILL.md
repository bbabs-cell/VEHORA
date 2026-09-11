---
name: vehora-supabase
description: Conventions base de données et Supabase pour VEHORA — migrations, RLS, fonctions, requêtes, Storage, Realtime, types. À charger avant toute création ou modification de table, policy, fonction SQL, migration ou appel Supabase.
---

# Supabase / PostgreSQL — VEHORA

Référence : `docs/architecture/03-rls-super-admin.md`.
MCP Supabase disponible dans la session pour appliquer et inspecter.

## Migrations

Tout passe par `supabase/migrations/`, horodaté, versionné en Git.
**Aucune modification manuelle de la base**, jamais, même « juste pour tester ».

Cycle : écrire → `bash scripts/validate-sql.sh` (PostgreSQL jetable) → tests de
sécurité → commit. Une migration n'est jamais modifiée après commit : on en
ajoute une nouvelle.

## Règles de schéma

- `snake_case`, tables au pluriel, `id uuid primary key default gen_random_uuid()`.
- **Toute table métier porte `organization_id uuid not null`.** Sans exception.
  Et `station_id` dès que la donnée est rattachée à un site.
- Montants : `amount_minor bigint` + `currency`. Jamais de `float`, jamais de
  `numeric` pour de l'argent encaissé.
- Index sur `organization_id`, et sur `(organization_id, created_at desc)` pour
  toute table listée chronologiquement.
- `created_at` / `updated_at` en `timestamptz`, trigger `vehora.touch_updated_at()`.

## RLS — obligatoire, dès la création de la table

Dans la **même migration** que la table :
`alter table … enable row level security;` puis des policies explicites pour
`select`, `insert`, `update`, `delete`.

Les policies utilisent les helpers, jamais de jointure :

```sql
vehora.current_org_id()          vehora.current_profile_id()
vehora.has_permission('clé')     vehora.can_access_station(uuid)
vehora.can_read(org, perm, st)   vehora.can_write(org, perm, st)
vehora.is_platform_admin()       vehora.is_impersonating()
```

Lecture → `can_read`. Écriture → `can_write` (qui bloque en plus les sessions
d'assistance et les sessions révoquées).

**Interdits :**
- `using (true)` sur une table métier ;
- `or vehora.is_platform_admin()` sur une donnée cliente ;
- une sous-requête sur une table protégée par RLS dans une policy (récursion,
  et réévaluation par ligne) ;
- un `INSERT` sans `with check` — sinon `organization_id` est falsifiable.

## Fonctions

Règle métier côté serveur → fonction PL/pgSQL. `security definer` **toujours**
accompagné de `set search_path = ''` et de noms pleinement qualifiés.
Les helpers de lecture de claims sont `stable` : évalués une fois par requête.

## Requêtes côté Angular

- Jamais d'appel Supabase dans un composant : toujours un service de feature.
- Toujours `select()` explicite, jamais `select('*')` sur une table large.
- Toujours `.range()` ou `.limit()` : une liste non paginée finira par tuer un
  téléphone d'entrée de gamme.
- Ne jamais filtrer par `organization_id` côté client **comme mécanisme de
  sécurité** — c'est la RLS qui protège. Le filtre client sert la performance.

## Storage

Chemin imposé : `{bucket}/{organization_id}/{ressource}/{id}/{fichier}`.
Buckets **privés** uniquement, accès par URL signée courte. Policies comparant
le premier segment du chemin à `current_org_id()`.
Valider type MIME et taille **côté serveur**. Photos compressées avant envoi
(réseau lent, forfait data payant).

## Realtime

Uniquement là où ça change le travail : file d'attente et tableau des
opérations. Pas sur les listes historiques. Toujours se désabonner à la
destruction du composant.

## Types

`database.types.ts` est **généré** (MCP `generate_typescript_types` ou CLI),
jamais édité à la main. Le régénérer après chaque migration.

## Après toute migration

Lancer les advisors Supabase (sécurité et performance) et traiter ce qui
remonte avant de considérer la tâche finie.
