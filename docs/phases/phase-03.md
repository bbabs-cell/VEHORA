# Phase 3 — Tableau de bord orienté action et gestion des stations

## Écart assumé par rapport à la roadmap

La roadmap prévoit « Dashboard organisation » en phase 3, mais les prestations
n'arrivent qu'en phase 7 : un tableau de bord seul n'aurait affiché que des
zéros. J'ai donc ajouté **la gestion des stations** — la seule donnée réelle et
modifiable aujourd'hui. Cela évite un écran vide, et met enfin à l'épreuve
`permissionGuard`, écrit en phase 1 mais jamais exercé.

Le tableau de bord n'affiche **que des indicateurs réellement calculables**.
Afficher « Prestations du jour : 0 » pour une fonctionnalité inexistante
tromperait l'utilisateur.

## Ce qui a été construit

| Élément | Emplacement |
|---|---|
| Tuile d'indicateur | `src/app/shared/ui/stat-tile.component.ts` |
| Service des stations | `src/app/core/stations/station.service.ts` |
| Tableau de bord orienté action | `src/app/features/dashboard/` |
| Gestion des stations | `src/app/features/stations/` |
| Tests deux personas | `e2e/stations.spec.ts` |

Le tableau de bord porte : actions rapides, indicateurs (stations actives,
membres actifs), activité du jour avec état vide explicite, et récapitulatif
d'accès.

La gestion des stations couvre création, modification et désactivation.
**Pas de suppression** : une station porte un historique de prestations et de
caisse ; la supprimer effacerait ce passé. La désactivation conserve tout.

## Défauts trouvés et corrigés

### MEDIUM — condition de course sur `organization_id`

**Constat.** Trouvé par un test qui échouait : en ouvrant `/stations`
directement, la création affichait « Votre organisation n'a pas pu être
identifiée ». Le formulaire lisait l'organisation depuis un chargement
asynchrone non terminé.

**Impact.** Un utilisateur arrivant par un lien direct ou un favori — le cas
normal, pas un cas limite — ne pouvait pas créer de station.

**Correction.** Pas d'attente côté client : suppression du besoin.
`stations.organization_id` prend désormais pour défaut
`vehora.current_org_id()` (migration `20260912120000`). Le client ne l'envoie
plus du tout.

**Bénéfice de sécurité.** Une valeur que le client n'envoie plus est une valeur
qu'il ne peut plus falsifier. Le `with check` de la policy reste en place —
défense en profondeur, pas remplacement. Deux tests SQL le vérifient : la
valeur est bien remplie quand elle est omise, **et** un `organization_id`
falsifié reste refusé.

### WARN — policies permissives multiples

**Constat.** Advisors Supabase : `organization_memberships`, `profiles` et
`station_users` portaient chacune **deux** policies `SELECT` permissives.
PostgreSQL évalue alors chaque policy pour chaque ligne examinée, puis combine
en OR.

**Impact.** Deux fois le travail sur les tables lues à chaque écran. Invisible
aujourd'hui, coûteux sur un catalogue chargé et un appareil modeste.

**Correction.** Une seule policy par table et par action, condition égale au OR
explicite des deux précédentes. Sémantique strictement identique — les
19 assertions SQL passent sans modification.

### INFO — clés étrangères sans index

Trois clés étrangères sans index de couverture, dont `audit_logs.station_id` —
la table qui grossira le plus. Index ajoutés.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build, budgets appliqués | ✅ 117,7 kB transférés |
| Sécurité SQL | ✅ **19 assertions** |
| Parcours Playwright | ✅ **39 tests** |
| Advisors sécurité | ✅ aucune alerte de base |
| Advisors performance | ✅ plus aucun WARN |

### Les trois angles, sur une fonctionnalité réelle

C'est la première phase où la matrice de permissions est éprouvée avec deux
comptes distincts.

1. **Autorisé** — le propriétaire crée, modifie et désactive une station ; le
   nom en double affiche un message clair ; le nom vide bloque **sans appel
   réseau**.
2. **Non autorisé** — le caissier (10 permissions, portée `STATION`) ne voit ni
   l'entrée de navigation ni l'action rapide.
3. **Malveillant** — l'accès direct à `/stations` par l'URL renvoie au tableau
   de bord ; par l'API, la création est refusée (**403**), et la modification,
   la désactivation et la suppression de sa propre station ne touchent
   **aucune ligne**.

Vérifié aussi par l'API réelle : le caissier ne voit **que la station où il est
affecté** — la portée `STATION` fonctionne de bout en bout.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| La confirmation de désactivation utilise `confirm()` natif | LOW | à remplacer par une modale cohérente avec le design system |
| Aucune gestion des utilisateurs dans l'interface | MEDIUM | tout passe encore par SQL — prochaine étape |
| Policies Storage non écrites | MEDIUM | phase 5 |
| Deux comptes de démonstration en base | LOW | à supprimer avant production |

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 3 validée.**

## Suite

Deux options, à arbitrer par le propriétaire :
- **approvisionnement d'organisation et gestion des utilisateurs** — créer une
  entreprise et inviter des collègues depuis l'application, sans SQL ;
- **CRM clients** (phase 4 de la roadmap).

L'approvisionnement me paraît prioritaire : sans lui, aucun client réel ne peut
être intégré au produit.
