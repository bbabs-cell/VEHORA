# Phase 20 — Facturation des abonnements

## Pourquoi

Un abonnement se changeait à la main et ne produisait rien : ni échéance, ni
facture, ni relance. VEHORA facturait de mémoire.

## Quatre décisions

### 1. Une facture est un constat

Comme un reçu, comme une inspection. Elle fige ce qu'elle facture — le nom de
l'organisation, le code du plan, le montant — parce que renommer une
organisation ou changer un tarif ne doit modifier aucune facture émise. Aucune
policy d'écriture : l'émission, le règlement et l'annulation passent par des
fonctions qui vérifient leur droit et auditent. Un trigger refuse tout UPDATE et
tout DELETE.

### 2. Une facture appartient à la plateforme

C'est le revenu de VEHORA, jamais le chiffre d'affaires d'une station. Les deux
ne s'additionnent pas — la règle est écrite dans le texte de l'écran, là où
quelqu'un la lira. Le client n'a aucune policy de lecture ; il interroge
`mes_factures()`, qui ne prend aucun paramètre et ne parle que de lui.

### 3. Une organisation reste supprimable

`organization_id` est nullable et `ON DELETE SET NULL`, comme `audit_logs`, et
le nom est recopié dans la facture pour qu'elle reste lisible après coup. Le
trigger d'immuabilité se tait sur cette cascade — **écrit d'emblée cette fois**,
pas après le quatrième incident.

### 4. La numérotation est sans trou

UPSERT sur un compteur annuel, dans la transaction qui écrit : un échec annule
l'incrément. Références de la forme `VH-2026-000042`.

## Ce que la phase a trouvé : le quatrième incident de cascade, latent depuis la phase 13

En écrivant l'assertion « une organisation facturée reste supprimable », la
suppression a échoué sur un `VEHORA_RECU_IMMUABLE`. `receipts` référence
`organizations` en `ON DELETE CASCADE`, et `vehora.protect_receipt()` refusait
**tout** DELETE, cascade comprise.

**Depuis la phase 13, aucune organisation ayant émis un seul reçu ne pouvait
plus être supprimée.** L'invariant était rompu sans que rien ne le dise : les
assertions existantes supprimaient une organisation sans reçu.

Le correctif ne demande aucun drapeau. Lors d'une cascade, PostgreSQL supprime
la ligne parente **avant** les filles : si l'organisation du reçu n'existe plus,
la suppression vient de la cascade ; si elle existe encore, quelqu'un s'en prend
au reçu, et c'est refusé.

C'est la quatrième occurrence de la même règle (phases 1, 10, 14, et celle-ci).
La règle écrite n'a empêché aucune des trois précédentes : ce qui l'a trouvée,
cette fois, c'est une assertion qui supprime une organisation **réelle** — avec
ses dossiers, ses paiements, ses reçus et ses factures.

## Relance : un état, pas une sanction

`relancer_impayes()` fait passer en `PAST_DUE` les abonnements dont une facture
a dépassé son échéance. La suspension reste une décision, prise ailleurs et
auditée. Confondre les deux, c'est couper un client pour un virement en retard
de deux jours.

Un règlement fait le chemin inverse, et seulement si plus rien ne traîne.

## Deux défauts d'interface, vus à l'écran

1. Le bouton d'annulation s'appelait **« Annuler »**, à côté de « Marquer
   réglée » et au-dessus d'une modale dont le bouton de sortie porte déjà ce
   mot. Il se lisait « annuler l'opération ». Devenu « Annuler la facture ».
2. La période s'affichait « 1 septembre 2026 → 30 septembre 2026 », soit trois
   lignes sur un téléphone pour dire « septembre 2026 ». Le mois entier est
   maintenant nommé ; l'intervalle complet reste pour les périodes qui
   n'épousent pas un mois.

Au passage, `vh-confirmation` accepte un champ projeté (`<ng-content>`) et un
`desactive` : le motif et la référence de paiement se saisissent **dans** la
boîte, au lieu d'obliger à la fermer pour les saisir puis à la rouvrir.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` (app et tests) | ✅ |
| `npm run test:unit` | ✅ 16 assertions |
| `npm run build` | ✅ budgets respectés |
| `npm run validate:sql` | ✅ **271 assertions** |
| `npm run e2e` | ✅ **249 passés, 1 ignoré** |
| `scripts/intrusion-facturation.mjs` | ✅ **24 assertions**, tout bloqué |
| 8 campagnes d'intrusion antérieures | ✅ inchangées |
| Advisors Supabase | ✅ aucune classe nouvelle : les cinq fonctions et la vue suivent le schéma documenté (SECURITY DEFINER qui vérifie son droit et audite) |

## Reste à faire (propriétaire)

- Activer la protection contre les mots de passe divulgués dans Supabase.
- Créer le projet Supabase de production (`docs/deploiement.md`).
- Décider du fournisseur SMS avant toute phase de notifications.
