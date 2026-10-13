# Refonte de l'interface — méthode MagyaPro et animations vivantes

Phase 24. Le propriétaire a demandé d'appliquer à VEHORA, à la lettre, la
**méthode MagyaPro** (skill `methode-magyapro`) et, pour le mouvement, le skill
**« animations vivantes »** d'Atelier Flow. Les deux skills sont désormais dans
le dépôt : `.claude/skills/methode-magyapro/` et
`.claude/skills/animations-vivantes/`, copiés tels quels.

La méthode le dit elle-même : *« sur un autre projet, reprends les principes et
adapte les noms ; ne copie pas un détail qui ne correspond à rien dans le
nouveau code »*. VEHORA est une SPA Angular sur Supabase, pas un Next.js sur
Prisma : `route()`, `requireX()` et `hit()` y ont leurs équivalents (RLS,
fonctions SQL, claims du JWT), et le correspondant de chaque règle est donné
plus bas.

## Le problème, vu de la station

- La **file d'attente** — l'écran le plus ouvert du produit — s'affichait en
  texte brut, puces de liste comprises, depuis la phase 15 : ses styles avaient
  été supprimés avec les styles de modale qu'on mutualisait. Même perte sur la
  caisse, le catalogue, les opérations et la liste des organisations. Aucun
  test ne le voyait : il a fallu une **capture à 375 px regardée**.
- Sur la file, chaque véhicule portait un bouton azur plein, en plus de
  « Nouveau dossier » : vingt boutons principaux, donc aucun.
- Sur un téléphone, tout ce qui n'était pas dans les quatre entrées figées de
  la barre basse passait par ☰ — deux gestes, des dizaines de fois par jour. Et
  un caissier n'y trouvait jamais la caisse.
- « Fiche enregistrée. » s'affichait dans le bandeau rouge des erreurs.
- Un utilisateur en thème clair voyait d'abord l'écran sombre, puis la bascule.

## Ce qui change, écran par écran

| Écran | Changement |
|---|---|
| **Coquille** | Barre latérale **sombre dans les deux thèmes** (trame de points, halos qui respirent, entrée en cascade, point actif qui pulse). Barre basse : **4 écrans choisis selon les droits** + « **Plus** » qui ouvre une feuille avec le reste. Seuil 1024 px. Barre de progression pendant le chargement d'un écran. Fond vivant derrière le contenu. |
| **Tableau de bord** | Bandeau d'accueil sombre : salut qui s'agite une fois, nombre de véhicules qui défile jusqu'à sa valeur, action « Ouvrir la file d'attente » avec reflet, bandeau défilant des chiffres du jour. KPI en 2 × 2 (4 colonnes ≥ 1024 px), montant en laiton qui défile. Raccourcis en cartes cliquables (soulèvement, contour animé, icône qui pivote, flèche en diagonale). Rôle et portée en français (« Propriétaire », pas « OWNER »). |
| **File d'attente** | Styles rétablis. Rail d'état coloré par statut (la signature de DESIGN.md, jamais appliquée ici). Étape suivante en bouton **trait** (contour azur) ; « Nouveau dossier » est le seul bouton plein. Compteurs de groupe qui rebondissent quand ils changent. |
| **Opérations** | Styles rétablis, rail par état (à faire / en cours / terminée), « Démarrer » et « Terminer » en trait. |
| **Caisse** | Styles rétablis. Solde théorique en grand, en laiton ; session marquée par une pastille et un rail vert ; mouvements en cascade, sorties en rouge. |
| **Catalogue** | Styles rétablis ; prix en laiton ; « sans tarif » en bandeau d'attention. |
| **Clients, véhicules, stations, utilisateurs, employés** | En-tête partagé, fiches et étiquettes partagées (six copies identiques supprimées). Le bouton d'un état vide passe en trait : l'en-tête porte déjà l'action principale. |
| **Paramètres** | Seul le formulaire **modifié** porte le bouton principal. Réussite en vert, échec en rouge. |
| **Inspection** | **Brouillon local** : un réseau qui coupe ou un onglet rechargé ne fait plus perdre dix zones constatées. Les photos ne survivent pas, et l'écran le dit. |
| **Reçu** | En-têtes de colonnes séparés (« QtéMontant »). À l'impression : 80 mm de large, le format d'une imprimante thermique. |
| **Plateforme** | Bandeau sombre avec trame, halos et liseré de marque ; organisations restylées ; « Réactiver » et « Marquer réglée » en trait. |
| **Connexion, sans entreprise, création** | Écrans de **présentation** : la méthode y autorise « plus, une fois ». Scène vivante (fond, trame), carte qui s'ouvre, champs en cascade, marque et mot clé en dégradé, 👋 qui s'agite une fois. |

## Les règles, et pourquoi

### Un seul bouton principal par écran (méthode, règle 1)

Le fond azur désigne *l'*action attendue. Ce qui est propre à une ligne
(l'étape suivante d'un dossier, « Démarrer ») prend la marque **en trait** :
`.vh-button--trait`. L'audit mobile compte les boutons pleins visibles hors
boîte de dialogue et échoue au-delà d'un.

### Aucune couleur en dur (règle 2)

`npm run test:unit` lance `scripts/verifier-jetons.mjs` : tout `var(--vh-…)`
employé doit être déclaré (un jeton absent ne lève aucune erreur — `--vh-space-5`
a valu 0 sur trois écrans), aucune couleur littérale hors de `src/styles/`, et
aucun jeton de **fond** (`--vh-error`, `--vh-primary`) employé comme couleur de
texte — neuf feuilles le faisaient, à 4:1 de contraste.

Nouveaux jetons : `--vh-nav-*` (navigation sombre dans les deux thèmes, avec
son propre accent), `--vh-degrade-primaire` (dégradé du bouton, chaque arrêt
vérifié AA avec du blanc), `--vh-vivant*` (lumière sans texte : halos, contour
animé, point final des titres), `--vh-voile`, `--vh-trame`, `--vh-print-*`,
`--vh-largeur-laterale`, `--vh-space-5`. `npm run test:contraste` vérifie
56 paires (40 avant), dont la navigation et chaque arrêt du dégradé.

### Rien ne déborde à 375 px (règle 3)

`npm run audit:mobile` — voir « Outils » plus bas.

### Le message d'erreur est fabriqué en un point (architecture §4)

`core/erreurs/traduire-erreur.ts` remplace la fonction `message()` recopiée dans
quinze services. Chaque service ne garde que ses marqueurs métier
(`VEHORA_SANS_TARIF`…) et le sens de ses codes (`23505` = « ce numéro existe
déjà » chez les clients). Les trois façons de dire « pas de réseau » (Chrome,
Safari, Firefox) sont reconnues ; une erreur inconnue ne laisse jamais sortir le
texte brut de la base. 17 assertions dans `scripts/verifier-erreurs.mjs`.

### « Introuvable », pas « appartient à une autre organisation » (règle 5)

`VEHORA_TENANCY_VIOLATION` disait « Cet élément n'appartient pas à votre
organisation » : la phrase confirme que l'élément existe ailleurs. Elle dit
désormais « introuvable ». Voir `docs/SECURITE.md` pour ce qui reste côté base.

### Le thème avant le premier rendu (design §3)

Un script en ligne dans `index.html` pose `data-theme` avant le premier rendu.
La CSP n'autorise aucun script en ligne : celui-ci l'est **par son empreinte
SHA-256** dans `vercel.json`. Le modifier d'un caractère impose de recalculer
l'empreinte — `npm run test:csp` échoue sinon.

### Le mouvement (skill « animations vivantes »)

Vocabulaire porté en CSS pur dans `src/styles/_animations.css` (préfixe `vh-`).
Trois écarts assumés avec le fichier du skill :

1. **`animation-fill-mode: backwards`, jamais `both`** (méthode, design §6) : une
   transformation restée appliquée capture les `position: fixed` descendants —
   sur MagyaPro, des barres fixées en bas disparaissaient. Pour la même raison,
   l'entrée d'une page est un **fondu d'opacité** sur le conteneur : la barre
   d'actions de l'inspection est fixée en bas de l'écran.
2. Le « wiggle » d'une alerte devient un **va-et-vient horizontal** : un
   bandeau pleine largeur qui tourne de 10° ressemble à un cadre décroché.
3. Seuls les effets **employés** sont dans le fichier. Le reflet vit dans
   `.vh-button` ; l'anneau pulsé, les barres qui poussent, le tiroir animé
   restent dans le skill, à reprendre le jour où un écran en a besoin.

Règles tenues : `transform` et `opacity` seulement ; une seule chose qui attire
l'œil par écran ; aucune animation continue sur un texte à lire, sauf le point
final du titre et le bandeau défilant ; un nombre animé finit exactement sur sa
valeur, et ne s'anime jamais sur un reçu ou un écran de caisse ; « Réduire les
animations » coupe les durées **et les délais**, fige le fond et retire le
bandeau défilant (ses chiffres restent dans les tuiles).

### Brouillon des saisies longues (mobile-vitesse §6)

`shared/brouillon/brouillon.ts` : clé préfixée par l'organisation
(`vehora:<org>:inspection:<véhicule>`), toujours dans un `try/catch`, ignoré
au-delà de 12 heures, effacé à l'enregistrement réussi.

### Photos légères (mobile-vitesse §4)

`core/photos/image-compression.ts` suit désormais `downscaleImage` : décodage
par `createImageBitmap` (orientation EXIF respectée), image déjà petite laissée
intacte, résultat plus lourd abandonné, URL d'objet toujours révoquée, et un
format refusé par le stockage (HEIC) n'est plus envoyé sous une étiquette
« image/jpeg » mensongère.

## Choix techniques notables

- **Aucune migration.** Tout est dans le frontend et l'outillage (méthode,
  règle 6).
- **Briques partagées** : `vh-entete-page` (titre + une phrase + l'action),
  `vh-fond-vivant`, `vh-nombre-anime`, `vh-barre-progression`, `vh-scene`,
  `vh-navigation-laterale`, `vh-barre-basse` ; classes globales `vh-page`,
  `vh-liste`, `vh-fiche`, `vh-etiquette`, `vh-plaque`, `vh-aide`,
  `vh-champ-montant`, `vh-section-titre`, `vh-kpis`, `vh-actions`,
  `vh-compteur`, `vh-alert--succes`.
- **Retour typé** (`shared/ui/retour.ts`) : une réussite et une erreur ne
  partagent plus le même bandeau.
- **Budget initial tenu** : 499,85 Ko bruts, 124 Ko transférés (cible : 250 Ko).
  Seuls les sous-ensembles latin de Manrope sont déclarés (six `@font-face`
  pesaient dans la feuille initiale), et les règles sans usage ont été
  retirées (`.vh-table-stack`, `.vh-chiffre`, `.vh-encart`, `.vh-button--op`). La marge est de 150 octets : la
  prochaine règle globale devra en payer le prix ailleurs.

## Outils

### `npm run audit:mobile`

Le `scripts/audit-debordement.mjs` de la méthode, adapté. Il sert le **build
réel avec la CSP réelle**, ouvre chaque écran de chaque profil (anonyme, sans
entreprise, propriétaire, caissier, plateforme) à 375 px, et échoue sur :

1. un défilement horizontal ou un élément qui sort de l'écran ;
2. un bouton écrasé (libellé sur plus de deux lignes, mesuré sur ses nœuds
   texte) ;
3. **plus d'un bouton principal visible** hors boîte de dialogue ;
4. un **texte coupé** par un conteneur `overflow: hidden` (« 976 500 FCFA »
   sortait de sa tuile sans qu'aucun défilement ne le trahisse) ;
5. un texte sous 13 px ;
6. une violation de CSP ou une erreur JavaScript.

Il enregistre une capture pleine page par écran, **à regarder**. Variables :
`AUDIT_LARGEURS` (`320,375,1280`), `AUDIT_THEMES` (`sombre,clair`),
`AUDIT_PROFILS`, `AUDIT_CHEMINS`, `AUDIT_SHOTS`. Les captures ne vont jamais
dans le dépôt (défaut : dossier temporaire).

**Données simulées.** `scripts/maquette/` intercepte Supabase dans le
navigateur et répond avec une station plausible de Dakar (huit dossiers à
toutes les étapes, caisse ouverte, noms longs exprès). Aucun compte, aucun
secret, aucune base : c'est ce qui a permis de capturer tous les écrans dans un
environnement sans identifiants de test. Les écritures répondent « fait » sans
rien changer — le banc regarde des écrans, il ne teste pas les règles
(`validate:sql` et les tests de parcours le font).

Résultat de la phase : **52 écrans × thème audités à 375 px, 0 problème** ;
320 et 1280 px également.

## Limites connues et suites

- **File d'attente hors-ligne des encaissements** (méthode, mobile-vitesse §6) :
  non faite. Enregistrer un paiement hors-ligne touche aux règles financières
  (fondation 5) — idempotence par identifiant client, rejeu, traitement des
  refus — et la fondation doit être modifiée d'abord. À décider.
- **Liens WhatsApp `wa.me` préremplis** (méthode, notifications) : une option
  pour la décision en attente sur le fournisseur de SMS (`docs/notifications.md`),
  à peser contre la règle « le message est composé par la base » — sur
  WhatsApp, l'employé peut modifier le texte avant l'envoi.
- **Les tests de parcours n'ont pas été rejoués** dans cette session : les
  secrets `VEHORA_TEST_*` n'y sont pas. Les sélecteurs et libellés qu'ils lisent
  ont été vérifiés un à un (voir le rapport de phase).

## Ce que le propriétaire doit faire

1. **Rien en base** : aucune migration.
2. **Redéployer** sur Vercel : `vercel.json` porte la nouvelle empreinte du
   script de thème dans la CSP. Sans elle, le thème clair clignoterait encore
   (le script serait bloqué, sans autre conséquence).
3. **Regarder sur votre téléphone** : la barre basse (« Plus »), la file
   d'attente, la caisse ; puis activer « Réduire les animations » dans les
   réglages du téléphone et vérifier que plus rien ne bouge en continu.
4. **Ajouter les secrets `VEHORA_TEST_*`** dans GitHub si ce n'est pas fait :
   sans eux, l'intégration continue ignore la suite connectée.
