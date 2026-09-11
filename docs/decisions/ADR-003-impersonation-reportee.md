# ADR-003 — Session d'assistance (impersonation) reportée après le MVP

**Statut :** acceptée · Phase 0

## Contexte

Le §22 du prompt maître décrit une fonction permettant au Super Admin de voir
l'application dans le contexte d'une organisation cliente. C'est la
fonctionnalité qui porte le plus grand risque de sécurité de toute la
plateforme, et celle dont l'utilité est la plus faible tant qu'il n'y a pas de
clients.

## Décision

Non implémentée dans le MVP. L'architecture la rend possible sans réécriture :
adhésion temporaire en lecture seule créée par une Edge Function, claim
`impersonation_session_id` dans le JWT bloquant toute écriture par RLS,
expiration à 30 minutes, motif obligatoire, audit complet, bandeau permanent,
notification de l'organisation.

## Conséquences

Le support se fait d'abord par téléphone et capture d'écran — ce qui est de
toute façon le mode réel des premiers mois. La fonctionnalité sera construite
quand un besoin réel et mesuré le justifiera, avec le temps nécessaire pour la
sécuriser correctement.
