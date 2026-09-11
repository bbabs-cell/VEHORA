# Fondation 3 — Stratégie RLS et accès Super Admin

## Le risque principal

Le danger n'est pas la policy oubliée — un test la détecte. Le danger est la
policy **qui interroge une autre table protégée par RLS** : récursion infinie,
ou sous-requête réexécutée pour chaque ligne d'une liste paginée. Le produit
devient lent puis inutilisable, et la correction tardive impose de réécrire
toutes les policies.

## La règle : le contexte vit dans le JWT

Un *custom access token hook* Supabase (fonction PL/pgSQL appelée à l'émission
du token) enrichit le JWT :

```json
{
  "sub": "<auth user id>",
  "org_id": "<organisation active>",
  "role": "STATION_MANAGER",
  "role_scope": "STATION",
  "station_ids": ["…"],
  "permissions": ["service_orders.read", "payments.record", "…"],
  "is_platform_admin": false
}
```

Les policies lisent ces claims via des fonctions `STABLE` en `SECURITY DEFINER` :

```sql
vehora.current_org_id()        -> uuid
vehora.has_permission(text)    -> boolean
vehora.can_access_station(uuid)-> boolean
vehora.is_platform_admin()     -> boolean
```

Aucune jointure par ligne. Une policy typique :

```sql
create policy "org members read service orders"
on public.service_orders for select
using (
  organization_id = vehora.current_org_id()
  and vehora.has_permission('service_orders.read')
  and vehora.can_access_station(station_id)
);
```

### Conséquence à gérer : la latence de révocation

Un changement de rôle ne prend effet qu'au renouvellement du token (1 heure par
défaut). C'est inacceptable pour une suspension. Mitigation retenue :

- durée de vie des access tokens réduite à **15 minutes** ;
- table `session_revocations` : une suspension y écrit une ligne, et les
  policies des opérations **sensibles** (paiements, caisse, restitution,
  gestion des utilisateurs) la vérifient — une seule lecture indexée, pas une
  jointure par ligne ;
- le frontend force un `refreshSession()` après tout changement de rôle.

Décision détaillée : `docs/decisions/ADR-001`.

## Les quatre couches d'accès

1. **Membre d'organisation** — `organization_id = current_org_id()` + permission.
2. **Restreint à une station** — en plus, `can_access_station(station_id)`.
3. **Super Admin plateforme** — voir ci-dessous.
4. **Opérations privilégiées** — jamais en accès direct aux tables : Edge
   Functions avec la clé `service_role`, qui vérifient elles-mêmes les droits
   et écrivent dans `audit_logs`.

## Accès Super Admin : ce qu'on ne fait PAS

On n'ajoute **pas** `or vehora.is_platform_admin()` à toutes les policies.
Raison : cela crée un contournement unique, global et silencieux de tout le
cloisonnement multi-tenant. Une seule erreur de logique dans cette fonction, ou
un seul compte compromis, expose les données de tous les clients. Et l'accès
devient invisible dans les journaux, puisqu'il emprunte le chemin normal.

## Accès Super Admin : ce qu'on fait

| Besoin | Mécanisme |
|---|---|
| Piloter la plateforme (organisations, abonnements, stations, utilisateurs, revenus) | Tables **`platform_*`** et **vues agrégées**, avec leurs propres policies réservées à `is_platform_admin()`. Ce sont des métadonnées et des agrégats — pas les données métier brutes des clients. |
| Statistiques globales | Vues matérialisées rafraîchies périodiquement. Aucun accès ligne à ligne aux prestations d'un client. |
| Actions sensibles (suspendre, réactiver, changer un plan) | Edge Functions `service_role`, avec vérification de permission et écriture obligatoire dans `audit_logs`. |
| Voir les données d'une organisation pour du support | **Session d'assistance** uniquement (ci-dessous). Jamais d'accès direct. |

Le Super Admin n'a donc **aucune policy de lecture sur les tables métier des
clients**. C'est la propriété la plus importante de cette fondation.

## Session d'assistance (impersonation) — reporté après le MVP

Non implémentée dans le MVP (voir ADR-003 : trop risquée, trop peu urgente).
Quand elle le sera, les contraintes sont non négociables :

- jamais le mot de passe du client, jamais ses identifiants ;
- une Edge Function crée une adhésion temporaire en **lecture seule**, avec
  expiration courte (30 min maximum) et raison obligatoire ;
- le JWT porte `impersonation_session_id` ; toute écriture est refusée par RLS
  quand ce claim est présent ;
- bandeau permanent « MODE ASSISTANCE SUPER ADMIN — organisation X » et sortie
  en un clic ;
- début, fin et **chaque action** écrits dans `audit_logs` ;
- l'organisation est notifiée qu'une session d'assistance a eu lieu.

## Storage

Chemin imposé : `{bucket}/{organization_id}/{ressource}/{id}/{fichier}`.
Les policies Storage comparent le **premier segment du chemin** à
`current_org_id()`. Buckets privés uniquement ; l'accès passe par des URLs
signées à durée courte. Jamais de bucket public pour des photos de véhicules —
une plaque d'immatriculation est une donnée personnelle.

## Tests obligatoires (à chaque phase)

- organisation A lisant/écrivant les données de B → refusé, sur `SELECT`,
  `INSERT`, `UPDATE`, `DELETE`, pour **chaque** table ;
- station A → station B pour un rôle de portée station → refusé ;
- membre suspendu → refusé ;
- utilisateur sans la permission → refusé ;
- `organization_id` falsifié dans un `INSERT` → refusé (`WITH CHECK`) ;
- fichier d'une autre organisation → refusé ;
- absence de policy sur une table : détectée automatiquement par un test qui
  liste les tables de `public` sans RLS activé. **Ce test doit exister dès la
  phase 1 et ne jamais être désactivé.**
