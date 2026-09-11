---
name: vehora-ux
description: Règles d'expérience utilisateur VEHORA — parcours opérationnels, mobile-first, états de chargement/vide/erreur, formulaires, confirmations. À charger avant de concevoir un écran, un parcours, un formulaire ou une navigation.
---

# UX VEHORA

## Principe directeur

Les utilisateurs sont debout, dehors, une main occupée, parfois sous le
soleil, souvent pressés. **Une belle interface qui fait perdre du temps est une
mauvaise interface.**

Hiérarchie : CLARTÉ → RAPIDITÉ → FIABILITÉ → SÉCURITÉ → ÉVOLUTIVITÉ → ESTHÉTIQUE.

## Mobile-first, réellement

On conçoit à 360px puis on élargit. Jamais l'inverse.
L'action principale d'un écran opérationnel est atteignable au pouce, en bas.
Pas de survol comme unique porteur d'information : il n'existe pas au tactile.

## Coût en gestes

Compter les taps de chaque parcours fréquent et les réduire :

| Parcours | Cible |
|---|---|
| Client connu arrive, dossier ouvert | ≤ 5 taps |
| Démarrer une opération | 1 tap |
| Terminer une opération | 1 tap |
| Encaisser un paiement simple | ≤ 4 taps |
| Restituer | ≤ 3 taps |

Si un parcours fréquent dépasse la cible, le problème est la conception, pas
l'utilisateur.

## Saisie

- Client identifié par **téléphone** d'abord, pas par nom (les homonymes sont
  fréquents, l'orthographe varie).
- `inputmode="tel"` / `numeric` là où c'est pertinent : le clavier correct fait
  gagner plus de temps qu'une animation.
- Valeurs par défaut intelligentes : station courante, date du jour, dernier
  véhicule du client.
- Jamais de saisie libre quand une liste suffit.
- Un formulaire long est sauvegardé localement pendant la saisie (coupure réseau).

## Quatre états obligatoires

Tout écran affichant des données traite les quatre, sans exception :

1. **Chargement** — skeleton qui respecte la forme finale, pas un spinner centré.
2. **Vide** — explique quoi faire, avec l'action pour le faire. Jamais « Aucune donnée ».
3. **Erreur** — dit ce qui s'est passé, en français simple, avec un bouton Réessayer.
4. **Contenu**.

Un écran sans ces quatre états n'est pas terminé.

## Réseau instable

Retour optimiste **uniquement** sur les actions non financières. Un paiement ou
une restitution attend la confirmation serveur — afficher « payé » sans que ce
soit vrai est pire qu'une attente de 2 secondes.
Toute action rejouable est idempotente. Un échec réseau se dit clairement et
propose de réessayer, il ne disparaît jamais en silence.

## Confirmations

Confirmer uniquement ce qui est irréversible ou financier : annuler un dossier,
rembourser, clôturer une caisse, restituer avec un solde impayé, suspendre un
utilisateur. Une confirmation nomme la conséquence (« Restituer avec 5 000 FCFA
impayés ? »), jamais « Êtes-vous sûr ? ».

## Langue

Français, vouvoiement, phrases courtes. Vocabulaire du métier, pas
d'informatique : « prestation » et non « enregistrement », « véhicule prêt » et
non « statut READY ». Aucun message d'erreur technique visible par un
utilisateur.
