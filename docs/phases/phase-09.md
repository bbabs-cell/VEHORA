# Phase 9 — Le Service Order

Le cœur du produit (fondation 4). Le dossier relie enfin client, véhicule,
station, inspection et prestations tarifées. Il portera le paiement.

## Deux règles gouvernent tout le reste

**1. Le statut ne se modifie pas par `UPDATE`.** Une fonction —
`public.transitionner_dossier()` — est le seul chemin, et un trigger
`BEFORE UPDATE` rejette tout changement de statut qui ne vient pas d'elle. Sans
ce trigger, un `PATCH` REST suffisait à faire passer un dossier impayé en
« restitué » : la RLS autorise l'écriture sur la ligne, elle ne dit rien de la
valeur écrite.

Le trigger n'accepte l'écriture que si un drapeau de transaction porte
**l'identifiant du dossier concerné**. Un drapeau booléen aurait laissé une
transition légitime couvrir, dans la même transaction, un second dossier.

**2. Le prix est copié, pas référencé.** À l'ajout d'une prestation, la base
résout le tarif applicable — via `resoudre_prix()` de la phase 8, à la date
d'ouverture du dossier et non à la date du jour — et le **copie** dans la ligne,
avec le nom de la prestation. Modifier un tarif demain ne modifie jamais un
dossier d'hier. Un dossier ouvert hier soir et complété ce matin ne change pas
de tarif en cours de route.

Le client n'envoie ni montant, ni devise, ni nom : les trois sont écrasés par la
base. Un montant accepté depuis le navigateur est un montant négociable.

## La matrice des transitions est une table

`service_order_transitions` porte les règles : statut de départ, statut
d'arrivée, permission exigée, condition, motif obligatoire, audit. Ce n'est pas
un `case` dans une fonction.

Conséquence pratique : les transitions qui dépendent des opérations et du
contrôle qualité (`WAITING → IN_PROGRESS`, `IN_PROGRESS → CONTROL`…) seront des
**lignes à insérer** quand la table des opérations existera, pas une réécriture.
Les six lignes livrées ici couvrent l'arrivée, l'inspection, la mise en file et
l'annulation.

## Ce que la base refuse

- Un statut changé par `UPDATE` — y compris en `service_role`.
- Une transition hors matrice (`ARRIVED → READY`).
- La mise en file sans inspection enregistrée, quand l'organisation l'exige.
- Une annulation sans motif — et elle est auditée.
- Toute modification d'un dossier restitué ou annulé.
- Une prestation sans tarif : elle n'est pas vendable, la ligne est rejetée.
- Une ligne ajoutée ou retirée après le démarrage du travail : le montant
  annoncé au client ne se gonfle pas en silence.
- Une remise au-delà du plafond de l'organisation sans `payments.refund`, avec
  audit systématique des remises (fondation 5).
- Un numéro de dossier imposé par le client : il vient d'un compteur par
  organisation, atomique.
- Une écriture dans l'historique depuis l'API : aucune policy `INSERT`. Un
  historique que l'API peut écrire ne prouve rien.

## Faille de sécurité trouvée par l'audit

**MEDIUM — `transitionner_dossier` était appelable sans être connecté.**
L'advisor Supabase l'a signalée pour le rôle `anon`. La cause n'est pas un
`grant` oublié mais un défaut de PostgreSQL : **`EXECUTE` est accordé à `PUBLIC`
à la création de toute fonction**. Écrire `grant execute … to authenticated`
n'enlève rien — ça ajoute à un droit déjà universel.

L'impact réel était limité (sans JWT, `current_org_id()` est null et la fonction
refuse), mais une fonction `SECURITY DEFINER` atteignable sans compte est une
surface offerte, et « de toute façon ça échoue » est exactement le raisonnement
qu'une régression finit par démentir. Corrigé par une révocation explicite sur
les **cinq** fonctions exposées dans `public`, vérifiée depuis un client anonyme
réel.

Règle ajoutée : toute fonction exposée dans `public` est révoquée de `public` et
`anon`, puis accordée au seul rôle qui en a besoin.

## Défauts d'interface, tous vus à l'écran

| Défaut | Gravité | Correction |
|---|---|---|
| Un refus de transition était rangé dans un signal que seule une modale affichait : l'action échouait **sans un mot** | MEDIUM | l'erreur s'affiche dans la liste, là où l'action est lancée |
| « Annuler le dossier » avec un motif vide ne produisait rien : le contrôle n'étant pas `touched`, le message restait masqué | MEDIUM | `markAllAsTouched()` avant de renoncer — sur les deux formulaires |
| La file ne disait pas de quelle **station** venait un dossier | MEDIUM | station affichée dès que l'organisation en a plus d'une |
| Une prestation sans tarif était proposée à l'ajout, alors que la base la refuse | MEDIUM | bouton inerte, avec la mention « sans tarif » |

Le troisième défaut est le plus grave des quatre : à deux stations, deux
véhicules identiques et rien pour les distinguer.

## Défaut d'ingénierie

**Une vue agrégée ne peut pas être jointe par PostgREST.** Le service demandait
`service_order_totals` en jointure ; PostgREST n'embarque une vue que s'il peut
en déduire une clé étrangère, et une vue `group by` n'en a pas. Les totaux sont
lus par une seconde requête, en parallèle — le calcul reste côté serveur, ce qui
est la règle. Le type qui déclarait cette relation a été corrigé : il décrivait
une relation qui n'existe pas.

**Quatrième incident sur `database.types.ts`.** Cette fois les blocs
`Relationships` manquants ont été comblés pour **toutes** les tables concernées
(neuf), pas seulement celle qui bloquait.

## Défaut de méthode de test

Un test faisait avancer un dossier que d'autres tests lisaient. Selon l'ordre
d'exécution, ce sont les tests qu'on soupçonnait, pas le produit. Le test de
parcours crée désormais son propre dossier et l'annule en sortant, et plus aucun
numéro n'est codé en dur — un numéro épinglé décrit l'historique, pas le produit.

## Validation

| Contrôle | Résultat |
|---|---|
| Migrations sur PostgreSQL jetable | ✅ |
| Assertions SQL de sécurité | ✅ 88 (dont 30 nouvelles) |
| Campagne d'intrusion par l'API réelle | ✅ 23 assertions, tout bloqué |
| Refus des fonctions au rôle `anon` | ✅ 5 vérifiées depuis un client anonyme |
| Playwright | ✅ 153 passés, 1 ignoré |
| Vérification des types | ✅ |
| Build de production | ✅ 479,99 kB (118,00 kB compressé) |
| Advisors sécurité | ✅ plus aucun signalement `anon` |

`scripts/intrusion-dossiers.mjs` rejoue la campagne à volonté.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Le cycle s'arrête à `WAITING` | — | assumé : les opérations sont la phase suivante, et la matrice les accueillera par insertion |
| Numérotation avec trous possibles si une transaction échoue | LOW | acceptable pour un dossier ; les reçus exigeront leur propre mécanisme sans trou |
| L'historique n'est pas encore montré à l'écran | LOW | la donnée est écrite, ce qui ne se rattrape pas ; l'écran viendra |
| `confirm()` natif sur trois écrans | LOW | dette assumée, à reprendre d'un coup |

Les trois avertissements d'advisor restants sont les fonctions `SECURITY
DEFINER` volontairement ouvertes aux comptes connectés — désormais documentées
en base, `transitionner_dossier` comprise — et la protection contre les mots de
passe compromis, qui relève du propriétaire du projet.

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 9 validée.**

## Suite

Les **opérations** : qui exécute quoi, sur quel dossier, avec quel statut. C'est
ce qui ouvrira `WAITING → IN_PROGRESS → CONTROL → READY`, et qui donnera au
tableau des opérations sa raison d'être. Puis le **paiement** et la **caisse**,
qui refermeront le cycle jusqu'à la restitution.
