# Fondation 1 — Rôles et permissions (RBAC)

## Principe

Les **rôles** sont attribués aux utilisateurs. Les **permissions** sont
attribuées aux rôles. Le code métier et les policies RLS ne testent **jamais**
un rôle directement — ils testent une **permission**.

```
utilisateur → adhésion (organisation) → rôle → permissions
```

Pourquoi : ajouter un rôle « Chef d'équipe » ou retirer le droit d'annuler un
paiement à un caissier ne doit jamais obliger à réécrire des policies RLS.

## Les trois niveaux de portée

| Portée | Signification | Rôles |
|---|---|---|
| `PLATFORM` | l'équipe VEHORA | `SUPER_ADMIN`, `PLATFORM_SUPPORT` |
| `ORGANIZATION` | toute l'entreprise cliente | `OWNER`, `ORG_ADMIN`, `MANAGER` |
| `STATION` | un site précis | `STATION_MANAGER`, `RECEPTIONIST`, `OPERATOR`, `CASHIER`, `QUALITY_CONTROLLER` |

Un utilisateur possède **un rôle par organisation** (table
`organization_memberships`). S'il est de portée `STATION`, ses droits ne
s'appliquent qu'aux stations où il est affecté (table `station_users`). Un rôle
de portée `ORGANIZATION` porte sur toutes les stations de l'organisation.

`PLATFORM_SUPPORT` est ajouté par rapport au prompt maître : il permet de
donner un accès de support en lecture sans distribuer le rôle `SUPER_ADMIN`,
qui est le compte le plus dangereux du système. Décision : `docs/decisions/ADR-002`.

## Nommage des permissions

`ressource.action`, en minuscules, stable dans le temps :

```
customers.read        customers.write       customers.delete
vehicles.read         vehicles.write
service_orders.read   service_orders.write  service_orders.cancel
service_orders.transition          -- changer de statut (détail : fondation 4)
inspections.write
operations.assign     operations.execute
quality_controls.execute
payments.read         payments.record       payments.refund
cash.open             cash.move             cash.close        cash.reconcile
restitutions.execute
services.manage       prices.manage
employees.manage      users.manage          roles.manage
stations.manage       organization.manage
reports.read          audit.read
platform.organizations.read   platform.organizations.suspend
platform.users.read           platform.impersonate
platform.settings.manage      platform.audit.read
```

Les permissions `platform.*` ne sont accordées qu'aux rôles de portée `PLATFORM`
et ne sont jamais attribuables depuis l'interface d'une organisation.

## Matrice de référence (MVP)

| Permission | OWNER | ORG_ADMIN | MANAGER | STATION_MANAGER | RECEPTIONIST | OPERATOR | CASHIER | QUALITY_CONTROLLER |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| customers.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| customers.write | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| vehicles.write | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| service_orders.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| service_orders.write | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| service_orders.transition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| service_orders.cancel | ✓ | ✓ | ✓ | ✓ | | | | |
| inspections.write | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| operations.assign | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| operations.execute | ✓ | ✓ | ✓ | ✓ | | ✓ | | |
| quality_controls.execute | ✓ | ✓ | ✓ | ✓ | | | | ✓ |
| payments.record | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | |
| payments.refund | ✓ | ✓ | | ✓ | | | | |
| cash.open / cash.move / cash.close | ✓ | ✓ | ✓ | ✓ | | | ✓ | |
| cash.reconcile | ✓ | ✓ | ✓ | ✓ | | | | |
| restitutions.execute | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | |
| services.manage / prices.manage | ✓ | ✓ | | | | | | |
| employees.manage | ✓ | ✓ | ✓ | ✓ | | | | |
| users.manage / roles.manage | ✓ | ✓ | | | | | | |
| stations.manage | ✓ | ✓ | | | | | | |
| organization.manage | ✓ | | | | | | | |
| reports.read | ✓ | ✓ | ✓ | ✓ | | | | |
| audit.read | ✓ | ✓ | | | | | | |

`service_orders.transition` est accordée largement parce que la permission
seule ne suffit pas : **chaque transition a ses propres conditions**, définies
dans la fondation 4 et appliquées côté serveur.

Note : `OWNER` est le seul à détenir `organization.manage` (facturation,
abonnement, suppression). Il ne doit jamais y avoir zéro `OWNER` actif dans une
organisation — contrainte appliquée en base.

## Implémentation

- Tables : `roles`, `permissions`, `role_permissions`,
  `organization_memberships`, `station_users`.
- Les permissions effectives sont **injectées dans le JWT** par un
  *custom access token hook* Supabase (voir fondation 3), pour que les policies
  RLS n'aient pas à faire de jointure par ligne.
- Le frontend lit les mêmes permissions depuis le JWT pour masquer l'UI.
  **Le masquage est du confort, jamais de la sécurité.**

## Évolutivité

Ajouter un rôle = une ligne dans `roles` + des lignes dans `role_permissions`.
Aucune policy RLS ni aucun code applicatif à modifier. C'est le test qui valide
que cette fondation est correctement implémentée.
