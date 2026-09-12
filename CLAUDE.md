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

**Phase 6 validée.** Clients et véhicules en place. Prochaine étape :
inspection et photos — premières policies Storage.

- Projet Supabase rattaché : `VAHORA` (`entpmxssjxllggsqhnwc`, PostgreSQL 17).
- 22 migrations appliquées ; référentiel : 10 rôles, 36 permissions,
  9 types de véhicules.
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
- Parcours connecté vérifié de bout en bout ; **99 tests Playwright**,
  **31 assertions SQL**, et une campagne d'intrusion par l'API réelle.
- **Leçon récurrente** : cinq défauts d'interface (thème par défaut, sélecteur
  de rôle, affichage des numéros, groupement des chiffres, débordement de
  modale) ont échappé aux tests et se sont vus à l'écran. Sur un écran, une
  assertion doit décrire ce que l'œil doit voir. **Capturer l'écran fait partie
  de la validation d'une phase d'interface.**
- **Échec silencieux de formulaire** : deux occurrences (invitation, véhicule).
  La règle est dans `vehora-frontend` — désactiver l'ouverture tant que la
  donnée asynchrone manque, défaut par `effect`, message explicite sinon.
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
