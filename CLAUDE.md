# VEHORA — Guide de travail (source de vérité opérationnelle)

VEHORA est un SaaS multi-tenant de gestion opérationnelle pour les centres de
lavage, de detailing et de services automobiles. Marché initial : Afrique de
l'Ouest. Qualité et architecture : internationales.

Le **PROMPT MAÎTRE** (`docs/PROMPT-MAITRE.md`) est la source de vérité produit.
Ce fichier est sa traduction opérationnelle pour le développement quotidien.

## Stack

| Couche | Choix | Notes |
|---|---|---|
| Frontend | Angular (standalone components + signals), TypeScript strict | SPA, **pas de SSR** |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) | |
| Base | PostgreSQL + Row Level Security | RLS dès le jour 1 |
| Déploiement | Vercel (build statique) | |
| Tests | Playwright (parcours) + pgTAP/SQL (sécurité RLS) + unitaires | |
| Migrations | `supabase/migrations/` versionnées en Git | jamais de modif manuelle en prod |

Interdits sauf nécessité démontrée : PHP, Laravel, MySQL, Firebase, Prisma,
microservices, Kubernetes.

## Les cinq fondations (à lire avant toute implémentation)

1. `docs/architecture/01-roles-permissions.md` — RBAC
2. `docs/architecture/02-organization-station-user-employee.md` — modèle d'identité
3. `docs/architecture/03-rls-super-admin.md` — stratégie RLS et Super Admin
4. `docs/architecture/04-service-order-lifecycle.md` — cycle de vie du Service Order
5. `docs/architecture/05-regles-financieres.md` — paiements, caisse, tarification

Aucune fonctionnalité ne doit contredire ces cinq documents. Si une
fonctionnalité l'exige, on modifie d'abord le document, avec justification.

Voir aussi :
- `docs/architecture/06-design-system.md`
- `docs/architecture/07-structure-projet.md`
- `docs/architecture/08-securite-tests.md`
- `docs/decisions/` — journal des décisions d'architecture (ADR)

## Règles de développement

**Hiérarchie des priorités** (en cas de conflit) :
CLARTÉ → RAPIDITÉ → FIABILITÉ → SÉCURITÉ → ÉVOLUTIVITÉ → ESTHÉTIQUE.
Et : OPÉRATIONNEL > ESTHÉTIQUE · SÉCURITÉ > VITESSE DE DEV · SIMPLICITÉ > COMPLEXITÉ.

- **Mobile-first.** Les écrans opérationnels (file d'attente, opérations,
  inspection, paiement) sont conçus pour un téléphone Android d'entrée de gamme
  tenu d'une main, dehors.
- **Jamais de sécurité côté frontend seul.** Un bouton masqué n'est pas une
  permission. Toute règle sensible est appliquée par RLS ou par une fonction
  serveur.
- **Code pédagogique.** Clair, modulaire, commenté là où c'est utile. Pas
  d'abstraction sans bénéfice concret. Pas de fichier géant.
- **Progressif.** Une phase à la fois. Jamais de génération massive.

## Skills projet — choisir avant d'agir

Les skills vivent dans `.claude/skills/`. **Ne jamais tous les charger.** Avant
chaque tâche importante : identifier le type de tâche, charger uniquement les
skills qui apportent une valeur directe, vérifier le résultat.

| Type de tâche | Skills à charger |
|---|---|
| Interface, composant, style | `vehora-design-system` + `vehora-frontend` |
| Parcours utilisateur, formulaire, navigation | `vehora-ux` + `vehora-frontend` |
| Composant Angular, service, route, performance, accessibilité | `vehora-frontend` |
| Démarrage de session, commit, clôture de phase, Git | `vehora-workflow` |
| Table, migration, policy, requête Supabase | `vehora-supabase` (+ `vehora-security` si données sensibles ou permissions) |
| Auth, RLS, permissions, audit | `vehora-security` + `vehora-supabase` |
| Espace Super Admin, abonnements, flags | `vehora-super-admin` + `vehora-security` + `vehora-supabase` |
| Paiements, caisse, devises, réseau, terrain | `vehora-west-africa` (+ `vehora-ux`) |
| Tests, validation, clôture de phase | `vehora-qa` |

Skills natifs utiles : `/security-review` (revue de sécurité d'un diff),
`/code-review`, `/simplify`, `update-config`, `session-start-hook`.

**Outils réellement disponibles** : MCP Supabase, MCP GitHub, Chromium +
Playwright préinstallés en environnement cloud (`/opt/pw-browsers` — **ne jamais
y lancer `playwright install`** ; en local, si), PostgreSQL 16 pour
`scripts/validate-sql.sh`, Docker, Node 22.

Un hook `SessionStart` (`.claude/hooks/session-start.sh`) vérifie
l'environnement à chaque ouverture de session et installe les dépendances npm
quand un `package.json` existe.

Les plugins `frontend-design`, `web-design-guidelines`, `supabase`,
`playwright`, `claude-code-setup`, `claude-security` **n'existent pas** dans cet
environnement (catalogue, skills claude.ai et registre MCP vérifiés) : ne pas
tenter de les installer, ne pas prétendre les utiliser. Leurs besoins sont
couverts par le MCP Supabase, Playwright préinstallé, `/security-review` et les
skills projet `vehora-frontend` et `vehora-workflow`.

## Cycle obligatoire par phase

```
DÉVELOPPEMENT → TESTS FONCTIONNELS → AUDIT SÉCURITÉ → RECHERCHE DE FAILLES
→ CORRECTION → NOUVEAUX TESTS → AUDIT DE RÉGRESSION → BUILD → GIT DIFF
→ DOCUMENTATION → COMMIT → RAPPORT DE PHASE
```

Une phase n'est pas terminée tant qu'une faille CRITICAL ou HIGH n'est pas
corrigée ou explicitement documentée avec justification.

Chaque fonctionnalité est testée sous trois angles :
1. utilisateur autorisé → ça marche ;
2. utilisateur non autorisé → l'accès est refusé ;
3. utilisateur malveillant → les contournements (ID, rôle, org, station,
   montant, statut, fichier) sont bloqués.

## Conventions

- **SQL** : `snake_case`, tables au pluriel, clés `id uuid primary key`.
  Toute table métier porte `organization_id`, et `station_id` quand la donnée
  est rattachée à un site.
- **TypeScript** : `strict: true`. Pas de `any`. Types de base générés depuis
  Supabase (`database.types.ts`), jamais écrits à la main.
- **Angular** : composants standalone, `ChangeDetectionStrategy.OnPush`,
  signals pour l'état local, lazy loading par feature.
- **Commits** : `type(scope): description` — ex. `feat(service-orders): création depuis la file d'attente`.
- **Français** dans l'UI et la documentation. Anglais dans le code (identifiants, tables, colonnes).

## Commandes

| But | Commande |
|---|---|
| Serveur de développement | `npm start` |
| Build de production (budgets appliqués) | `npm run build` |
| Migrations + tests de sécurité SQL | `npm run validate:sql` |
| Tests de parcours | `npm run e2e` |
| Vérification des types | `npm run types:check` |

**Node ≥ 22.22.3 requis** par Angular 22. En environnement cloud, le hook
`SessionStart` bascule automatiquement sur `/opt/node24`.
Pour Playwright en cloud, exporter
`VEHORA_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (le
Chromium préinstallé) ; en local, laisser la variable vide.

## État du projet

**Phase 11 validée.** Le cycle métier est complet : arrivée, inspection, file
d'attente, travail, contrôle, prêt, paiement, restitution. Prochaine étape au
choix : reçus et rapports, espace Super Admin, ou dette d'interface.

- Projet Supabase rattaché : `VAHORA` (`entpmxssjxllggsqhnwc`, PostgreSQL 17).
- 34 migrations appliquées ; référentiel : 10 rôles, 36 permissions,
  9 types de véhicules, 10 zones d'inspection, 15 transitions de dossier.
- **Paiement, mouvement de caisse et session de caisse sont trois choses.**
  Les espèces génèrent un mouvement, le Mobile Money non, un achat de savon est
  un mouvement sans paiement. Le mouvement est écrit par la base : pouvoir
  écrire l'un sans l'autre, c'est pouvoir faire disparaître de l'argent.
- **Aucun paiement ne se modifie ni ne se supprime** : la correction est un
  remboursement qui le référence, avec motif, plafonné au montant reçu, et de
  la même méthode.
- **L'écart de caisse est calculé, jamais saisi** (`déclaré − théorique`), la
  clôture passe par `cloturer_caisse()`, et une session clôturée est immuable.
- **Restituer avec un solde** exige `payments.refund` + un motif, et c'est
  audité — sauf en `STRICT`, où c'est refusé. Un caissier ne l'accorde pas.
- **Une modale fige la page derrière elle** (`ScrollLockService`) : sinon on
  perd sa place dans la file en encaissant.
- **Deux contrôles ne portent jamais le même nom accessible** dans une même
  boîte de dialogue — la croix s'appelle déjà « Fermer ».
- **Un employé n'est pas un utilisateur.** `employees.profile_id` est nullable
  et le reste dans le cas courant. Les opérations référencent `employee_id` :
  l'historique de travail survit au départ de la personne et à la suppression
  de son compte. On désactive un employé, on ne le supprime pas.
- **Assigner n'est pas exécuter** : deux permissions sur deux colonnes de la
  même ligne. Une policy ne voit pas quelle colonne a changé — c'est un trigger
  qui tranche. Règle générale pour toute table où deux droits se partagent une
  ligne.
- **Un trigger de protection doit se taire quand l'écriture vient d'une
  cascade.** Deux incidents (dernier propriétaire en phase 1, opérations en
  phase 10) : à chaque fois l'invariant « une organisation reste supprimable »
  était menacé. Tester la suppression d'organisation avec des données réelles.
- **Une action que le serveur refusera ne s'affiche pas comme possible** :
  bouton inerte et raison visible, jamais un clic qui échoue. Deux occurrences
  (prestation sans tarif, opération non assignée).
- **Le statut d'un dossier ne se change que par `transitionner_dossier()`.** Un
  trigger rejette tout autre `UPDATE`, `service_role` compris. Le drapeau de
  transaction porte l'identifiant du dossier : un booléen aurait laissé une
  transition légitime en couvrir une autre dans la même transaction.
- **La matrice des transitions est une table** (`service_order_transitions`),
  pas un `case`. Ouvrir une transition = insérer une ligne.
- **Le prix est copié dans la ligne de dossier**, à la date d'ouverture du
  dossier — pas à celle du jour. Modifier un tarif ne modifie aucun dossier
  existant. Le client n'envoie ni montant, ni devise, ni nom de prestation.
- **`EXECUTE` est accordé à `PUBLIC` par défaut sur toute fonction PostgreSQL.**
  Un `grant … to authenticated` n'enlève rien. Toute fonction exposée dans
  `public` doit être **révoquée de `public` et `anon`** explicitement.
- **PostgREST ne joint pas une vue agrégée** : sans clé étrangère déductible,
  pas de jointure. Lire la vue par une requête séparée.
- **Le prix est déterminé par le serveur** (`resoudre_prix`), du plus spécifique
  au plus général. Aucun tarif trouvé = aucune ligne, jamais un zéro implicite.
  Le client n'envoie jamais un montant ni une devise : un trigger impose celle
  de l'organisation.
- **Montants en entiers** (`amount_minor bigint`), jamais de `float`. Le nombre
  de décimales vient d'`Intl`, pas d'une constante : XOF n'en a pas, EUR en a
  deux. À l'écran, le symbole (« F CFA »), jamais le code ISO.
- **Un tarif ne s'écrase pas.** On ferme l'ancien la veille et on ouvre le
  nouveau, en une transaction (`remplacer_tarif`) : deux écritures depuis le
  navigateur peuvent être coupées au milieu, et la prestation se retrouverait
  sans tarif, donc invendable.
- **Un champ `<input type="date">` s'affiche dans la locale de l'appareil**, pas
  dans celle de la page : `09/13/2026` sur un Android en anglais. Toute date qui
  engage quelque chose est aussi écrite en toutes lettres à côté du champ.
- **Storage** : bucket `inspections` privé, chemin imposé
  `{organization_id}/{inspection_id}/{fichier}` — les policies ne comparent que
  le premier segment. Types limités à JPEG/PNG/WebP : **le SVG est exclu**, c'est
  du XML exécutable. Accès par URL signée courte, jamais publique.
- Une inspection est un **constat daté** : aucune policy UPDATE ni DELETE.
  Une erreur se corrige par une nouvelle inspection.
- **Une policy vérifie la ligne, pas ce qu'elle référence.** Toute clé
  étrangère vers une table multi-tenant demande un trigger de cohérence
  (`stations`↔`memberships`, `vehicles`↔`customers`).
- **Les numéros de téléphone sont normalisés par trigger** en forme
  internationale, à partir du pays de l'organisation. Ne jamais écrire
  `phone_digits` depuis le client, ni comparer des numéros bruts.
- Deux points d'entrée privilégiés volontairement exposés :
  `provisionner_organisation()` et `accepter_invitation()`. Ils vérifient
  eux-mêmes leurs conditions et auditent. **Ne pas révoquer leur EXECUTE** :
  l'advisor Supabase les signale, c'est un choix documenté en base.
- **`organization_id` est rempli par la base depuis le JWT** sur les tables qui
  le permettent : le client ne l'envoie pas, donc ne peut pas le falsifier.
  Appliquer le même principe à chaque nouvelle table métier.
- Custom access token hook **activé** sur `vehora.custom_access_token_hook`.
- Application Angular 22 : connexion, gardes, coquille applicative
  (barre latérale desktop, tiroir et barre basse mobile), thème sombre/clair.
- **Thème par défaut : sombre**, jamais « système » — la plupart des appareils
  sont en clair et l'application démarrerait à contre-identité.
- Parcours connecté vérifié de bout en bout ; **185 tests Playwright**,
  **154 assertions SQL**, et des campagnes d'intrusion par l'API réelle
  (`scripts/intrusion-caisse.mjs`, 25 assertions ;
  `scripts/intrusion-operations.mjs`, 17 ; `scripts/intrusion-dossiers.mjs`, 23 ;
  `scripts/intrusion-catalogue.mjs`, 21 ; 14 sur le stockage).
- **Un test ne doit pas modifier l'état que d'autres tests lisent**, ni épingler
  un numéro qui avance. `e2e/fixtures.ts` monte un dossier par l'API réelle ;
  chaque test qui fait avancer quelque chose crée le sien et le referme.
- **Une ressource unique par (station, utilisateur) — la caisse — casse le
  parallélisme.** Une station par projet Playwright, et `mode: 'serial'` dans
  le fichier : les deux sont nécessaires, sinon l'échec tombe au hasard.
- **Une exception attrapée en PL/pgSQL annule tout ce que son bloc a écrit.**
  Préparer les données hors du bloc qui attend l'échec, sinon la disparition se
  paie des dizaines de lignes plus loin. **Deux occurrences** : la règle écrite
  n'a pas empêché la seconde.
- **Leçon récurrente** : vingt défauts d'interface (thème par défaut, sélecteur
  de rôle, affichage des numéros, groupement des chiffres, débordement de
  modale, actions sur deux lignes, deux mises en page pour la même liste, date
  au format américain, code ISO au lieu du symbole, erreur affichée nulle part,
  bouton sans effet sur formulaire invalide, station absente de la file,
  prestation sans tarif proposée quand même, « Démarrer » proposé sans employé,
  dossier resté en attente au démarrage du travail, opération démarrée par
  erreur sans retour possible, page qui défile sous une modale, deux boutons
  « Fermer » dans la même modale, champ montant vidé au lieu de proposer le
  reste, solde périmé derrière la modale) ont échappé aux tests et se sont vus
  à l'écran. Sur un écran, une
  assertion doit décrire ce que l'œil doit voir. **Capturer l'écran fait partie
  de la validation d'une phase d'interface.**
- **Échec silencieux de formulaire** : deux occurrences (invitation, véhicule).
  La règle est dans `vehora-frontend` — désactiver l'ouverture tant que la
  donnée asynchrone manque, défaut par `effect`, message explicite sinon.
- **Pas de nombre magique partagé entre composants.** La hauteur de la barre
  basse était recopiée à deux endroits avec deux valeurs différentes : token
  `--vh-nav-basse`. Toute mesure utilisée par plus d'un composant devient un
  token.
- **`database.types.ts` : les blocs `Relationships` ne sont pas décoratifs.**
  Ils typent les jointures PostgREST ; leur absence produit un message
  trompeur. Quatre incidents — régénérer plutôt que compléter à la main ; en
  phase 9 les neuf tables concernées ont été comblées d'un coup.
- Le jeu de démonstration a **deux stations** (Liberté 6, Ouakam) : les tests
  de caisse en dépendent, et l'affichage multi-station aussi.
- Comptes de démonstration (à supprimer avant production) : `awa@vehora.test`
  (OWNER), `ousmane@vehora.test` et `ibrahima@vehora.test` (CASHIER),
  `fatou@vehora.test` (OWNER d'une seconde organisation),
  `sansorg@vehora.test` (volontairement sans organisation — ne jamais le
  rattacher, des tests en dépendent).
- Tests connectés : exporter `VEHORA_TEST_EMAIL` / `VEHORA_TEST_PASSWORD` et
  `VEHORA_TEST_EMAIL_CAISSIER` / `VEHORA_TEST_PASSWORD_CAISSIER`,
  sinon la suite est ignorée. En cloud, `e2e/relais-reseau.ts` rejoue les appels
  Supabase depuis Node — le proxy coupe le tunnel du navigateur.
- **Le rôle métier est porté par le claim `vehora_role`**, jamais `role` —
  ce dernier appartient à Supabase et détermine le rôle PostgreSQL de la
  session. Ne jamais réutiliser un nom de claim réservé.
