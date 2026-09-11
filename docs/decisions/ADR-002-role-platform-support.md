# ADR-002 — Rôle `PLATFORM_SUPPORT` distinct de `SUPER_ADMIN`

**Statut :** acceptée · Phase 0

## Contexte

Le prompt maître ne prévoit qu'un seul rôle de plateforme. En pratique,
consulter la liste des organisations pour répondre à une question de support et
suspendre une organisation sont deux niveaux de risque incomparables.

## Décision

Deux rôles de portée `PLATFORM` : `SUPER_ADMIN` (tout, y compris les actions
destructives) et `PLATFORM_SUPPORT` (lecture des métadonnées de plateforme,
tickets ; aucune action sensible, aucune assistance).

## Conséquences

Le compte le plus dangereux du système reste rare. Le travail quotidien de
support ne l'exige plus. Coût : une ligne de plus dans `roles`.
