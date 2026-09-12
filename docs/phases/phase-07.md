# Phase 7 — Inspection du véhicule et photos

## Périmètre

Constat d'état à l'arrivée du véhicule, avec photos. Premier usage de Supabase
Storage, donc **premières policies de fichiers** — le point de sécurité le plus
sensible depuis la RLS elle-même.

## Pourquoi l'inspection compte

Elle fixe l'état d'arrivée. C'est ce qui protège la station d'une accusation de
rayure, et le client d'un dommage réel non signalé. Elle doit donc être faisable
**en une minute, debout, sur un téléphone** — sinon elle ne sera pas faite, et
elle ne protégera personne.

D'où : dix zones dans l'ordre de la ronde autour du véhicule (on tourne, on ne
saute pas), deux boutons de 56 px par zone, et le commentaire et la photo qui
n'apparaissent **que** sur une anomalie.

## Sécurité des fichiers

| Décision | Raison |
|---|---|
| Chemin imposé `{organization_id}/{inspection_id}/{fichier}` | Les policies ne comparent que le premier segment : court, indexable, impossible à contourner par un nom fantaisiste |
| Bucket **privé**, URL signées 10 minutes | Une photo de véhicule porte une plaque — donnée personnelle |
| Types limités à JPEG, PNG, WebP | **Le SVG est exclu volontairement** : c'est du XML exécutable ; servi depuis notre domaine il permettrait du script |
| Taille plafonnée à 5 Mo | Au-delà, c'est un envoi non compressé — coûteux sur un forfait payé au volume |
| Compression avant envoi (1600 px, ~0,8) | Une photo de téléphone pèse 3 à 8 Mo ; le constat reste lisible sous 300 Ko |

### 14 tentatives d'intrusion sur le stockage, toutes bloquées

Envoi dans le dossier d'une autre organisation · envoi à la racine hors dossier
d'organisation · **traversée de chemin** (`..`, encodée en pourcent, remontée
multiple) · téléchargement par une autre organisation · accès par URL publique ·
accès anonyme avec la seule clé publique · envoi d'un SVG · envoi d'un HTML ·
envoi par un rôle sans `inspections.write` · signature d'une URL par une autre
organisation.

Sur la traversée de chemin, **mon test était mal spécifié** : j'attendais un
refus sur `{orgB}/../{orgA}/x.png`, qui se normalise en fait vers le dossier de
l'utilisateur lui-même — donc légitimement autorisé. La direction qui compte,
`{orgA}/../{orgB}/x.png`, est bien refusée, y compris en remontée multiple et en
encodage pourcent.

## Défauts trouvés et corrigés

### HIGH — aucune photo n'était supprimable, par personne

Le choix initial — pas de suppression, la photo est une preuve — était juste sur
le principe et **faux en pratique** :

* une photo envoyée par erreur (photo personnelle, mauvais véhicule) restait
  indéfiniment, sans recours ;
* le droit à l'effacement impose de pouvoir retirer une donnée personnelle, et
  une plaque en est une ;
* Supabase interdit même la suppression en SQL direct : il n'existait
  **littéralement aucun chemin**.

**Correction.** Suppression réservée au porteur de `organization.manage` — le
propriétaire, seul responsable légal — et **tracée dans `audit_logs`** par un
trigger. Un opérateur ne peut pas faire disparaître une preuve gênante ; le
responsable le peut, et cela se voit. Vérifié : le caissier est refusé (403), le
propriétaire réussit, la trace est écrite.

### MEDIUM — la barre d'actions flottait par-dessus le contenu

**Trouvé par la capture d'écran.** Le dégradé laissait le contenu transparaître
derrière les boutons, et une bande de contenu continuait de défiler **entre** la
barre et la navigation basse. Corrigé : barre fixe, fond opaque, adossée à la
navigation.

### MEDIUM — un nombre magique dupliqué

La hauteur de la navigation basse (68 px) était recopiée dans deux composants,
et la vraie valeur était 65. D'où un décalage de 3 px, invisible à la lecture du
code et évident à l'écran. C'est **le vrai défaut** : le nombre magique, pas le
décalage.

Corrigé par un token partagé `--vh-nav-basse`, utilisé par la coquille comme par
l'écran d'inspection.

### Le fichier de types atteint ses limites

Troisième incident lié aux blocs `Relationships` manquants dans
`database.types.ts`, que je maintiens à la main. Ils ne sont pas décoratifs :
ce sont eux qui permettent à PostgREST de typer les jointures, et leur absence
produit un message trompeur (« could not find the relation between… »).

J'ai comparé avec la sortie authentique du générateur et corrigé, et inscrit
l'avertissement **en tête du fichier**.

## Choix de conception notables

**Une inspection est un constat daté : ni modifiable, ni supprimable.** Aucune
policy `UPDATE` ou `DELETE`. La modifier après coup lui retirerait toute valeur
de preuve. Une erreur se corrige par une nouvelle inspection, qui laisse les
deux visibles. Deux assertions SQL le vérifient.

**Les photos passent en dernier.** Le constat écrit est enregistré d'abord :
ce sont les photos qui échouent sur un réseau faible, et le constat ne doit pas
être perdu avec elles. Si des photos échouent, l'utilisateur est averti
explicitement plutôt que de croire que tout est passé.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build | ✅ 117,8 kB transférés |
| Sécurité SQL | ✅ **36 assertions** |
| Parcours Playwright | ✅ **117 tests** |
| Sécurité du stockage (API réelle) | ✅ 14 assertions |

Le parcours complet est éprouvé de bout en bout : anomalie constatée,
commentaire, photo jointe, enregistrement, fichier présent dans Storage sous le
bon dossier, ligne correspondante en base.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Pas de relecture des inspections passées dans l'interface | MEDIUM | le service sait les charger avec URL signées ; l'écran viendra avec la fiche véhicule |
| Les photos ne sont pas encore rattachées à une prestation | — | `service_order_id` est prêt, nullable ; phase suivante |
| `confirm()` natif sur trois écrans | LOW | dette assumée, à reprendre d'un coup |
| Compression dépendante de Canvas | LOW | repli sur l'original si indisponible, jamais de perte de photo |

Deux avertissements d'advisor restent ouverts, **tous deux déjà arbitrés** :
les fonctions `SECURITY DEFINER` volontairement exposées (documenté en base) et
la protection contre les mots de passe compromis (action propriétaire).

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 7 validée.**

## Suite

Les services et leurs tarifs, puis le Service Order — le cœur du produit, qui
reliera enfin client, véhicule, inspection, file d'attente et paiement.
