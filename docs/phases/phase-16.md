# Phase 16 — Tableau de bord chiffré

L'écran d'accueil annonçait encore, en toutes lettres :

> « Les véhicules en attente, en cours et prêts s'afficheront ici, avec le
> chiffre du jour, dès que la gestion des prestations sera disponible. »

Phrase écrite en phase 3, devenue fausse en phase 9. Le cycle complet tourne
depuis sept phases. **Un écran d'accueil qui décrit un produit qui n'est plus le
sien coûte plus qu'un écran vide** : il fait douter de tout le reste.

## Ce qu'il montre, et à qui

- **En ce moment** : les véhicules présents, puis le détail par étape de la
  file — arrivé, inspection, en attente, en cours, contrôle, prêt.
- **Un rappel d'encaissement** quand des véhicules prêts à partir portent
  encore un solde, avec le lien vers la file.
- **Aujourd'hui** : l'encaissé du jour et les véhicules restitués — mais
  seulement pour qui a `reports.read` **et** la fonctionnalité `rapports`
  ouverte par son plan. C'est la même double condition que l'écran Rapports,
  parce que c'est la même donnée : encaisser n'est pas savoir combien la
  station encaisse.
- **Actions rapides** vers les écrans réellement construits.

## Aucune requête nouvelle

Le tableau de bord ne lit rien de neuf : il réutilise la file d'attente et
`rapport_journalier(aujourd'hui, aujourd'hui)`, avec leurs permissions, leur RLS
et leur feature flag. Aucune migration, aucune fonction, aucune policy — donc
aucune surface d'attaque ajoutée, et le chiffre d'affaires reste refusé côté
serveur à qui n'y a pas droit, indépendamment de ce que l'écran affiche.

Deux conséquences de conception :

- la demande du rapport passe par un `effect`, pas par un test à la
  construction : la fonctionnalité arrive du réseau, et un test immédiat serait
  toujours faux ;
- l'écran ne demande le rapport que s'il sait que le serveur l'accordera — une
  requête qu'on sait refusée coûte un aller-retour et affiche une erreur sur la
  première page que voit l'utilisateur.

## Ce que la capture d'écran a corrigé

La première version montrait « Véhicules présents : 19 » au-dessus de quatre
tuiles (attente, en cours, contrôle, prêt) totalisant 2 : les dossiers en
*arrivé* et en *inspection* manquaient. **Un total dont le détail ne fait pas la
somme est un total qu'on relit trois fois avant de s'en méfier.** Les six
statuts de la file sont désormais affichés, dans l'ordre de la file.

C'est le vingt-cinquième défaut d'interface trouvé à l'œil et non par un test —
la raison pour laquelle capturer l'écran fait partie de la validation.

## Vérification

- **231 tests Playwright** (225 avant la phase), dont trois nouveaux : le compte
  des véhicules présents avec un dossier réellement créé pour l'occasion,
  la présence du chiffre du jour pour un propriétaire, et son **absence** pour
  un caissier.
- Captures mobile et bureau relues.
- Build : budgets respectés, bundle initial inchangé à 120,40 Ko compressé.
- Campagnes d'intrusion et validation SQL rejouées sans changement — cette phase
  ne touche pas à la base.
