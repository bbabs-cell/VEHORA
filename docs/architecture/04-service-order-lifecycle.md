# Fondation 4 — Cycle de vie du Service Order

`service_orders` est le cœur du produit. Tout le reste s'y rattache.

## Statuts

| Statut | Signification |
|---|---|
| `ARRIVED` | le véhicule est arrivé, le dossier est ouvert |
| `INSPECTION` | état des lieux avant prestation en cours |
| `WAITING` | inspection faite, en file d'attente |
| `IN_PROGRESS` | au moins une opération est démarrée |
| `CONTROL` | travail terminé, contrôle qualité en cours |
| `READY` | contrôlé, prêt à être restitué |
| `DELIVERED` | restitué au client — état terminal |
| `CANCELLED` | annulé — état terminal |

Stockés en anglais en base, affichés en français (ARRIVÉ, INSPECTION, EN
ATTENTE, EN COURS, CONTRÔLE, PRÊT, RESTITUÉ, ANNULÉ).

## Matrice des transitions

| De → Vers | Permission | Conditions | Audit |
|---|---|---|---|
| `ARRIVED` → `INSPECTION` | `inspections.write` | — | non |
| `ARRIVED` → `WAITING` | `service_orders.transition` | inspection désactivée pour l'organisation | non |
| `INSPECTION` → `WAITING` | `inspections.write` | inspection enregistrée (au moins « RAS ») | non |
| `WAITING` → `IN_PROGRESS` | `operations.execute` | ≥ 1 opération assignée à un employé actif | non |
| `IN_PROGRESS` → `CONTROL` | `operations.execute` | toutes les opérations `DONE` ; checklists obligatoires complètes | non |
| `IN_PROGRESS` → `READY` | `service_orders.transition` | contrôle qualité désactivé pour l'organisation | non |
| `CONTROL` → `IN_PROGRESS` | `quality_controls.execute` | contrôle rejeté ; **motif obligatoire** | oui |
| `CONTROL` → `READY` | `quality_controls.execute` | contrôle validé | non |
| `READY` → `DELIVERED` | `restitutions.execute` | **règle de paiement satisfaite** (fondation 5) | oui |
| tout sauf terminal → `CANCELLED` | `service_orders.cancel` | **motif obligatoire** ; aucun paiement encaissé non remboursé | oui |

Toute autre transition est **interdite**. Il n'y a pas de retour arrière libre :
corriger une erreur de saisie se fait par annulation puis nouveau dossier, ce
qui laisse une trace. Un dossier `DELIVERED` ou `CANCELLED` est immuable.

## Application côté serveur

Les transitions ne passent **pas** par un `UPDATE` direct depuis le client.
Une fonction PostgreSQL est le seul chemin :

```sql
vehora.transition_service_order(
  p_service_order_id uuid,
  p_to_status        text,
  p_reason           text default null
) returns service_orders
```

Elle : verrouille la ligne (`for update`), vérifie que la transition existe
dans la matrice, vérifie la permission, vérifie les conditions, écrit
`service_order_status_history`, écrit `audit_logs` si requis, met à jour le
statut. Toute violation lève une exception nommée, traduite en message
utilisateur par le frontend.

Un trigger `BEFORE UPDATE` sur `service_orders` **rejette** toute modification
de `status` qui ne provient pas de cette fonction. Sans ce trigger, la RLS
seule laisserait passer un changement de statut arbitraire via l'API REST.

## Options par organisation

Certaines stations n'ont ni le temps ni le personnel pour une inspection et un
contrôle qualité formels sur un lavage à 2 000 FCFA. Deux paramètres dans
`organization_settings` :

- `require_inspection` (défaut : `true`)
- `require_quality_control` (défaut : `true`)

Ils ouvrent les deux transitions de contournement de la matrice. Ils ne peuvent
pas être modifiés par une station, seulement au niveau organisation, et tout
changement est audité. **Ce sont des paramètres, pas des cas particuliers dans
le code** : la matrice reste unique.

## Historique

`service_order_status_history` enregistre pour chaque changement : dossier,
statut précédent, nouveau statut, auteur, horodatage, motif. C'est la source
des durées réelles (temps d'attente, temps de travail), donc de tous les
indicateurs opérationnels. À écrire dès la phase 7, pas plus tard — l'historique
ne se reconstitue pas.

## Ce que le Service Order ne fait pas

Il ne porte pas les montants. Les lignes (`service_order_items`) portent les
prix historisés, et `payments` porte les encaissements. Le total est calculé,
jamais saisi.
