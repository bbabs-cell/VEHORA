# Phase 22 — `database.types.ts` : adopter la sortie réelle du générateur

## Pourquoi maintenant

`CLAUDE.md` portait cette dette depuis la phase 9, avec sa consigne : *« à faire
dans une phase dédiée, pas au détour d'une autre »*. Elle y est restée treize
phases.

Le fichier prétendait être généré et ne l'était pas : chaque phase y ajoutait à
la main la forme d'une table ou d'une vue. Le coût ne s'est pas payé en types
faux, mais en **blocs `Relationships` incomplets** — ce sont eux qui typent les
jointures PostgREST, et leur absence produit un message qui désigne la base
alors que le défaut est dans le fichier. Quatre incidents.

## Ce qui a été fait

`src/app/types/database.types.ts` est désormais la **sortie brute du
générateur**, reformatée par Prettier et rien d'autre : 2 294 lignes annotées à
la main deviennent 3 918 lignes générées. Le fichier ne se complète plus, il se
régénère.

Le générateur est plus strict sur deux points, et le compilateur a levé
**25 erreurs** réparties sur 10 fichiers — l'estimation notée en phase 9 (« 21
corrections sur 8 services ») était juste à peu près.

## Les trois écarts, nommés une fois

Plutôt que de retoucher les types générés — ce qui les a fait diverger pendant
vingt phases — l'écart entre le **schéma** et le **contrat d'exécution** est
nommé dans `src/app/types/frontiere.ts`, avec sa raison.

### 1. `rempliParLaBase` — les colonnes que la base pose elle-même

Le générateur exige à l'insertion toute colonne `NOT NULL` sans valeur par
défaut littérale. Or plusieurs sont posées par un trigger, et le client **ne
doit surtout pas** les envoyer : `organization_id` vient du jeton, `currency` de
l'organisation, `unit_amount_minor` et `service_name` de la résolution de prix,
`number` d'un compteur.

C'est le point intéressant : **le générateur a raison sur le schéma et tort sur
le contrat**. Les envoyer depuis le navigateur rendrait falsifiable ce que la
base impose — un numéro de dossier choisi par le client serait un numéro
négociable. Six insertions concernées.

### 2. `ligneDeVue` / `uneLigneDeVue` — une vue n'a pas d'information `NOT NULL`

PostgreSQL ne propage pas la nullabilité à travers une vue : toutes les colonnes
reviennent `| null`, y compris celles issues d'un `coalesce`. Les traiter comme
nullables dans tout l'écran ajouterait des dizaines de garde-fous là où la base
garantit la valeur. On restreint **à la frontière**, une fois, en nommant la vue.

Même helper pour les fonctions qui renvoient un `text` restreint par une
contrainte que le générateur ne voit pas (`payment_status`, `statut`,
`specificite`).

### 3. `nullAccepte` — un paramètre SQL qui accepte `NULL`, typé non nullable

PostgreSQL ne distingue pas « peut valoir NULL » de « obligatoire ».
`basculer_fonctionnalite(…, p_actif, …)` attend justement `null` pour **retirer**
une dérogation : c'est un troisième état, pas une absence.

À côté, une correction mécanique : les paramètres **facultatifs** d'une fonction
SQL sont typés `?: T`. Passer `undefined` omet l'argument et laisse PostgreSQL
appliquer son `DEFAULT`, qui vaut précisément `null` — même résultat, dit dans
le langage du générateur. Sept appels.

## Ce que le passage a révélé

Une nullabilité réelle, jamais traitée : `line_total_minor` est une colonne
calculée, et le total du dossier l'additionnait sans garde-fou. En pratique elle
n'est jamais nulle ; le code ne le disait nulle part.

Et une leçon d'outillage : `npm run types:check` (`tsc`) **ne vérifie pas les
gabarits Angular**. Une erreur de type dans un `.html` n'apparaît qu'au
`ng build`, qui l'a trouvée. Les deux sont déjà dans l'intégration continue,
dans cet ordre.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` (app et tests) | ✅ |
| `npm run build` (gabarits Angular compris) | ✅ budgets respectés |
| `npm run test:unit` | ✅ 16 assertions |
| `npm run validate:sql` | ✅ 287 assertions (inchangées — aucune migration) |
| `npm run e2e` | ✅ **257 passés, 1 ignoré** — aucune régression |
| 3 campagnes d'intrusion rejouées (dossiers, caisse, catalogue) | ✅ |

Audit de sécurité : aucune migration, aucune policy, aucune fonction serveur
touchée. Les trois helpers ne désactivent aucune vérification sur les colonnes
réellement envoyées — une faute de frappe reste une erreur de compilation — et
ne contiennent aucun `any`.

## Reste à faire (propriétaire)

- **Choisir un fournisseur de SMS** (`docs/notifications.md`) — le seul verrou
  fonctionnel restant.
- Activer la protection contre les mots de passe divulgués dans Supabase.
- Créer le projet Supabase de production (`docs/deploiement.md`).
