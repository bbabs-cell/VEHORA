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
- Rayons : `--vh-radius-control` (6), `--vh-radius-card` (10), `--vh-radius-modal` (16).
- Cibles tactiles : **44px minimum**, 56px (`--vh-touch-primary`) pour les
  actions opérationnelles primaires, placées en bas d'écran sur mobile.
- Texte : 16px de base, **jamais en dessous de 14px** pour une donnée métier.
- Profondeur : surface + bordure d'abord, ombre ensuite. Pas de glassmorphism
  sur les listes opérationnelles (coût GPU sur Android d'entrée de gamme).

## Mouvement

150–300 ms (`--vh-duration-*`), `ease-out`. Skeleton au-delà de 300 ms de
chargement. Retour visuel en moins de 100 ms sur toute action, même si la
requête est lente. `prefers-reduced-motion` déjà géré par les tokens.

## Interdits

Fond majoritairement blanc · dashboard clinique · couleurs criardes ·
empilement de cartes · glassmorphism généralisé · néomorphisme · animation
décorative sur un écran opérationnel · icône sans libellé sur une action
destructive.

## Vérification avant de dire qu'un écran est terminé

- [ ] aucun `#hex` hors `_tokens.css`
- [ ] lisible en thème clair **et** sombre
- [ ] aucune cible tactile sous 44px
- [ ] statuts distinguables sans la couleur
- [ ] aucun texte métier sous 14px
- [ ] correct à 360px de large
