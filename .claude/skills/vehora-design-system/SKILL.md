---
name: vehora-design-system
description: Règles visuelles de VEHORA — palette dark-first, tokens, statuts, typographie, densité, composants. À charger avant d'écrire ou de modifier un composant Angular, une feuille de style, un écran ou un élément d'interface.
---

# Design System VEHORA

Référence complète : `docs/architecture/06-design-system.md`.
Ce skill en est la version applicable pendant l'écriture du code.

## Règle n°1

**Aucune couleur en dur.** Toujours `var(--vh-*)`, défini dans
`src/styles/_tokens.css`. Si un token manque, on l'ajoute au fichier — on
n'écrit jamais un `#hex` dans un composant.

## Palette

Fond `--vh-bg` · surfaces `--vh-surface-1/2/3` · primaire `--vh-primary`
· accent `--vh-accent` · succès/alerte/erreur `--vh-success` `--vh-warning`
`--vh-error` · texte `--vh-text` / `--vh-text-muted` · bordure `--vh-border`.

Dark-first, **jamais dark-only** : tout écran doit rester correct sous
`[data-theme="light"]`. Le mode clair n'est pas une option cosmétique, c'est
une exigence terrain (usage en plein soleil).

## Statuts de prestation

Couleur **+ forme** (point, icône, libellé). Jamais la couleur seule :
daltonisme et écrans de mauvaise qualité en plein jour.

ARRIVÉ `--vh-status-arrived` · INSPECTION `--vh-status-inspection` ·
EN ATTENTE `--vh-status-waiting` · EN COURS `--vh-status-in-progress` ·
CONTRÔLE `--vh-status-control` · PRÊT `--vh-status-ready` ·
RESTITUÉ `--vh-status-delivered` · ANNULÉ `--vh-status-cancelled`.

## Mesures

- Espacement : échelle 4px, `--vh-space-*`. Rien hors échelle.
- Rayons : `--vh-radius-control` (10), `--vh-radius-card` (14), `--vh-radius-modal` (18).
- Cibles tactiles : **44px minimum**, 56px (`--vh-touch-primary`) pour les
  actions opérationnelles primaires, placées en bas d'écran sur mobile.
- Texte : 16px de base, **jamais en dessous de 14px** pour une donnée métier.
- Profondeur : surface + bordure d'abord, ombre ensuite. Pas de glassmorphism
  sur les listes opérationnelles (coût GPU sur Android d'entrée de gamme).

## Boutons

**Un seul bouton à fond de marque par écran** (méthode MagyaPro, règle 1) :
`.vh-button`. L'action propre à une ligne de liste prend la marque en trait :
`.vh-button--trait`. Le reste : `--ghost` (secondaire), `--discret`,
`--danger`. L'audit mobile échoue au deuxième bouton plein.

## Mouvement

Skill **`animations-vivantes`** (Atelier Flow), porté dans
`src/styles/_animations.css` avec le préfixe `vh-`. Le charger pour tout
travail d'animation. Résumé applicable :

- entrées en `animation-fill-mode: backwards`, **jamais `both`** ; l'écran
  entier n'entre qu'en fondu d'opacité (une transformation capturerait les
  barres fixées) ;
- `transform` et `opacity` seulement ; survol 0,2 s, entrée 0,45–0,5 s ;
- une seule chose qui attire l'œil par écran ; aucune animation continue sur un
  texte à lire (sauf le point final du titre et le bandeau défilant) ;
- un montant ne défile jamais sur un document ni à la caisse ;
- décor (`vh-fond-vivant`, trames) : `aria-hidden`, sous des cartes opaques ;
- écrans de présentation (connexion, création) : scène complète `vh-scene` ;
- `prefers-reduced-motion` coupe durées ET délais (`_animations.css`).

Un effet du skill absent de `_animations.css` n'est pas interdit : il n'est
simplement employé nulle part. On le reprend du skill le jour où un écran en a
besoin — pas avant.

## Interdits

Fond majoritairement blanc · dashboard clinique · couleurs criardes ·
empilement de cartes · glassmorphism généralisé · néomorphisme · deux boutons
pleins sur un écran · jeton de fond (`--vh-error`, `--vh-primary`) employé en
texte · réussite affichée dans le bandeau rouge · icône sans libellé sur une
action destructive.

## Vérification avant de dire qu'un écran est terminé

- [ ] aucun `#hex` hors `_tokens.css`
- [ ] lisible en thème clair **et** sombre
- [ ] aucune cible tactile sous 44px
- [ ] statuts distinguables sans la couleur
- [ ] aucun texte métier sous 14px
- [ ] correct à 320 et 375 px de large : `npm run audit:mobile`, captures
      regardées
