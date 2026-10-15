---
name: VEHORA
description: Gestion opérationnelle des centres de lavage et de detailing — file d'attente, travaux, caisse, sur un téléphone, dehors.
colors:
  azur: "#0b86ad"
  azur-vif: "#2cc4e8"
  azur-sourd: "#0a2a35"
  laiton: "#c89a3c"
  laiton-sourd: "#30250f"
  fond: "#0a1016"
  surface-1: "#111a22"
  surface-2: "#17242e"
  surface-3: "#1f303c"
  filet: "#273945"
  encre: "#f1f6f8"
  encre-attenuee: "#93a8b4"
  encre-pale: "#6b808d"
  etat-ok: "#1f9d5f"
  etat-ok-sourd: "#0c2a1c"
  etat-attente: "#c07c12"
  etat-attente-sourd: "#2e220b"
  etat-mauvais: "#d04545"
  etat-mauvais-sourd: "#331517"
  nav: "#070d13"
  nav-releve: "#12202a"
  nav-encre: "#eef5f8"
  nav-attenue: "#93a8b4"
  nav-accent: "#2cc4e8"
  vivant-clair: "#7fdcf2"
  vivant: "#2cc4e8"
  vivant-profond: "#0b86ad"
  indigo: "#8f98ff"
typography:
  display:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline: { fontFamily: "Manrope Variable", fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.25 }
  title:    { fontFamily: "Manrope Variable", fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4 }
  body:     { fontFamily: "Manrope Variable", fontSize: "1rem", fontWeight: 400, lineHeight: 1.55 }
  label:    { fontFamily: "Manrope Variable", fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.04em" }
  chiffre:  { fontFamily: "Manrope Variable", fontWeight: 700, fontVariantNumeric: "tabular-nums" }
rounded:
  control: "0.625rem"
  card: "0.875rem"
  modal: "1.125rem"
  pill: "9999px"
---

# Design System : VEHORA

## Vue d'ensemble

**Étoile du Nord : « Le reflet »**

Une carrosserie propre renvoie la lumière. C'est le seul résultat que ce
produit sert à produire, et c'est le registre de son interface : un atelier
sombre — l'heure où l'on ouvre et l'heure où l'on ferme —, des surfaces d'un
bleu d'encre tiède, et **une seule chose qui brille**, l'eau et le chrome.

L'écran est tenu d'une main, dehors, sur un Android d'entrée de gamme dont la
dalle prend le soleil. Le sombre n'est donc pas une mode : c'est le thème par
défaut assumé, et le clair est son égal obligatoire, pas une variante.

Ce que ce système refuse : **le tableau de bord d'analyste** — gris froid,
dense, bleu Tailwind par défaut, conçu pour être regardé assis. Un chef de
station qui ouvre VEHORA cherche une réponse en trois secondes : où en est la
voiture, qui travaille dessus, combien reste à encaisser.

**Caractéristiques :**

- Un fond bleu-encre **tiède**, jamais le gris ardoise froid d'un cadre de
  bibliothèque.
- Un seul azur d'action par écran ; le laiton ne sert qu'à l'argent.
- Les couleurs d'état sont séparées de la marque : un dossier en retard n'est
  jamais « de la couleur de VEHORA ».
- Les chiffres s'alignent, toujours.

## Couleurs

### Marque

- **Azur** (`#0b86ad`) : le fond de l'action principale d'un écran, et rien
  d'autre. Assez profond pour porter du texte blanc en contraste AA — un azur
  clair y aurait échoué, et c'est la raison de cette valeur.
- **Azur vif** (`#2cc4e8`) : la même marque, mais en **trait** — icône active,
  lien, chiffre mis en avant, contour de champ au focus. Sur le fond sombre il
  monte à plus de 8:1 ; sur un bouton il serait illisible. Deux rôles, deux
  valeurs : un seul ton n'aurait pu faire les deux.
- **Azur sourd** (`#0a2a35`) : fond des pastilles de marque, zone d'appel
  discrète.

### L'argent

- **Laiton** (`#c89a3c`) : réservé aux montants, à la caisse et aux reçus.
  C'est la seule couleur qui parle d'argent, et elle ne sert jamais à autre
  chose. Un total doit se repérer sans être lu.

### Neutres

- **Fond** (`#0a1016`) : l'atelier. Bleu très sombre, légèrement tiède.
- **Surface 1 / 2 / 3** (`#111a22`, `#17242e`, `#1f303c`) : trois niveaux, pas
  quatre. Carte, carte survolée ou entête, encart à l'intérieur d'une carte.
- **Filet** (`#273945`) : bordures d'un pixel.
- **Encre** (`#f1f6f8`) : le texte. Jamais du blanc pur sur fond sombre — il
  vibre.
- **Encre atténuée** (`#93a8b4`) : intitulés, texte secondaire. Contraste ≥ 4,5
  sur toutes les surfaces, vérifié.
- **Encre pâle** (`#6b808d`) : texte d'invite et désactivé **seulement**. Jamais
  une donnée métier.

### Navigation et lumière (phase 24)

- **Navigation** (`#070d13`, relevé `#12202a`) : la barre latérale, le tiroir,
  le bandeau d'accueil du tableau de bord et le bandeau de la plateforme sont
  **sombres dans les deux thèmes**, comme ceux de MagyaPro. En clair, l'aplat
  sépare l'outil du contenu ; en sombre, il descend d'un cran sous le fond. Ses
  jetons sont fixes, avec leur propre accent (`--vh-nav-accent`) : le trait de
  marque du thème clair y serait illisible.
- **Lumière** (`--vh-vivant*`) : les azurs sans texte posé dessus — halos du
  fond vivant, contour animé d'une carte, point final des titres. Ils peuvent
  être clairs : aucun libellé n'en dépend.
- **Dégradé du bouton principal** (`--vh-degrade-primaire`) : trois azurs
  profonds, chaque arrêt au-dessus de 4,5:1 avec du blanc.

### Couleurs d'étape (phase 25)

Demande du propriétaire : « plus visuel », puis, au vu du résultat, « trop de
couleurs — des couleurs cohérentes et utiles ». Un premier essai donnait une
teinte à chaque section du menu (indigo, violet, rose, laiton) : icônes,
raccourcis, en-têtes, halos. Retiré : cinq couleurs qui ne disaient rien de
plus que le libellé posé à côté d'elles.

Ce qui reste est la couleur qui **informe** :

- **Indigo** (`#8f98ff` en sombre, `#4a50c4` en clair) : une seule couleur
  ajoutée, pour une seule information — le véhicule est entre les mains de
  l'équipe (inspection, travail, contrôle).
- **Les étapes du dossier** disent QUI doit agir, pas laquelle — son nom est
  écrit à côté : gris, personne n'a commencé (arrivé) ; indigo, l'équipe s'en
  occupe ; ambre, ça attend quelqu'un ; vert, prêt à partir et à encaisser.
  Les mêmes couleurs partout : rail des dossiers et en-tête d'étape dans la
  file, point et rail des tuiles du tableau de bord (`TEINTE_STATUT`).
- Avant, l'inspection et le travail étaient en azur — la marque disait un
  état — et le contrôle en laiton, une couleur d'argent sur une étape sans
  argent. Les deux écarts sont fermés.
- La marque reste l'azur, seule, partout ailleurs : menu, entrée active,
  pastille d'en-tête, raccourcis.

### Règles nommées

**La règle de la couleur utile.** Une couleur ajoutée doit dire quelque chose
que le texte voisin ne dit pas déjà, et dire la même chose sur chaque écran.
Une couleur par section, par carte ou par raccourci n'est pas une information :
c'est du bruit, et il rend les vraies couleurs (un état, un montant) plus
difficiles à voir.

**La règle de l'azur unique.** Un seul élément à fond azur par écran : l'action
principale. Deux boutons pleins n'attirent pas deux fois l'attention, ils
s'annulent. Ce qui est propre à une ligne de liste — l'étape suivante d'un
dossier, « Démarrer » une opération — prend la marque **en trait**
(`.vh-button--trait`) : il se distingue des actions neutres sans concurrencer
l'action de l'écran. `npm run audit:mobile` échoue au deuxième bouton plein.

**La règle du laiton réservé.** Le laiton dit « argent ». L'employer pour un
avertissement le vide de son sens, et l'ambre d'alerte existe pour ça.

**La règle de l'état qui ne décore pas.** Vert, ambre et rouge disent un fait
vérifiable — prêt, en attente, annulé. Un écran où tout est coloré est un écran
où plus rien n'est signalé.

**La règle du fond tiède.** Aucune surface en gris neutre. Le bleu d'encre
coûte le même pixel et distingue l'atelier du tableur.

## Typographie

**Famille : Manrope Variable**, auto-hébergée (`@fontsource-variable/manrope`),
sous-ensemble latin, `font-display: swap`.

Cette ligne remplace une déclaration qui mentait : `--vh-font` nommait `Inter`
en tête de pile depuis la phase 2, et Inter n'a jamais été servie — le produit
s'affichait dans la police système de l'appareil, différente sur chaque
téléphone. **Une famille nommée ici est une famille réellement chargée.**

Le coût est réel : environ 25 Ko au premier chargement, puis rien, et le texte
reste lisible pendant l'attente grâce à `swap`. La CSP n'autorise que
`font-src 'self'` : aucun appel vers un fournisseur tiers n'est possible, et
c'est voulu.

### Hiérarchie

- **Display** (700, 1,5 → 2,25 rem) : le titre de page, lui seul.
- **Headline** (600, 1,25 rem) : titre de section dans une page.
- **Title** (600, 0,9375 rem) : intitulé de carte, entrée de navigation.
- **Body** (400, 1 rem, interligne 1,55) : le texte courant. 16 px : en dessous,
  iOS zoome sur les champs et la lecture au soleil souffre.
- **Label** (600, 0,8125 rem, interlettrage 0,04em, capitales) : intitulés de
  statistiques et de cellules sur mobile. **Jamais sous 13 px.**
- **Chiffre** : `tabular-nums` et graisse 700.

### Règles nommées

**La règle des chiffres alignés.** Tout nombre lu en colonne porte
`tabular-nums`. Deux totaux qui ne s'alignent pas se comparent mal.

**La règle du plancher à 14 px.** Aucune donnée métier sous 14 px — montant,
immatriculation, nom, statut. Le micro-texte appartient aux écrans de bureau
des produits qu'on lit assis.

## Mise en page

Deux colonnes sur ordinateur : barre latérale fixe, contenu plafonné. Sous
1024 px, la barre devient un tiroir ; sous 768 px, **tout tableau devient une
liste de fiches**, chaque cellule reprenant son intitulé.

Rythme : 16 px dans une carte, 24 px entre deux blocs, 48 px entre deux
sections. Toute mesure partagée par deux composants devient un token —
`--vh-nav-basse` existe parce que la hauteur de la barre basse avait été
recopiée à deux endroits avec deux valeurs.

L'action opérationnelle principale est **en bas de l'écran** sur mobile, à
56 px de haut : c'est là qu'arrive le pouce d'une main qui tient aussi un
jet d'eau.

## Profondeur

Surface, filet, puis ombre — dans cet ordre. Une carte se détache par son fond
et son filet ; l'ombre ne fait que la décoller.

Deux couches par ombre : un contact proche et net, une diffusion large et
douce. Les ombres sont teintées d'encre bleue (`rgb(4 10 16 / …)`), jamais de
noir pur.

Pas de glassmorphism sur une liste opérationnelle : le flou coûte cher au GPU
d'un téléphone à 60 000 F CFA, et c'est précisément l'appareil visé.

## Mouvement

Vocabulaire du skill **« animations vivantes »** d'Atelier Flow
(`.claude/skills/animations-vivantes/`), porté en CSS pur dans
`src/styles/_animations.css`. Une interface **vivante mais calme** : ce qui
apparaît glisse, ce qui se touche répond, le fond respire lentement, et rien ne
gêne la lecture ni la saisie.

- **Ce qui arrive glisse** : titre de page en fondu-montée, cartes qui
  s'ouvrent (`scale-in`), listes en cascade (50 ms par élément, plafonnée à
  0,42 s). L'écran entier n'entre qu'en **fondu d'opacité** : une
  transformation sur le conteneur capturerait la barre fixée de l'inspection.
- **Ce qui se touche répond** : bouton qui se soulève de 2 px et se comprime à
  97 % ; reflet qui balaie le bouton principal ; carte cliquable qui se soulève
  de 4 px, contour qui s'allume, icône qui pivote, flèche en diagonale ; entrée
  de menu qui glisse à droite ; croix qui fait un quart de tour.
- **Ce qui change rebondit une fois** : compteurs de groupe, icône de la barre
  basse — la valeur sert de clé.
- **Ce qui est refusé tremble une fois** : le bandeau d'erreur fait un
  va-et-vient horizontal (le « wiggle » du skill, adapté à un bloc).
- **Le fond respire** : halos flous derrière le contenu et dans la navigation,
  trame de points. Décor pur : `aria-hidden`, sous des cartes opaques.
- **Les chiffres défilent** sur le tableau de bord seulement, et finissent
  exactement sur leur valeur.
- **Le titre porte un point final en dégradé animé** (`page-title`), décoratif
  pour les lecteurs d'écran.
- **Ce qui attend scintille** : squelette aux dimensions du contenu final.

Durées : survol 0,2 s, ouverture 0,3 s, entrée 0,45–0,5 s, décor 6–28 s.
Courbe d'entrée `cubic-bezier(0.22, 1, 0.36, 1)`, rebond réservé aux pastilles.

### Règles nommées

**La règle du `backwards`.** Une entrée n'est jamais en `animation-fill-mode:
both` : une transformation restée appliquée capture les `position: fixed`
descendants (méthode MagyaPro — sur MagyaPro, des barres fixées disparaissaient).

**La règle de l'œil unique.** Une seule chose qui attire l'œil par écran. Pas
d'animation continue sur un texte à lire, sauf le point final du titre et le
bandeau défilant.

**La règle du montant immobile.** Un montant ne défile jamais sur un document
(reçu, export, impression) ni sur l'écran de caisse : un chiffre qui bouge sur
ce qu'on remet au client est un chiffre faux pendant une seconde.

**La règle de la présentation.** La méthode l'autorise : « les pages de
présentation peuvent faire plus, une fois ». Connexion, compte sans entreprise
et création d'entreprise ont la scène complète (`vh-scene`) : fond vivant,
carte qui s'ouvre, champs en cascade, marque et mot clé en dégradé, 👋 qui
s'agite une fois.

**La règle du mouvement réduit.** `prefers-reduced-motion` coupe les durées
**et les délais** — une entrée retardée dont on n'annule que la durée laisse du
contenu invisible —, fige les halos et retire le bandeau défilant, dont chaque
chiffre reste lisible dans sa tuile.

## Composants

### Boutons

- Hauteur 44 px, **56 px** pour l'action opérationnelle primaire. Rayon
  0,625 rem.
- **Primaire** : dégradé d'azurs profonds, texte blanc, halo azur en deux
  couches, reflet qui balaie au survol. Au survol le dégradé glisse vers sa
  moitié claire : la luminosité monte, la teinte ne change pas. Un seul par
  écran.
- **Trait** : la marque en contour (azur vif, fond transparent). L'action
  propre à une ligne de liste.
- **Secondaire** : fond surface 2, filet, texte encre.
- **Discret** : texte atténué, fond au survol seulement.
- **Danger** : rouge franc, réservé à l'irréversible, et jamais une icône seule.
- Un libellé ne se casse jamais lettre par lettre : la **rangée** passe à la
  ligne (`vh-actions`), pas le bouton. Dans un formulaire sur téléphone, les
  boutons prennent toute la largeur et l'action principale finit en bas.

### Pastilles de statut

Entièrement arrondies, fond sourd de l'état, texte dans la teinte pleine,
**et une forme** — point, icône ou libellé. Jamais la couleur seule : le
daltonisme et une dalle bon marché en plein jour emportent la nuance.

### Cartes

Surface 1 sur le fond, filet d'un pixel, rayon 0,875 rem, 16 px de marge
intérieure. Pas de carte dans une carte : un encart en surface 3 suffit.

### Le rail d'état

Signature du système : une barre de 3 px au bord gauche d'une carte, colorée
selon le statut. Une file de vingt véhicules se balaie sans lire un mot.
Appliquée en phase 24 à la file d'attente, aux opérations (à faire, en cours,
terminée) et à la session de caisse ouverte — elle était documentée ici depuis
la phase de l'identité, et utilisée nulle part. En phase 25, l'en-tête de
chaque étape de la file reprend la couleur (un point, un voile sous le
compteur), et les tuiles d'étape du tableau de bord aussi (un point, le
rail) — le chiffre, lui, reste à l'encre du texte.

### La barre basse

Quatre écrans **choisis selon les droits** de la personne (accueil, file,
travaux, caisse, clients, véhicules — dans cet ordre), puis « **Plus** », qui
ouvre une feuille posée au-dessus de la barre avec tout le reste. Libellés à
13 px, le plancher ; l'écran courant en trait de marque, sur une pastille
azur sourd, avec une barre qui pousse au-dessus de l'icône.

### Champs

Fond surface 2, filet, rayon 0,625 rem, texte 16 px. Au focus : filet azur vif
et anneau d'un pixel. Un champ en erreur porte son message **sous lui**, en
toutes lettres, jamais un simple contour rouge.

## À faire / à ne pas faire

**À faire** — réserver l'azur plein à une action par écran · teinter les ombres
de bleu · aligner les nombres · donner son intitulé à chaque cellule sous
768 px · écrire une échéance en toutes lettres (« il y a 3 jours ») plutôt
qu'une date à décompter.

**À ne pas faire** — poser du gris neutre froid · colorer une carte avec la
couleur de marque pour dire un état · empiler une carte dans une carte ·
descendre une donnée métier sous 14 px · animer en continu un texte à lire ·
faire défiler un montant sur un document ou à la caisse · employer le laiton
ailleurs que sur de l'argent · écrire du texte avec un jeton de fond
(`--vh-error`, `--vh-primary`) · afficher une réussite dans le bandeau rouge.
