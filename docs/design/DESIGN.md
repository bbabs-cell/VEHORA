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

### Règles nommées

**La règle de l'azur unique.** Un seul élément à fond azur par écran : l'action
principale. Deux boutons pleins n'attirent pas deux fois l'attention, ils
s'annulent.

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

Vocabulaire repris du skill **« animations vivantes »** des dépôts
`ATELIERFLOW` et `MagyaPro`, avec la même retenue que MagyaPro applique à ses
tableaux de bord : **vivant, mais calme**.

- **Ce qui arrive glisse** : entrée de page en fondu-montée de 12 px, 300 ms.
- **Ce qui se touche répond** : bouton qui se soulève d'un demi-cran au survol
  et se comprime à 97 % à l'appui ; retour visible en moins de 100 ms, même si
  le serveur met une seconde.
- **Ce qui change rebondit une fois** : une pastille de compteur, un total de
  caisse — la valeur en `key`, jamais en boucle.
- **Ce qui attend scintille** : squelette aux dimensions du contenu final
  au-delà de 300 ms.
- **Les listes entrent en cascade** : 50 ms par élément, plafonné à 300 ms.

### Règles nommées

**La règle du calme opérationnel.** Aucune animation décorative sur un écran de
travail : pas de forme qui dérive en fond, pas de contour en dégradé, pas de
boucle. La file d'attente et la caisse sont consultées cent fois par jour.

**La règle du mouvement réduit.** `prefers-reduced-motion` coupe les durées
**et les délais**. Une entrée retardée dont on n'annule que la durée laisse du
contenu invisible — c'est un contenu perdu, pas une animation économisée.

## Composants

### Boutons

- Hauteur 44 px, **56 px** pour l'action opérationnelle primaire. Rayon
  0,625 rem.
- **Primaire** : fond azur, texte blanc, halo azur à 25 %. Au survol la
  luminosité monte ; la teinte ne change pas — la couleur s'active, elle ne
  devient pas une autre couleur.
- **Secondaire** : fond surface 2, filet, texte encre.
- **Fantôme** : texte atténué, fond au survol seulement.
- **Danger** : rouge franc, réservé à l'irréversible, et jamais une icône seule.

### Pastilles de statut

Entièrement arrondies, fond sourd de l'état, texte dans la teinte pleine,
**et une forme** — point, icône ou libellé. Jamais la couleur seule : le
daltonisme et une dalle bon marché en plein jour emportent la nuance.

### Cartes

Surface 1 sur le fond, filet d'un pixel, rayon 0,875 rem, 16 px de marge
intérieure. Pas de carte dans une carte : un encart en surface 3 suffit.

### Le rail d'état

Signature du système : une barre de 3 px collée au bord gauche d'une carte de
dossier, colorée selon le statut. Une file de vingt véhicules se balaie sans
lire un mot.

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
descendre une donnée métier sous 14 px · animer quoi que ce soit en continu sur
un écran opérationnel · employer le laiton ailleurs que sur de l'argent.
