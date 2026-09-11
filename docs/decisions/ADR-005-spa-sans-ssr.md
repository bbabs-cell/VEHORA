# ADR-005 — Angular en SPA statique, sans SSR

**Statut :** acceptée · Phase 0

## Contexte

Le prompt impose Angular et Vercel, exige « peu de JavaScript inutile » et cible
des appareils Android modestes sur réseau instable. Angular SSR (`@angular/ssr`)
est possible mais complexifie nettement la gestion de session Supabase
(cookies, hydratation, jetons côté serveur).

## Décision

Application de gestion : **SPA statique**, pas de SSR. Cache agressif,
lazy loading par feature, budgets de bundle appliqués en CI (échec du build en
cas de dépassement). La landing page marketing est un projet séparé, statique et
optimisé pour le SEO — elle n'a pas les mêmes contraintes que l'application.

## Conséquences

Pas de SEO sur l'application de gestion : sans objet, elle est derrière un
login. Premier chargement plus lourd, mais unique et mis en cache — ce qui
correspond à l'usage réel : une application ouverte toute la journée, pas une
page visitée une fois.
