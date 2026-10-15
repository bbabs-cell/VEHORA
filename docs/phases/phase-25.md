# Phase 25 — Couleur utile

Demande du propriétaire : « rajouter un peu de couleur pour avoir quelque chose
de plus visuel ». Puis, au vu d'un premier essai : « il y a beaucoup trop de
couleurs. Je veux des couleurs cohérentes et utiles, pas une couleur différente
partout ». Aucune migration, aucune règle serveur modifiée.

## Le constat

Captures à 375 et 1280 px, avant toute modification : hors des états et de
l'argent, tout était azur, et les six tuiles d'étape du tableau de bord
(« Arrivé », « Inspection »…) étaient grises et identiques — alors que la file
d'attente colore déjà chaque dossier par son rail. Deux liens du tableau de
bord prenaient le bleu-violet du navigateur : aucune règle ne colorait un lien.

Deux écarts aux règles du système :

| Écart                         | Règle contredite                                   |
| ----------------------------- | -------------------------------------------------- |
| Inspection et travail en azur | « les couleurs d'état sont séparées de la marque » |
| Contrôle en laiton            | « le laiton ne sert qu'à l'argent »                |

## Le premier essai, retiré

Une teinte par section du menu — indigo, violet, rose, laiton — sur les icônes
du menu, la barre basse, la feuille « Plus », la pastille d'en-tête, les
raccourcis, les tuiles, et des halos multicolores. Le propriétaire l'a jugé
trop chargé, avec raison : ces cinq couleurs ne disaient rien de plus que le
libellé posé à côté d'elles, et elles noyaient les couleurs qui informent (un
état, un montant). Commit 7ef57e9, défait par le suivant.

## Ce qui reste

La règle : **une couleur ajoutée dit quelque chose que le texte voisin ne dit
pas, et la même chose sur chaque écran.**

- **Une seule couleur ajoutée, l'indigo** : le véhicule est entre les mains de
  l'équipe (inspection, en cours, contrôle).
- **Les étapes disent qui doit agir** : gris, personne n'a commencé ; indigo,
  l'équipe s'en occupe ; ambre, ça attend quelqu'un ; vert, prêt à partir et à
  encaisser. `TEINTE_STATUT` (`service-order.service.ts`) est la seule
  correspondance statut → jeton : rail des dossiers et en-tête d'étape dans la
  file (un point, un voile sous le compteur), point et rail des tuiles d'étape
  du tableau de bord. Le chiffre reste à l'encre du texte.
- **Le reste est azur, la marque** : menu, entrée active (sur une pastille dans
  la barre basse), pastille à l'icône de la section devant chaque titre
  (`SECTION_COURANTE`, fournie par la coquille), raccourcis.
- **Laiton** : « Encaissé », comme tout montant.
- **Liens** : la marque en trait (`a { color: var(--vh-primary-bright) }`).
- **Fond vivant** : toujours azur, mais en **dégradés radiaux** au lieu de
  disques passés dans `filter: blur(64px)` — même halo à l'œil, sans le filtre
  le plus cher qu'un téléphone ait à composer pendant un défilement. De même
  pour le halo des raccourcis.

## Le poids

Le bundle initial était à 150 octets de son seuil d'alerte. Retirés : cinq
variantes de `.vh-pastille` et `.vh-etiquette--ok`, que rien n'employait, et
`--vh-vivant-rgb`. Résultat : **499,44 Ko** (seuil 500 Ko). La feuille de la
file a perdu ses six règles `[data-statut]` au profit de `TEINTE_STATUT`.

## Validation

| Contrôle                                                  | Résultat                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run types:check` + `tsc -p tsconfig.spec.json`       | vert                                                                                      |
| `npm run test:unit`                                       | vert — 86 jetons employés, tous déclarés, aucune couleur en dur                           |
| `npm run test:contraste`                                  | vert — 62 paires (56 avant : l'indigo sur le fond et les deux surfaces)                   |
| `npm run build`                                           | vert, aucun avertissement — initial 499,44 Ko                                             |
| `npm run test:csp`                                        | vert                                                                                      |
| `npm run audit:mobile` à 320, 375 et 1280 px, deux thèmes | vert, tous profils                                                                        |
| Captures regardées                                        | tableau de bord (375, 1280), file (deux thèmes), feuille « Plus » et tiroir (deux thèmes) |
| `npm run validate:sql`                                    | non rejoué : aucun fichier SQL touché                                                     |
| `npm run e2e`                                             | non joué : les secrets `VEHORA_TEST_*` ne sont pas dans cette session                     |

Les sélecteurs lus par la suite de parcours sont inchangés ; `data-statut`
reste sur chaque dossier de la file.
