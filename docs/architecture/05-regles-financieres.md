# Fondation 5 — Règles financières et tarification

## Trois concepts strictement séparés

| Concept | Question à laquelle il répond | Table |
|---|---|---|
| **PAYMENT** | combien le client a-t-il payé, sur quel dossier, par quel moyen ? | `payments` |
| **CASH TRANSACTION** | quel argent est entré ou sorti physiquement de la caisse ? | `cash_transactions` |
| **CASH REGISTER** | quelle session de caisse, ouverte par qui, avec quel fonds, quel solde théorique et quel écart à la clôture ? | `cash_registers` |

Un paiement en espèces génère une transaction de caisse. Un paiement Mobile
Money n'en génère **pas** — l'argent n'est pas dans le tiroir. Un retrait pour
acheter du savon est une transaction de caisse sans paiement. Confondre les
trois rend la caisse infalsifiable impossible à obtenir, et c'est la première
chose que le patron vérifiera.

## Montants

- Stockés en **entiers**, dans la plus petite unité de la devise
  (`amount_minor bigint`). Jamais de `float`. Le franc CFA n'a pas de
  subdivision d'usage, mais l'architecture doit rester internationale.
- Chaque montant porte sa `currency` (ISO 4217), héritée de l'organisation.
- Les totaux sont **calculés côté serveur**, jamais acceptés depuis le client.
  Le client envoie « service X, véhicule de type Y » ; le serveur détermine le prix.

## Tarification

```
services             -- lavage complet, aspiration, polish…
service_categories   -- regroupement d'affichage
vehicle_types        -- moto, citadine, berline, SUV, 4x4, pickup, utilitaire, camion, autre
service_prices       -- (service_id, vehicle_type_id, station_id?, valid_from, valid_to?, amount_minor)
```

Résolution du prix, du plus spécifique au plus général :

1. service + type de véhicule + station, valide à la date du jour
2. service + type de véhicule (toutes stations)
3. service (prix unique quel que soit le véhicule)

Aucun prix trouvé → erreur explicite. Jamais de prix implicite à zéro.

## Historisation — règle absolue

À la création d'une ligne de dossier, le prix résolu est **copié** dans
`service_order_items.unit_amount_minor`. Modifier un tarif demain ne modifie
jamais un dossier d'hier. `service_order_items` est en écriture seule une fois
le dossier sorti de `WAITING` : une correction se fait par annulation, avec
motif et trace.

## Paiements

Un dossier peut avoir **plusieurs paiements**, de méthodes différentes :

```
20 000 FCFA = 10 000 espèces + 10 000 Mobile Money
```

État financier dérivé, jamais stocké en dur :

- `total_amount` = somme des lignes − remises
- `paid_amount` = somme des paiements `COMPLETED`
- `balance` = `total_amount` − `paid_amount`
- `payment_status` = `UNPAID` | `PARTIAL` | `PAID` | `OVERPAID` | `REFUNDED`

Méthodes MVP : `CASH`, `MOBILE_MONEY`, `CARD`, `BANK_TRANSFER`, `OTHER`.
`MOBILE_MONEY` porte un champ libre `provider_name` et une référence de
transaction. **Aucune intégration d'API de paiement dans le MVP** : le caissier
saisit ce qu'il a reçu. La table est structurée (`provider`, `external_ref`,
`status`) pour que Wave, Orange Money, MTN MoMo ou Moov Money s'y branchent
plus tard sans migration douloureuse.

## Remises

Portées par la ligne (`discount_amount_minor` ou `discount_percent`), jamais
par un total libre. Une remise supérieure à un seuil défini par l'organisation
exige la permission `payments.refund` et est auditée. Sinon, la « remise »
devient le moyen standard de faire disparaître de l'argent.

## Annulation, remboursement, correction

- **Aucune suppression de paiement.** Jamais. Un paiement erroné est annulé par
  un `REFUND` qui le référence (`reverses_payment_id`), avec motif obligatoire.
- Un remboursement en espèces crée une sortie de caisse.
- Toutes ces opérations exigent `payments.refund` et sont auditées.

## Paiement et restitution

Paramètre `organization_settings.payment_before_delivery` :

- `STRICT` — restitution refusée si `balance > 0` ;
- `ALLOW_DEBT` (défaut) — restitution possible avec solde, si l'utilisateur a
  la permission `payments.refund` et fournit un motif ; le dossier reste en
  créance et apparaît dans la liste des impayés du client.

`ALLOW_DEBT` est le défaut parce que le client régulier qui règle en fin de
semaine est une réalité du marché visé. Le forcer à `STRICT` rendrait le
produit inutilisable pour eux. Décision : `docs/decisions/ADR-004`.

## Caisse

Une session de caisse par station et par utilisateur, avec :

ouverture (fonds de caisse déclaré) → mouvements (entrées, sorties, paiements
espèces) → clôture (comptage déclaré) → écart calculé = déclaré − théorique.

L'écart n'est jamais masqué ni corrigé silencieusement. Une session clôturée
est immuable. Une seule session ouverte à la fois par (station, utilisateur) —
contrainte en base, pas en code applicatif.

## Reçus

Numérotation **par organisation**, séquentielle, sans trou, générée en base
(`receipt_sequences` avec verrou), jamais côté client. Un reçu est immuable ;
une correction émet un nouveau reçu référençant l'ancien.

## Deux niveaux financiers à ne jamais mélanger

- **Chiffre d'affaires de l'organisation** : ce que la station encaisse de ses
  clients. Appartient au client.
- **Revenus VEHORA** : les abonnements payés par les organisations. Appartient
  à la plateforme.

Tables et écrans séparés. Aucune requête ne doit jamais les additionner.
