# Phase 25 — Palette de repères : plus de couleur

Demande du propriétaire : « rajouter un peu de couleur pour avoir quelque chose
de plus visuel ». Aucune migration, aucune règle serveur modifiée.

## Le constat

Captures à 375 et 1280 px, avant toute modification : hors des états et de
l'argent, **tout était azur**. Menu, raccourcis du tableau de bord, en-têtes,
tuiles — les six tuiles d'étape (« Arrivé », « Inspection »…) étaient même
grises, identiques, alors que la file d'attente colore déjà chaque étape par
son rail. Deux liens du tableau de bord prenaient le bleu-violet du navigateur :
aucune règle ne colorait un lien.

Deux écarts aux règles du système, trouvés en passant :

| Écart                         | Règle contredite                                   |
| ----------------------------- | -------------------------------------------------- |
| Inspection et travail en azur | « les couleurs d'état sont séparées de la marque » |
| Contrôle en laiton            | « le laiton ne sert qu'à l'argent »                |

## Ce qui a été fait

- **Trois teintes de repère** — indigo, violet, rose —, loin du vert, de l'ambre
  et du rouge des états. Deux rôles chacune, comme l'azur : la teinte du thème
  (≥ 4,5:1, redéfinie en clair) et la teinte « vif », fixe, pour la navigation
  toujours sombre.
- **Une teinte par domaine** (`navigation.ts`) : pilotage azur, atelier indigo,
  travail violet, personnes rose, argent laiton. La directive `[vhTeinte]`
  (`shared/ui/teinte.ts`) pose `--vh-teinte` et `--vh-teinte-vif` ; la coquille
  la pose sur `<main>` selon l'écran affiché.
- **Navigation** : icônes du menu dans leur teinte ; entrée active avec rail,
  pastille et point dans la teinte. Barre basse : l'entrée active dans la
  sienne, sur une pastille. Feuille « Plus » : chaque icône sur un rond teinté.
- **En-tête de page** : une pastille à l'icône de la section devant le titre,
  et le point final dans la teinte. Rien à déclarer par page :
  `SECTION_COURANTE` vient de la coquille. L'espace plateforme, qui a sa propre
  coquille, garde son en-tête sans pastille.
- **Étapes** : chacune sa couleur (inspection indigo, en cours violet, contrôle
  rose). `TEINTE_STATUT` est la seule correspondance statut → jeton ; la file
  et le tableau de bord la lisent. Dans la file, l'en-tête de chaque étape
  prend un point et un voile sous son compteur.
- **Tableau de bord** : tuiles d'étape dans leur couleur (point, chiffre, rail,
  voile à 10 %), « Encaissé » en laiton, « Restitués » en vert, raccourcis dans
  la teinte de leur section, bandeau d'accueil en aurore azur-violet-rose.
- **Fond vivant** : halos azur, violet, rose, indigo — en **dégradés radiaux**
  au lieu de disques passés dans `filter: blur(64px)`. Même halo à l'œil, sans
  le filtre le plus cher qu'un téléphone ait à composer pendant un défilement.
- **Liens** : la marque en trait (`a { color: var(--vh-primary-bright) }`).

## Le poids

Le bundle initial était à 150 octets de son seuil d'alerte. Les jetons ont été
payés en retirant ce que rien n'employait : cinq variantes de `.vh-pastille`,
`.vh-etiquette--ok`, `--vh-vivant-rgb`. Résultat : **499,69 Ko** (seuil
500 Ko), 310 octets de marge — le double d'avant. La feuille de la file a
dépassé son budget de 87 octets avec six règles `[data-statut]` : elles sont
remplacées par `TEINTE_STATUT`, lue par le gabarit.

## Validation

| Contrôle                                                  | Résultat                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run types:check` + `tsc -p tsconfig.spec.json`       | vert                                                                                                              |
| `npm run test:unit`                                       | vert — 94 jetons employés, tous déclarés, aucune couleur en dur                                                   |
| `npm run test:contraste`                                  | vert — **92 paires** (56 avant), deux thèmes                                                                      |
| `npm run build`                                           | vert, aucun avertissement — initial 499,69 Ko                                                                     |
| `npm run test:csp`                                        | vert                                                                                                              |
| `npm run audit:mobile` à 320, 375 et 1280 px, deux thèmes | vert, tous profils                                                                                                |
| Captures regardées                                        | tableau de bord (320, 375, 1280, deux thèmes), file, caisse, feuille « Plus » et tiroir (deux thèmes), plateforme |
| `npm run validate:sql`                                    | non rejoué : aucun fichier SQL touché                                                                             |
| `npm run e2e`                                             | non joué : les secrets `VEHORA_TEST_*` ne sont pas dans cette session                                             |

Les sélecteurs lus par la suite de parcours sont inchangés ; `data-statut`
reste sur chaque dossier de la file.
