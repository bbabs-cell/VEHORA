# Phase 26 — Vérifier l'existant, réparer ce qui est cassé

Demande du propriétaire : « Vérifie les fonctionnalités existantes d'abord.
Reconstruis-les s'il le faut […] vérifie s'il y a certains points qui sont
cassés. Ensuite, on fera le reste par ordre d'urgence. »

## Méthode

1. **La base réelle d'abord.** Un dossier réel (n° 1) était à l'étape
   « Inspection » depuis neuf jours, avec quatre inspections enregistrées.
2. **Chaque geste de l'écran relu contre ce que la base accepte** : trois
   relectures indépendantes (file et dossiers ; encaissement et caisse ;
   comptes, membres, stations et tarifs), environ vingt-cinq chemins cassés
   confirmés, chacun reproduit avant d'être corrigé.
3. **Les règles posées en base comme invariants**, puis les écrans corrigés
   pour ne plus proposer ce que la base refusera.

## La cause du dossier bloqué

Le passage INSPECTION → WAITING exige une inspection dont `service_order_id`
désigne le dossier. L'écran d'inspection n'a **jamais** rempli cette colonne :
elle avait été créée en phase 6 « pour la phase 8 », sans clé étrangère, et la
phase 8 ne l'a pas branchée. Les tests de parcours ne l'ont pas vu : **leur
fixture créait l'inspection par l'API, déjà rattachée — elle sautait
précisément l'étape cassée.**

Corrigé des deux côtés : la file ouvre l'inspection avec `?dossier=…`, l'écran
l'enregistre sur le dossier et y revient ; la base ajoute la clé étrangère et
`vehora.check_inspection_dossier()`, qui refuse le dossier d'une autre
organisation (« introuvable ») ou d'un autre véhicule. Sans ce garde-fou, une
organisation pouvait faire franchir l'étape au dossier d'une autre en
connaissant son identifiant.

Les quatre inspections existantes n'ont pas été rattachées à la main : aucune
modification manuelle de la base. **Déployé le 17 octobre** (`29e1438`,
`vehora.vercel.app`) ; le dossier n° 1 a été inspecté de nouveau par l'écran
et il est passé en attente, puis en cours — le parcours réparé a servi sur la
donnée réelle.

## Ce qui était cassé, et ce qui est fait

### File d'attente et dossiers

| Cassé                                                                                                                           | Réparé                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un dossier mis en attente sans prestation n'avait aucune opération : bloqué pour toujours.                                      | Invariant `VEHORA_DOSSIER_SANS_PRESTATION` ; l'écran dit pourquoi l'étape est inerte.                                                                                          |
| Une prestation ajoutée pendant l'attente n'avait pas d'opération : facturée, jamais travaillée, et « tout est terminé » passait. | Déclencheur `service_order_items_operation`.                                                                                                                                   |
| Contrôle désactivé : un véhicule pouvait passer « prêt » puis être restitué, opérations inachevées.                             | Invariant `VEHORA_OPERATIONS_EN_COURS`, pour les deux chemins ; « 2 opérations ne sont pas terminées » sous le bouton inerte.                                                  |
| Annuler un dossier payé rendait le remboursement impossible (un dossier annulé refuse tout paiement).                           | Invariant `VEHORA_PAIEMENT_A_REMBOURSER` (fondation 4, jamais écrite en base) ; « Annuler » n'est proposé qu'une fois l'argent rendu.                                           |
| Les boutons d'étape étaient codés en dur : proposés sans la permission, sans le réglage, ou dans un état refusé.                 | Ils viennent de la matrice `service_order_transitions`, filtrés par permission et réglage ; une étape impossible reste visible, inerte, avec sa raison.                         |
| Un dossier restitué avec un solde disparaissait de la file : la créance n'était plus visible nulle part.                        | Groupe « Restitués — reste à encaisser ».                                                                                                                                      |
| Chaque clic sur « Reçu » émettait un nouveau reçu.                                                                              | Le dernier reçu est rouvert s'il est à jour ; sinon un reçu de correction le référence.                                                                                        |
| Les prestations restaient modifiables sur un dossier engagé.                                                                    | Lecture seule une fois le travail démarré.                                                                                                                                     |
| Un trop-perçu s'affichait en vert, la couleur de « Soldé ».                                                                     | « à rendre 1 000 F CFA », en ambre.                                                                                                                                            |

### Encaissement, caisse, export

| Cassé                                                                                                         | Réparé                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Changer de méthode de paiement ne réévaluait pas le formulaire : un `computed` ne suit pas `FormControl.value`. | `toSignal(valueChanges)` ; vérifié dans le navigateur (Mobile Money active « Encaisser »).          |
| Le montant proposé était en unités mineures : juste en F CFA, cent fois trop en euros.                        | `versSaisie`, par la devise.                                                                         |
| Aucun avertissement avant d'encaisser plus que le reste.                                                      | Avertissement de trop-perçu dans la boîte.                                                           |
| Le remboursement proposait le total payé, y compris ce qui était déjà remboursé.                              | Plafonné au remboursable restant.                                                                    |
| Caisse ouverte ailleurs : l'écran gardait un état périmé et l'erreur ne s'expliquait pas.                     | État rechargé avant le message ; message neutre pour `VEHORA_CAISSE_FERMEE`.                         |
| Les montants négatifs de l'export CSV étaient « désamorcés » en texte (`'-5000`) : le tableur ne les additionnait plus. | Un nombre n'est pas une formule (`csv.ts`, `verifier-csv.mjs`).                              |

### Comptes, membres, stations, tarifs

| Cassé                                                                                                                                    | Réparé                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Aucun écran ne créait de compte.** L'invitation disait « créez votre compte avec l'adresse invitée » : impossible hors du tableau de bord Supabase. | `/inscription` (avec le nom : sans lui, chaque membre s'affichait « Sans nom »), `/mot-de-passe-oublie`, `/nouveau-mot-de-passe`. Aucune réponse ne dit si une adresse a un compte. |
| La connexion exigeait 8 caractères, avant tout appel : un compte créé avec 6 ou 7 ne pouvait plus entrer.                                 | La longueur s'impose à la création, pas à la connexion.                                                                                                      |
| Un rôle de portée « station » sans station ne voit rien, et aucun écran ne permettait d'en attribuer.                                     | « Stations » sur chaque membre concerné ; « Aucune station » signalé.                                                                                        |
| Une invitation expirée restait `PENDING` (l'exception annulait son passage à `EXPIRED`) et bloquait toute nouvelle invitation.            | Déclencheur `organization_invitations_expirer` ; « Expirée » à l'écran.                                                                                      |
| Les refus d'invitation s'affichaient sous le voile de la fenêtre.                                                                        | Dans la fenêtre.                                                                                                                                             |
| Quotas de plan atteints : message brut.                                                                                                  | Traduits (stations, membres).                                                                                                                                |
| Un tarif créé le jour même ne se corrigeait pas (le remplacer ferme la veille, avant son début) et « Retirer » échouait sans rien dire.     | Correction directe d'un tarif qui commence aujourd'hui ou plus tard, suppression d'un tarif non entamé, zéro ligne touchée = refus explicite ; erreurs visibles. |
| Organisation suspendue : ses membres arrivaient sur « Sans organisation » sans explication.                                              | Une phrase le dit.                                                                                                                                           |

## Base de données

Deux migrations, appliquées à la base réelle par le MCP Supabase :

- `20261017132511_inspection_dossier.sql` — clé étrangère, index partiel,
  `vehora.check_inspection_dossier()` (SECURITY INVOKER, muette sur `NULL`
  donc pendant une cascade) ;
- `20261017132532_reparations_parcours.sql` — `vehora.check_dossier_statut()`
  (trois invariants de statut), `vehora.operation_de_ligne_en_attente()`,
  `vehora.expirer_invitations_perimees()` ; EXECUTE révoqué de `public`,
  `anon`, `authenticated`.

**Les fichiers portent la version que la base a enregistrée** : le MCP
`apply_migration` horodate à l'application, pas au nom du fichier. Les
fichiers, pas encore commités, ont été renommés en conséquence : la CLI
Supabase compare les versions, et un écart lui ferait rejouer une migration
déjà appliquée.

`database.types.ts` régénéré : seule différence, la nouvelle clé étrangère
(et la version de PostgREST). Advisors : aucun nouveau signalement de
sécurité ; le nouvel index est « pas encore utilisé », comme 67 autres sur une
base presque vide.

## Ce qui n'est pas fait, par ordre d'urgence

1. ~~Déployer.~~ Fait le 17 octobre, après réautorisation du connecteur Vercel
   sur l'équipe `babsdiong-6440s-projects` (il répondait 403 jusqu'en lecture).
2. **Réglages Auth dans le tableau de bord Supabase** (`docs/deploiement.md`,
   partie 3) : Site URL et Redirect URLs, sans quoi les liens de création et de
   réinitialisation pointent vers `localhost` ; **SMTP personnalisé**, sans
   quoi aucun e-mail ne part vers une adresse extérieure à l'équipe du projet ;
   protection contre les mots de passe divulgués.
3. **Un remboursement en espèces sort de la caisse de celui qui rembourse**,
   pas de celle qui a encaissé. Structurel (fondation 5) : à décider avant de
   corriger.
4. **Deux drapeaux ne ferment rien côté serveur** : `recus` et
   `inspections_photos` sont déclarés, l'écran les lit, aucune fonction ne les
   vérifie. Contraire à la règle « un flag qui n'empêche rien n'est pas un
   flag ».
5. **Un essai n'expire jamais** : aucune échéance n'est posée ni vérifiée.
6. **Les membres déjà inscrits restent « Sans nom »** : seuls les nouveaux
   comptes donnent leur nom. Il manque un écran « Mon profil ».
7. Manquent encore : remises à l'écran, historique d'un dossier, journal
   d'audit pour le propriétaire, durées réelles des prestations.
8. **Environnement de démonstration incomplet** sur la base réelle : les
   adhésions de démonstration ne sont pas toutes posées (`ousmane@vehora.test`
   n'a pas d'organisation) et aucun compte Super Admin n'existe sur ce projet.

## Validation

| Contrôle                                                  | Résultat                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run types:check` + `tsc -p tsconfig.spec.json`       | vert                                                                                                                           |
| `npm run test:unit`                                       | vert — CSV (montants négatifs compris), erreurs, jetons                                                                        |
| `npm run test:contraste`                                  | vert — 62 paires                                                                                                               |
| `npm run build`                                           | vert, aucun avertissement — initial **499,83 Ko** (170 octets sous le seuil)                                                   |
| `npm run test:csp`                                        | vert                                                                                                                           |
| `npm run validate:sql`                                    | vert — **307 assertions** (295 avant)                                                                                          |
| `npm run audit:mobile` à 320, 375 et 1280 px, deux thèmes | vert, tous profils, dont les trois écrans de compte                                                                            |
| Captures regardées                                        | file (trop-perçu, étape inerte et sa raison), création de compte, membres et fenêtre « Stations », correction d'un tarif du jour |
| `npm run e2e`                                             | non joué : les secrets `VEHORA_TEST_*` ne sont pas dans cette session. Nouveau test : arrivée → inspection **par l'écran** → attente |

Le poids : les trois écrans de compte sont chargés à la demande, et leurs
appels à Supabase Auth vivent dans `CompteService`, chargé avec eux. Placés
dans `AuthService`, ils partaient dans le bundle initial de chaque téléphone et
le faisaient passer de 407 octets au-dessus du seuil.

## Leçons

- **Une fixture qui contourne l'écran cache l'écran cassé.** Le test de
  parcours le plus important passait depuis la phase 8 parce qu'il créait
  l'inspection par l'API. Un parcours se teste par les gestes de l'utilisateur ;
  une fixture ne prépare que ce qui précède l'étape testée.
- **Une règle tenue par un seul chemin est contournée par un autre.** Les cinq
  trous de `reparations_parcours` sont du même genre : chacune est maintenant un
  invariant sur la donnée (déclencheur), indépendant de la matrice.
- **Une exception annule aussi ce qu'on voulait garder.** `accepter_invitation`
  passait l'invitation à `EXPIRED` puis levait une exception : toute la
  transaction était annulée, ce passage compris. Une écriture qui doit survivre
  à un refus se fait ailleurs — ici, au moment où l'on réinvite.
- **Zéro ligne touchée n'est pas une erreur pour PostgREST.** Une mise à jour
  filtrée doit demander ce qu'elle a modifié (`.select('id')`) avant
  d'annoncer une réussite.
- **Ce qui sert une fois par personne ne va pas dans le bundle initial.**
