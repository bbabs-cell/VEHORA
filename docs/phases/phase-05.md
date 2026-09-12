# Phase 5 — CRM clients

## Périmètre

Fiches clients : création, modification, archivage, et surtout **recherche**.
La recherche est le geste le plus fréquent au comptoir — un client arrive, on
doit le retrouver en deux secondes.

## Trois décisions dictées par le terrain

### Le téléphone est l'identifiant, pas l'e-mail

L'e-mail est souvent absent. Le numéro est unique par organisation, et
**normalisé par la base** en forme internationale. Cinq écritures du même
numéro — `+221 77 123 45 67`, `00221 77 123 45 67`, `221771234567`,
`77 123 45 67`, `077 123 45 67` — désignent la même personne.

### La recherche tolère l'orthographe

Moussa/Mousa, Cheikh/Sheikh, Aïssatou/Aissatou : une recherche par égalité
exacte serait inutilisable. Index trigramme (`pg_trgm`) sur le nom, plus
recherche par fragment de numéro. « Mousa » retrouve « Moussa Diallo » ;
« 771234 » aussi.

### On archive, on ne supprime pas

Un client porte un historique de prestations et de paiements. L'archivage le
retire des listes, conserve l'historique, et **libère son numéro** pour une
nouvelle fiche.

## Défauts trouvés et corrigés

### HIGH — la normalisation du numéro ne protégeait pas des doublons

**Constat.** Trouvé par un test que j'ai écrit en attendant qu'il échoue. La
colonne générée se contentait de retirer les caractères non numériques :
`+221 77 123 45 67` donnait `221771234567`, `00221 77 123 45 67` donnait
`00221771234567`. Deux fiches pour la même personne. Et `77 123 45 67` — la
forme que tout le monde saisit réellement — ne correspondait à aucune des deux.

**Impact.** Le doublon client est le premier problème de qualité de données en
station : un même client accumule plusieurs historiques, sa fidélité devient
fausse, et le responsable perd confiance dans ses chiffres. L'unicité du numéro
existait, mais ne protégeait de rien.

**Correction.** Une colonne générée ne peut pas consulter `organizations` : on
passe par un trigger, qui connaît l'indicatif du pays et ramène tout numéro à sa
forme internationale. Cinq assertions SQL couvrent les cinq écritures.

### MEDIUM — les numéros s'affichaient chacun différemment

**Trouvé par la capture d'écran.** `781112233` s'affichait à côté de
`+221 70 999 88 77` : la même donnée, deux apparences, selon la façon dont elle
avait été tapée. L'œil ne peut plus parcourir la colonne — précisément le geste
le plus fréquent sur cet écran.

Corrigé en affichant depuis le numéro normalisé, jamais depuis la saisie brute.

### LOW — un chiffre orphelin en fin de numéro

Premier correctif insuffisant : `+221 77 12 34 56 7`. Le regroupement par deux
laissait un chiffre isolé, qui se lit comme une faute de frappe. Le format suit
maintenant l'usage local : 9 chiffres → `77 123 45 67`, 8 chiffres →
`76 12 34 56`.

**Mon test était complice** : il acceptait les groupes de 1 à 2 chiffres, donc
il validait l'affichage fautif. Resserré — il refuse désormais tout chiffre
isolé en fin de ligne.

C'est la troisième fois qu'un défaut visuel échappe aux tests et se voit à
l'écran. J'en tire une règle : sur un écran, une assertion doit décrire ce que
l'œil doit voir, pas seulement ce que le code produit.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build | ✅ 117,6 kB transférés |
| Sécurité SQL | ✅ **26 assertions** |
| Parcours Playwright | ✅ **81 tests** |
| Advisors sécurité | ✅ aucune alerte nouvelle |

### Les trois angles

1. **Autorisé** — le propriétaire crée, modifie, archive ; la recherche tolère
   l'orthographe et le numéro partiel ; une recherche vide propose de créer la
   fiche.
2. **Non autorisé** — le caissier (`customers.read` sans `customers.write`)
   voit la liste et peut rechercher, mais **aucun bouton d'écriture** ne lui est
   proposé, et l'API refuse création (**403**), modification et suppression
   (0 ligne).
3. **Malveillant** — une autre organisation ne voit aucun client, la recherche
   ne traverse pas les organisations, et une fiche d'une autre organisation est
   intouchable.

La fonction de recherche est en `security invoker` : elle ne contourne rien, la
RLS s'applique normalement. C'est une commodité, pas une porte dérobée.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| L'archivage libère le numéro : deux fiches peuvent porter le même historiquement | LOW | voulu — un numéro change de main ; les prestations restent liées à leur fiche |
| Pas d'écran de détail client (véhicules, historique) | MEDIUM | dépend des véhicules et des prestations — phases suivantes |
| `confirm()` natif pour l'archivage | LOW | à remplacer par une modale du design system |
| Indicatifs limités à 13 pays | LOW | table à étendre ; un pays inconnu garde les chiffres bruts |
| Policies Storage non écrites | MEDIUM | avec les photos de véhicules |

Aucune vulnérabilité CRITICAL ou HIGH ouverte. **Phase 5 validée.**

## Suite

Véhicules : rattachés aux clients, avec types et plaques — puis l'inspection et
les photos, qui amèneront les policies Storage.
