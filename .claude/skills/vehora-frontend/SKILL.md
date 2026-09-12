---
name: vehora-frontend
description: Ingénierie frontend VEHORA — patterns Angular modernes, performance sur Android modeste, accessibilité, formulaires, état, erreurs réseau. À charger avant d'écrire un composant, un service, une route, un formulaire ou du CSS. Complète vehora-design-system (le visuel) et vehora-ux (le parcours).
---

# Frontend VEHORA — Angular

Trois skills se partagent le frontend, sans se recouvrir :
`vehora-design-system` = **à quoi ça ressemble** · `vehora-ux` = **comment ça
s'utilise** · **ce skill = comment c'est construit**.

## Angular : les règles du projet

- **Composants standalone.** Aucun `NgModule`.
- **`ChangeDetectionStrategy.OnPush` partout.** Sans exception — c'est ce qui
  rend l'application utilisable sur un Android d'entrée de gamme.
- **Signals** pour l'état local et dérivé. RxJS **uniquement** pour les flux
  réellement asynchrones et continus (Realtime, saisie avec `debounce`).
- **`inject()`** plutôt que l'injection par constructeur.
- **`@if` / `@for` / `@switch`** (syntaxe de flux de contrôle), pas les
  directives structurelles historiques. `@for` exige toujours un `track`.
- `strict: true` **et** `strictTemplates: true`. Jamais de `any` : si un type
  manque, on le génère ou on le déclare.

## Découpage

- Une feature = un dossier **lazy-loadé** (`loadComponent` / `loadChildren`).
- **Aucune feature n'importe une autre feature.** Ce qui est partagé remonte
  dans `shared/` (présentation) ou `core/` (singletons).
- **Aucun appel Supabase dans un composant** : toujours un service de feature.
  Les règles deviennent testables et les requêtes optimisables en un seul point.
- Composant > 200 lignes : le découper. Un composant fait une chose.

## Performance — contrainte de marché, pas de confort

Budget : **bundle initial ≤ 250 Ko compressé**, chaque feature ≤ 100 Ko.
Configuré dans `angular.json` → un dépassement **casse le build**.

- Vérifier le poids d'une dépendance avant de l'ajouter. Une date formatée ne
  justifie pas 70 Ko de bibliothèque.
- Listes longues : pagination systématique ; `@defer` pour ce qui est hors écran.
- Images : compression avant envoi, miniatures à l'affichage, `loading="lazy"`,
  `width`/`height` toujours renseignés (évite le décalage de mise en page).
- Polices en local, `font-display: swap`. Jamais de CDN de polices.
- Pas d'animation sur une propriété qui déclenche un recalcul de mise en page :
  `transform` et `opacity` uniquement.

## Formulaires

**Un formulaire ne doit jamais échouer en silence.** C'est le défaut le plus
souvent reproduit sur ce projet : un champ obligatoire dépend d'un chargement
asynchrone (rôles, types, tarifs), il est encore vide quand l'utilisateur
valide, le formulaire est invalide, et **rien ne s'affiche**. L'utilisateur
clique et croit à une panne.

Trois règles, à appliquer ensemble :
1. désactiver l'action qui ouvre le formulaire tant que la donnée n'est pas là ;
2. renseigner le défaut par un `effect` dès qu'elle arrive ;
3. afficher un message explicite si la validation bloque sur ce champ.

Reactive forms, jamais `ngModel`. Validation **côté client pour le confort,
côté serveur pour la vérité** — les deux, jamais l'une à la place de l'autre.
Un message d'erreur est attaché à son champ, en français, et dit comment
corriger. Les formulaires longs sauvegardent leur état localement pendant la
saisie (coupure réseau).

## Réseau

Un intercepteur central gère : jeton expiré, hors ligne, réessai avec recul
exponentiel sur les erreurs transitoires. Toute action rejouable est
**idempotente**. Retour optimiste autorisé **sauf** sur les paiements, la caisse
et la restitution : ceux-là attendent la confirmation du serveur.

## Accessibilité

- HTML sémantique d'abord : `<button>` pour une action, `<a>` pour naviguer.
  Un `<div>` cliquable est un bug.
- Tout est atteignable au clavier, avec un focus **visible**.
- Libellé sur chaque champ. `aria-live="polite"` pour les messages dynamiques.
- Contraste AA minimum, vérifié dans les deux thèmes.
- Jamais la couleur comme seul porteur d'information.

## Interdits

`any` · `document.querySelector` pour manipuler le DOM d'un composant ·
`setTimeout` pour contourner un problème de détection de changement · logique
métier dans un template · abonnement RxJS sans désabonnement · `select('*')`
depuis un composant · secret ou clé dans le code frontend.
