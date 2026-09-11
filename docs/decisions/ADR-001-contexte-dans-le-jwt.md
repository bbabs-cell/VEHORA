# ADR-001 — Le contexte multi-tenant vit dans le JWT

**Statut :** acceptée · Phase 0

## Contexte

Les policies RLS doivent connaître l'organisation, la portée du rôle, les
stations accessibles et les permissions de l'utilisateur. La solution naïve
consiste à interroger `organization_memberships` et `role_permissions` dans
chaque policy. Sur une liste paginée de 50 dossiers, cela exécute la
sous-requête 50 fois ; et comme ces tables sont elles-mêmes protégées par RLS,
on obtient une récursion qu'il faut casser avec `SECURITY DEFINER` de toute façon.

## Décision

Un *custom access token hook* Supabase injecte dans le JWT : `org_id`, `role`,
`role_scope`, `station_ids`, `permissions`, `is_platform_admin`. Les policies
lisent ces claims via des fonctions `STABLE SECURITY DEFINER` du schéma
`vehora`. Durée de vie des access tokens : **15 minutes**.

## Conséquences

- Policies simples, rapides, sans jointure par ligne.
- **Latence de révocation** : un changement de droits ne s'applique qu'au
  renouvellement du token. Mitigé par : 15 minutes de durée de vie, table
  `session_revocations` consultée par les policies des opérations sensibles
  (paiements, caisse, restitution, gestion des utilisateurs), et
  `refreshSession()` forcé côté frontend après tout changement de rôle.
- Le JWT grossit avec le nombre de permissions. Acceptable en dessous d'une
  centaine ; au-delà, passer à un champ de bits par rôle.
- Changer d'organisation active impose un rafraîchissement de token.

## Alternatives écartées

- **Jointures dans les policies** : correct mais lent, et récursif.
- **Filtrage applicatif seul** : contourné par un appel direct à PostgREST.
