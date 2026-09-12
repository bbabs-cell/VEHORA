# Phase 8 — Catalogue de services et tarification

Fondation 5 mise en base. Le produit sait désormais répondre à la seule question
qui précède un dossier : **combien coûte cette prestation pour ce véhicule, dans
cette station, aujourd'hui ?**

## Ce qui a été construit

### Base — trois tables et une résolution

| Table | Rôle |
|---|---|
| `service_categories` | regroupement d'affichage, propre à chaque organisation |
| `services` | les prestations vendues, avec durée indicative |
| `service_prices` | le tarif, daté, portant un type de véhicule et/ou une station |

La résolution du prix est un arbre de spécificité, pas une colonne :

1. service + type de véhicule + station ;
2. service + type de véhicule (toutes stations) ;
3. service + station (toutes catégories de véhicule) ;
4. service seul.

`public.resoudre_prix()` renvoie **zéro ligne** quand aucun tarif ne s'applique.
Jamais de prix implicite à zéro : un lavage facturé 0 F CFA ne se voit qu'à la
clôture de caisse, quand il est trop tard.

La fonction est **SECURITY INVOKER** : elle lit `service_prices` sous la RLS de
l'appelant. Une organisation ne peut donc pas résoudre le tarif d'une autre,
même en devinant un identifiant de service.

### Ce que la base refuse

- **Chevauchement de tarifs.** Une contrainte d'exclusion GiST interdit deux
  tarifs de même spécificité valables le même jour. Les `null` (« tous
  véhicules », « toutes stations ») ne s'excluant jamais entre eux, ils sont
  projetés sur une valeur sentinelle. Sans cela, le prix aurait été
  indéterminé — le genre d'ambiguïté qu'un client mécontent découvre avant nous.
- **La devise envoyée par le client.** Un trigger la remplace par celle de
  l'organisation. On ne choisit pas depuis un navigateur la devise dans laquelle
  on sera facturé.
- **Un montant négatif.** Une remise se porte par la ligne de dossier, pas par
  un tarif inversé.
- **Un service ou une station appartenant à une autre organisation.** Deux
  triggers de cohérence : une policy vérifie la ligne, pas ce qu'elle référence.

### Séparation des droits

`services.manage` gère le catalogue, `prices.manage` fixe les prix. Ce sont deux
métiers : un chef de station réorganise ses prestations sans pouvoir toucher aux
tarifs. La **lecture** est ouverte à tout membre de l'organisation — l'accueil,
les opérations et la caisse affichent tous le catalogue ; exiger une permission
dédiée reviendrait à la donner à tout le monde.

### Interface

Écran `/catalogue`, mobile-first : la prestation, sa catégorie, sa durée, puis
ses tarifs en vigueur avec leur portée écrite en toutes lettres
(« SUV · Toutes stations »). Une prestation sans tarif porte un avertissement
explicite — elle ne peut pas être facturée, l'écran le dit au lieu de le laisser
deviner à la caisse.

## Faille trouvée par la campagne d'intrusion

**MEDIUM — aucune augmentation de prix n'était programmable.** Un tarif en
vigueur n'a pas de fin : il couvre toutes les dates futures. Insérer le tarif de
demain se heurtait donc à la contrainte de non-chevauchement. Pour augmenter un
prix — l'opération tarifaire la plus courante — il fallait fermer l'ancien puis
ouvrir le nouveau, dans cet ordre, avec une erreur entre les deux si on se
trompait. Et deux écritures faites depuis le navigateur peuvent être coupées au
milieu : la prestation se serait retrouvée sans tarif, donc invendable.

Corrigé par `public.remplacer_tarif()` : ferme le tarif courant la veille et
ouvre le nouveau, en une transaction, avec audit. SECURITY INVOKER là encore —
la fonction n'accorde rien que les policies n'accordent déjà. Par défaut le
nouveau prix s'applique **demain** : la journée en cours a déjà des dossiers
ouverts au prix affiché ce matin.

## Défauts d'interface vus à l'écran

Aucun n'avait été attrapé par une assertion. Tous l'ont été en regardant les
captures.

| Défaut | Gravité | Correction |
|---|---|---|
| Les actions d'une prestation passaient sur deux lignes et occupaient plus de place que la prestation | MEDIUM | boutons compacts, cible maintenue à 44 px |
| Deux tarifs de la même liste ne s'affichaient pas pareil selon la longueur du montant (`flex-wrap`) | MEDIUM | disposition figée, indépendante de la largeur du montant |
| Le champ date affichait `09/13/2026` — format américain, imposé par la locale de l'appareil | MEDIUM | la date est aussi écrite en toutes lettres sous le champ |
| Le libellé du montant affichait `XOF` au lieu de `F CFA` | LOW | symbole de devise dérivé d'`Intl`, jamais le code ISO |

## Validation

| Contrôle | Résultat |
|---|---|
| Migrations sur PostgreSQL jetable | ✅ |
| Assertions SQL de sécurité | ✅ 58 (dont 22 nouvelles) |
| Campagne d'intrusion par l'API réelle | ✅ 21 assertions, tout bloqué |
| Playwright | ✅ 133 passés, 1 ignoré |
| Vérification des types | ✅ |
| Build de production | ✅ 479,70 kB (117,94 kB compressé) |
| Advisors sécurité | ✅ aucun nouvel avertissement |

`scripts/intrusion-catalogue.mjs` rejoue la campagne d'intrusion à volonté.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Les catégories ne se créent pas depuis l'interface | LOW | le service sait le faire ; l'écran de paramètres viendra |
| Pas d'historique des prix consultable à l'écran | LOW | la donnée est en base et auditée ; écran de rapport plus tard |
| `confirm()` natif sur trois écrans | LOW | dette assumée, à reprendre d'un coup |

Les deux avertissements d'advisor ouverts sont les mêmes qu'en phase 7, tous
deux déjà arbitrés.

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 8 validée.**

## Suite

Le **Service Order** : le cœur du produit. Il reliera enfin client, véhicule,
inspection, prestations tarifées, file d'attente et paiement — et c'est lui qui
appliquera la règle d'historisation de la fondation 5, en **copiant** le prix
résolu dans la ligne de dossier. Modifier un tarif demain ne doit jamais
modifier un dossier d'hier.
