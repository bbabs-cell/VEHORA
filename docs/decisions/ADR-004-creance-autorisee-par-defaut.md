# ADR-004 — Restitution avec créance autorisée par défaut

**Statut :** acceptée · Phase 0 · **décision métier, révocable par le propriétaire**

## Contexte

Faut-il interdire la restitution d'un véhicule tant que le solde n'est pas nul ?

## Décision

Paramètre `organization_settings.payment_before_delivery` : `ALLOW_DEBT`
(défaut) ou `STRICT`. En `ALLOW_DEBT`, restituer avec un solde exige la
permission `payments.refund` et un motif, et laisse le dossier en créance.

## Conséquences

Le client régulier qui règle en fin de semaine — cas courant sur le marché
visé — reste servi. Le patron garde la visibilité : la liste des impayés par
client existe dès le MVP, sinon le paramètre devient un trou de caisse.
Une organisation prudente bascule en `STRICT` en un clic.

## Alternative écartée

Blocage strict sans paramètre : rendrait le produit inutilisable pour une part
significative des stations visées.
