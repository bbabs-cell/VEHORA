# Phase 15 — Dette d'interface

Aucune fonctionnalité nouvelle. Trois défauts de fond accumulés depuis la phase
4, que les phases suivantes ont contournés au lieu de traiter.

## `window.confirm()` et `window.prompt()` n'ont rien à faire ici

Quatre écrans demandaient confirmation par une boîte native, et le motif d'un
**remboursement** passait par `window.prompt()`. Une boîte native pose quatre
problèmes, dans cet ordre de gravité :

1. **Aucune assertion ne peut la lire.** Quatre confirmations n'étaient donc
   vérifiées par aucun test : les parcours les acceptaient d'un
   `page.once('dialog', d => d.accept())`, ce qui ne prouve rien du texte ni de
   ce que le bouton annonce.
2. **Elle bloque le fil d'exécution** du navigateur — sur un Android d'entrée de
   gamme, l'écran gèle le temps de la décision.
3. **Elle n'est ni dans le thème ni dans la langue du produit** : le libellé des
   boutons vient du système, souvent en anglais.
4. **Elle ne dit pas ce qu'elle fait** : « OK » n'annonce rien. Le bouton doit
   porter l'action — « Archiver », « Suspendre », « Rembourser ».

`shared/ui/confirmation.component.ts` remplace les quatre, et le remboursement a
désormais son formulaire, avec motif validé côté client **et** côté serveur. Le
verrou de défilement est posé par le composant lui-même : l'appelant n'a rien à
gérer, ce qui était la source des oublis précédents.

## Une modale décrite dix fois avait déjà divergé

Les styles de modale (`.modale`, `.modale__contenu`, `.modale__entete`,
`.modale__titre`, `.modale__fermer`, `.modale__actions`, et la bascule
`@media (min-width: 640px)`) étaient recopiés dans **dix** feuilles de
composant. Recopiés, donc divergents :

- la croix tenait sa largeur (`flex: 0 0 auto`) dans six fichiers sur dix ;
- le titre se coupait proprement (`overflow-wrap`) dans cinq ;
- les actions passaient à la ligne dans **un seul**.

C'est la même leçon que la hauteur de la barre basse en phase 7 : **ce qui sert
à plus d'un composant vit en un seul endroit**. Les définitions sont remontées
dans `src/styles/_base.css`, en gardant la variante la plus complète — 1 499
lignes supprimées, 87 ajoutées. Les écarts réels (une modale en colonne, un
texte d'accompagnement) restent dans la feuille du composant concerné.

Effet de bord bienvenu : `file-attente.component.css` repasse **sous le budget**
(7,53 Ko pour 6 Ko d'avertissement, plafond d'erreur à 10 Ko). Le budget était
dépassé depuis la phase 11, et s'approchait du seuil qui casse le build.

## Vérification

- **225 tests Playwright** (219 avant la phase). Les quatre parcours qui
  acceptaient une boîte native lisent maintenant le texte de la confirmation et
  cliquent un bouton nommé.
- **Trois tests nouveaux** : ce qu'une confirmation doit dire (la conséquence,
  pas « Êtes-vous sûr »), le fait que la page ne défile pas derrière elle, et le
  motif de remboursement exigé dans un formulaire.
- **Captures mobile et bureau** de la confirmation.
- Build : budgets respectés, bundle initial 120,40 Ko compressé.

## Ce que la validation a appris

Le test du remboursement, écrit dans son propre fichier, tombait en suite
complète et passait seul : il ouvre une caisse, ressource unique par
(station, utilisateur), pendant que `caisse.spec.ts` en ouvrait une aussi.
`test.describe.configure({ mode: 'serial' })` ne sérialise qu'**à l'intérieur
d'un fichier**. Le test a donc rejoint `caisse.spec.ts`, avec les autres tests
qui se partagent le tiroir.

**Règle** : un test qui prend une ressource unique appartient au fichier qui la
possède déjà. Un fichier de plus, c'est un parallélisme de plus.
